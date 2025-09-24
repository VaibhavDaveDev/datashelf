import { DatabaseService } from './database';
import { ScrapeJob, JobResult } from '../types';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export interface PostgresJobQueueOptions {
    lockTTL?: number; // Lock timeout in milliseconds
    pollInterval?: number; // Polling interval in milliseconds
    maxRetries?: number; // Maximum retry attempts
    cleanupInterval?: number; // Cleanup interval in milliseconds
    cleanupTTL?: number; // TTL for completed jobs in milliseconds
}

export interface QueueStats {
    queued: number;
    running: number;
    completed: number;
    failed: number;
    locked: number;
}

/**
 * PostgreSQL-based job queue implementation using row-level locking
 * Replaces Redis with SELECT FOR UPDATE SKIP LOCKED pattern
 */
export class PostgresJobQueue {
    private database: DatabaseService;
    private workerId: string;
    private options: Required<PostgresJobQueueOptions>;
    private cleanupTimer?: NodeJS.Timeout | undefined;
    private isInitialized = false;

    constructor(database: DatabaseService, options: PostgresJobQueueOptions = {}) {
        this.database = database;
        this.workerId = `worker-${uuidv4().substring(0, 8)}-${process.pid}`;

        this.options = {
            lockTTL: options.lockTTL || 10 * 60 * 1000, // 10 minutes
            pollInterval: options.pollInterval || 1000, // 1 second
            maxRetries: options.maxRetries || 3,
            cleanupInterval: options.cleanupInterval || 5 * 60 * 1000, // 5 minutes
            cleanupTTL: options.cleanupTTL || 24 * 60 * 60 * 1000, // 24 hours
        };
    }

