-- PostgreSQL functions for atomic job queue operations
-- Implements SELECT FOR UPDATE SKIP LOCKED pattern for distributed job processing

-- Function to atomically dequeue a job with row-level locking
CREATE OR REPLACE FUNCTION dequeue_job(
    worker_id text,
    lock_ttl_minutes integer DEFAULT 10
)
RETURNS TABLE(
    id uuid,
    type text,
    target_url text,
    priority integer,
    attempts integer,
    max_attempts integer,
    metadata jsonb,
    created_at timestamptz
) AS $$
DECLARE
    job_record RECORD;
BEGIN
    -- First, clean up any expired locks
    UPDATE scrape_job 
    SET status = 'queued', 
        locked_at = NULL, 
        locked_by = NULL
    WHERE status = 'running' 
      AND locked_at < (now() - (lock_ttl_minutes || ' minutes')::interval);

    -- Get and lock the next available job
    SELECT sj.id, sj.type, sj.target_url, sj.priority, sj.attempts, 
           sj.max_attempts, sj.metadata, sj.created_at
    INTO job_record
    FROM scrape_job sj
    WHERE sj.status = 'queued'
      AND (sj.locked_at IS NULL OR sj.locked_at < (now() - (lock_ttl_minutes || ' minutes')::interval))
    ORDER BY sj.priority DESC, sj.created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT 1;

    -- If no job found, return empty result
    IF NOT FOUND THEN
        RETURN;
    END IF;

    -- Update the job to mark it as running and locked
    UPDATE scrape_job 
    SET status = 'running',
        locked_at = now(),
        locked_by = worker_id,
        attempts = attempts + 1,
        updated_at = now()
    WHERE scrape_job.id = job_record.id;

    -- Return the job details
    RETURN QUERY SELECT 
        job_record.id,
        job_record.type,
        job_record.target_url,
        job_record.priority,
        job_record.attempts + 1, -- Return the incremented attempts
        job_record.max_attempts,
        job_record.metadata,
        job_record.created_at;
END;
$$ LANGUAGE plpgsql;

-- Function to get queue statistics efficiently
CREATE OR REPLACE FUNCTION get_queue_stats()
RETURNS TABLE(
    status text,
    count bigint,
    locked_count bigint
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sj.status,
        COUNT(*) as count,
        COUNT(CASE WHEN sj.locked_at IS NOT NULL THEN 1 END) as locked_count
    FROM scrape_job sj
    GROUP BY sj.status;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old completed jobs
CREATE OR REPLACE FUNCTION cleanup_old_jobs(
    older_than_hours integer DEFAULT 24
)
RETURNS integer AS $$
DECLARE
    deleted_count integer;
BEGIN
    DELETE FROM scrape_job 
    WHERE status IN ('completed', 'failed')
      AND completed_at < (now() - (older_than_hours || ' hours')::interval);
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to requeue failed jobs that haven't exceeded max attempts
CREATE OR REPLACE FUNCTION requeue_failed_jobs(
    max_jobs integer DEFAULT 100
)
RETURNS integer AS $$
DECLARE
    requeued_count integer;
BEGIN
    UPDATE scrape_job 
    SET status = 'queued',
        locked_at = NULL,
        locked_by = NULL,
        last_error = NULL,
        updated_at = now()
    WHERE status = 'failed'
      AND attempts < max_attempts
      AND id IN (
          SELECT id FROM scrape_job 
          WHERE status = 'failed' 
            AND attempts < max_attempts
          ORDER BY updated_at ASC
          LIMIT max_jobs
      );
    
    GET DIAGNOSTICS requeued_count = ROW_COUNT;
    RETURN requeued_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get job queue health metrics
CREATE OR REPLACE FUNCTION get_queue_health()
RETURNS TABLE(
    total_jobs bigint,
    queued_jobs bigint,
    running_jobs bigint,
    completed_jobs bigint,
    failed_jobs bigint,
    locked_jobs bigint,
    expired_locks bigint,
    retryable_jobs bigint,
    oldest_queued_age interval,
    oldest_running_age interval
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_jobs,
        COUNT(CASE WHEN status = 'queued' THEN 1 END) as queued_jobs,
        COUNT(CASE WHEN status = 'running' THEN 1 END) as running_jobs,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_jobs,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_jobs,
        COUNT(CASE WHEN locked_at IS NOT NULL THEN 1 END) as locked_jobs,
        COUNT(CASE WHEN status = 'running' AND locked_at < (now() - interval '10 minutes') THEN 1 END) as expired_locks,
        COUNT(CASE WHEN status = 'failed' AND attempts < max_attempts THEN 1 END) as retryable_jobs,
        COALESCE(now() - MIN(CASE WHEN status = 'queued' THEN created_at END), interval '0') as oldest_queued_age,
        COALESCE(now() - MIN(CASE WHEN status = 'running' THEN locked_at END), interval '0') as oldest_running_age
    FROM scrape_job;
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON FUNCTION dequeue_job(text, integer) IS 'Atomically dequeue next job with row-level locking using SELECT FOR UPDATE SKIP LOCKED';
COMMENT ON FUNCTION get_queue_stats() IS 'Get job queue statistics grouped by status';
COMMENT ON FUNCTION cleanup_old_jobs(integer) IS 'Clean up completed/failed jobs older than specified hours';
COMMENT ON FUNCTION requeue_failed_jobs(integer) IS 'Requeue failed jobs that haven''t exceeded max retry attempts';
COMMENT ON FUNCTION get_queue_health() IS 'Get comprehensive job queue health metrics';