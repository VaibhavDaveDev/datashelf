-- Enhanced PostgreSQL Job Queue Migration
-- Adds locking columns and indexes for efficient queue operations

-- Add new columns for PostgreSQL-based job queue with row-level locking
ALTER TABLE scrape_job 
ADD COLUMN IF NOT EXISTS priority integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS locked_at timestamptz,
ADD COLUMN IF NOT EXISTS locked_by text,
ADD COLUMN IF NOT EXISTS completed_at timestamptz;

-- Update the status check constraint to ensure valid statuses
ALTER TABLE scrape_job DROP CONSTRAINT IF EXISTS scrape_job_status_check;
ALTER TABLE scrape_job ADD CONSTRAINT scrape_job_status_check 
    CHECK (status IN ('queued', 'running', 'completed', 'failed'));

-- Create indexes for efficient job queue operations
CREATE INDEX IF NOT EXISTS idx_scrape_job_queue 
    ON scrape_job(status, priority DESC, created_at ASC) 
    WHERE status = 'queued';

CREATE INDEX IF NOT EXISTS idx_scrape_job_locked 
    ON scrape_job(locked_at) 
    WHERE locked_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_scrape_job_cleanup 
    ON scrape_job(completed_at) 
    WHERE status IN ('completed', 'failed');

CREATE INDEX IF NOT EXISTS idx_scrape_job_priority 
    ON scrape_job(priority DESC, created_at ASC);

-- Create index for efficient retry job queries
CREATE INDEX IF NOT EXISTS idx_scrape_job_retry 
    ON scrape_job(status, attempts, max_attempts, updated_at) 
    WHERE status = 'failed' AND attempts < max_attempts;

-- Add comment explaining the locking mechanism
COMMENT ON COLUMN scrape_job.locked_at IS 'Timestamp when job was locked by a worker (for distributed locking)';
COMMENT ON COLUMN scrape_job.locked_by IS 'Worker instance identifier that locked the job';
COMMENT ON COLUMN scrape_job.priority IS 'Job priority (higher number = higher priority)';
COMMENT ON COLUMN scrape_job.completed_at IS 'Timestamp when job was completed or failed';

-- Create function to automatically set completed_at when status changes
CREATE OR REPLACE FUNCTION set_job_completed_at()
RETURNS TRIGGER AS $$
BEGIN
    -- Set completed_at when job moves to completed or failed status
    IF NEW.status IN ('completed', 'failed') AND OLD.status NOT IN ('completed', 'failed') THEN
        NEW.completed_at = now();
    END IF;
    
    -- Clear lock fields when job completes
    IF NEW.status IN ('completed', 'failed') THEN
        NEW.locked_at = NULL;
        NEW.locked_by = NULL;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic completed_at setting
DROP TRIGGER IF EXISTS set_scrape_job_completed_at ON scrape_job;
CREATE TRIGGER set_scrape_job_completed_at
    BEFORE UPDATE ON scrape_job
    FOR EACH ROW
    EXECUTE FUNCTION set_job_completed_at();