    /**
     * Initialize the job queue
     */
    async initialize(): Promise<void> {
        if (this.isInitialized) {
            return;
        }

        try {
            // Ensure database is initialized
            await this.database.initialize();

            // Start cleanup timer
            this.startCleanupTimer();

            this.isInitialized = true;

            logger.info('PostgreSQL job queue initialized', {
                workerId: this.workerId,
                lockTTL: this.options.lockTTL,
                pollInterval: this.options.pollInterval,
                maxRetries: this.options.maxRetries,
            });
        } catch (error) {
            throw new Error(`Failed to initialize PostgreSQL job queue: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Shutdown the job queue
     */
    async shutdown(): Promise<void> {
        if (!this.isInitialized) {
            return;
        }

        // Stop cleanup timer
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = undefined;
        }

        // Release any locks held by this worker
        await this.releaseWorkerLocks();

        this.isInitialized = false;

        logger.info('PostgreSQL job queue shutdown', { workerId: this.workerId });
    }

    /**
     * Add a job to the queue
     */
    async addJob(
        type: 'navigation' | 'category' | 'product',
        targetUrl: string,
        priority: number = 0,
        metadata: Record<string, any> = {},
        maxAttempts: number = this.options.maxRetries
    ): Promise<string> {
        try {
            const client = this.database.getClient();

            const { data, error } = await client
                .from('scrape_job')
                .insert({
                    type,
                    target_url: targetUrl,
                    status: 'queued',
                    priority,
                    attempts: 0,
                    max_attempts: maxAttempts,
                    metadata,
                })
                .select('id')
                .single();

            if (error) {
                throw new Error(`Failed to add job to queue: ${error.message}`);
            }

            if (!data) {
                throw new Error('No data returned from job insertion');
            }

            logger.info('Job added to queue', {
                jobId: data.id,
                type,
                targetUrl,
                priority,
                workerId: this.workerId,
            });

            return data.id;
        } catch (error) {
            logger.error('Failed to add job to queue', {
                type,
                targetUrl,
                priority,
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }

    /**
     * Get next job from queue with row-level locking
     * Uses PostgreSQL SELECT FOR UPDATE SKIP LOCKED pattern
     */
    async dequeueJob(): Promise<ScrapeJob | null> {
        try {
            const client = this.database.getClient();

            // First, clean up expired locks
            await this.cleanupExpiredLocks();

            // Get next available job with row-level locking
            const { data, error } = await client.rpc('dequeue_job', {
                worker_id: this.workerId,
                lock_ttl_minutes: Math.floor(this.options.lockTTL / (60 * 1000))
            });

            if (error) {
                throw new Error(`Failed to dequeue job: ${error.message}`);
            }

            if (!data || data.length === 0) {
                return null; // No jobs available
            }

            const jobData = data[0];

            const job: ScrapeJob = {
                id: jobData.id,
                type: jobData.type,
                target_url: jobData.target_url,
                priority: jobData.priority || 0,
                created_at: jobData.created_at,
                metadata: jobData.metadata || {},
            };

            logger.info('Job dequeued', {
                jobId: job.id,
                type: job.type,
                targetUrl: job.target_url,
                priority: job.priority,
                workerId: this.workerId,
                attempts: jobData.attempts + 1,
            });

            return job;
        } catch (error) {
            logger.error('Failed to dequeue job', {
                workerId: this.workerId,
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }

    /**
     * Mark job as completed
     */
    async completeJob(jobId: string, result: JobResult): Promise<void> {
        try {
            const client = this.database.getClient();

            const { error } = await client
                .from('scrape_job')
                .update({
                    status: 'completed',
                    locked_at: null,
                    locked_by: null,
                    completed_at: new Date().toISOString(),
                    metadata: {
                        ...result.metadata,
                        duration: result.duration,
                        itemsProcessed: result.itemsProcessed,
                        completedBy: this.workerId,
                    },
                })
                .eq('id', jobId)
                .eq('locked_by', this.workerId); // Ensure we own the lock

            if (error) {
                throw new Error(`Failed to complete job: ${error.message}`);
            }

            logger.info('Job completed', {
                jobId,
                workerId: this.workerId,
                duration: result.duration,
                itemsProcessed: result.itemsProcessed,
                success: result.success,
            });
        } catch (error) {
            logger.error('Failed to complete job', {
                jobId,
                workerId: this.workerId,
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }

    /**
     * Mark job as failed with retry logic
     */
    async failJob(jobId: string, error: string, result?: Partial<JobResult>): Promise<void> {
        try {
            const client = this.database.getClient();

            // Get current job to check retry logic
            const { data: jobData, error: fetchError } = await client
                .from('scrape_job')
                .select('attempts, max_attempts, metadata')
                .eq('id', jobId)
                .eq('locked_by', this.workerId)
                .single();

            if (fetchError) {
                throw new Error(`Failed to fetch job for failure: ${fetchError.message}`);
            }

            if (!jobData) {
                throw new Error('Job not found or not owned by this worker');
            }

            const attempts = jobData.attempts || 0;
            const maxAttempts = jobData.max_attempts || this.options.maxRetries;
            const shouldRetry = attempts < maxAttempts;

            const updateData: any = {
                last_error: error,
                locked_at: null,
                locked_by: null,
                metadata: {
                    ...jobData.metadata,
                    ...result?.metadata,
                    lastFailedBy: this.workerId,
                    lastFailedAt: new Date().toISOString(),
                },
            };

            if (shouldRetry) {
                // Reset to queued for retry
                updateData.status = 'queued';
                logger.info('Job failed, will retry', {
                    jobId,
                    workerId: this.workerId,
                    attempts: attempts + 1,
                    maxAttempts,
                    error,
                });
            } else {
                // Mark as permanently failed
                updateData.status = 'failed';
                updateData.completed_at = new Date().toISOString();
                logger.error('Job permanently failed', {
                    jobId,
                    workerId: this.workerId,
                    attempts: attempts + 1,
                    maxAttempts,
                    error,
                });
            }

            const { error: updateError } = await client
                .from('scrape_job')
                .update(updateData)
                .eq('id', jobId)
                .eq('locked_by', this.workerId);

            if (updateError) {
                throw new Error(`Failed to update failed job: ${updateError.message}`);
            }
        } catch (error) {
            logger.error('Failed to fail job', {
                jobId,
                workerId: this.workerId,
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }

    /**
     * Get queue statistics
     */
    async getStats(): Promise<QueueStats> {
        try {
            const client = this.database.getClient();

            const { data, error } = await client
                .from('scrape_job')
                .select('status, locked_at');

            if (error) {
                throw new Error(`Failed to get queue stats: ${error.message}`);
            }

            const stats: QueueStats = {
                queued: 0,
                running: 0,
                completed: 0,
                failed: 0,
                locked: 0,
            };

            (data || []).forEach(job => {
                if (job.locked_at) {
                    stats.locked++;
                }
                stats[job.status as keyof Omit<QueueStats, 'locked'>]++;
            });

            return stats;
        } catch (error) {
            logger.error('Failed to get queue stats', {
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }

    /**
     * Get failed jobs that can be retried
     */
    async getRetryableJobs(limit: number = 20): Promise<any[]> {
        try {
            const client = this.database.getClient();

            const { data, error } = await client
                .from('scrape_job')
                .select('*')
                .eq('status', 'failed')
                .lt('attempts', 'max_attempts')
                .order('updated_at', { ascending: true })
                .limit(limit);

            if (error) {
                throw new Error(`Failed to get retryable jobs: ${error.message}`);
            }

            return data || [];
        } catch (error) {
            logger.error('Failed to get retryable jobs', {
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }

    /**
     * Requeue a failed job for retry
     */
    async requeueJob(jobId: string): Promise<boolean> {
        try {
            const client = this.database.getClient();

            const { data, error } = await client
                .from('scrape_job')
                .update({
                    status: 'queued',
                    locked_at: null,
                    locked_by: null,
                    last_error: null,
                })
                .eq('id', jobId)
                .eq('status', 'failed')
                .lt('attempts', 'max_attempts')
                .select('id');

            if (error) {
                throw new Error(`Failed to requeue job: ${error.message}`);
            }

            const success = (data || []).length > 0;

            if (success) {
                logger.info('Job requeued', { jobId, workerId: this.workerId });
            }

            return success;
        } catch (error) {
            logger.error('Failed to requeue job', {
                jobId,
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }

    /**
     * Clear all jobs (for testing)
     */
    async clearAllJobs(): Promise<void> {
        try {
            const client = this.database.getClient();

            const { error } = await client
                .from('scrape_job')
                .delete()
                .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

            if (error) {
                throw new Error(`Failed to clear jobs: ${error.message}`);
            }

            logger.info('All jobs cleared', { workerId: this.workerId });
        } catch (error) {
            logger.error('Failed to clear jobs', {
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }

    /**
     * Clean up expired locks (jobs locked longer than TTL)
     */
    private async cleanupExpiredLocks(): Promise<void> {
        try {
            const client = this.database.getClient();
            const expiredTime = new Date(Date.now() - this.options.lockTTL).toISOString();

            const { data, error } = await client
                .from('scrape_job')
                .update({
                    status: 'queued',
                    locked_at: null,
                    locked_by: null,
                })
                .eq('status', 'running')
                .lt('locked_at', expiredTime)
                .select('id, locked_by');

            if (error) {
                logger.error('Failed to cleanup expired locks', { error: error.message });
                return;
            }

            if (data && data.length > 0) {
                logger.warn('Cleaned up expired locks', {
                    count: data.length,
                    expiredTime,
                    lockTTL: this.options.lockTTL,
                });
            }
        } catch (error) {
            logger.error('Error during lock cleanup', {
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    /**
     * Release all locks held by this worker
     */
    private async releaseWorkerLocks(): Promise<void> {
        try {
            const client = this.database.getClient();

            const { data, error } = await client
                .from('scrape_job')
                .update({
                    status: 'queued',
                    locked_at: null,
                    locked_by: null,
                })
                .eq('locked_by', this.workerId)
                .select('id');

            if (error) {
                logger.error('Failed to release worker locks', {
                    workerId: this.workerId,
                    error: error.message
                });
                return;
            }

            if (data && data.length > 0) {
                logger.info('Released worker locks', {
                    workerId: this.workerId,
                    count: data.length,
                });
            }
        } catch (error) {
            logger.error('Error releasing worker locks', {
                workerId: this.workerId,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    /**
     * Start automatic cleanup of old completed jobs
     */
    private startCleanupTimer(): void {
        this.cleanupTimer = setInterval(async () => {
            try {
                await this.cleanupOldJobs();
            } catch (error) {
                logger.error('Error during automatic cleanup', {
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        }, this.options.cleanupInterval);
    }

    /**
     * Clean up old completed/failed jobs
     */
    private async cleanupOldJobs(): Promise<void> {
        try {
            const client = this.database.getClient();
            const cutoffTime = new Date(Date.now() - this.options.cleanupTTL).toISOString();

            const { data, error } = await client
                .from('scrape_job')
                .delete()
                .in('status', ['completed', 'failed'])
                .lt('completed_at', cutoffTime)
                .select('id');

            if (error) {
                logger.error('Failed to cleanup old jobs', { error: error.message });
                return;
            }

            if (data && data.length > 0) {
                logger.info('Cleaned up old jobs', {
                    count: data.length,
                    cutoffTime,
                    cleanupTTL: this.options.cleanupTTL,
                });
            }
        } catch (error) {
            logger.error('Error during job cleanup', {
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    /**
     * Health check for the job queue
     */
    async healthCheck(): Promise<{
        status: 'healthy' | 'unhealthy';
        details: {
            initialized: boolean;
            workerId: string;
            stats: QueueStats | null;
            databaseConnected: boolean;
        };
    }> {
        try {
            const stats = await this.getStats();
            const databaseHealthy = await this.database.healthCheck();

            return {
                status: this.isInitialized && databaseHealthy ? 'healthy' : 'unhealthy',
                details: {
                    initialized: this.isInitialized,
                    workerId: this.workerId,
                    stats,
                    databaseConnected: databaseHealthy,
                },
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                details: {
                    initialized: this.isInitialized,
                    workerId: this.workerId,
                    stats: null,
                    databaseConnected: false,
                },
            };
        }
    }
}