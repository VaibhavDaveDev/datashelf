-- Fix the retryable jobs query
CREATE OR REPLACE FUNCTION get_retryable_jobs(limit_count integer DEFAULT 20)
RETURNS TABLE (
    id uuid,
    type text,
    target_url text,
    metadata jsonb,
    attempts integer,
    max_attempts integer
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        scrape_job.id,
        scrape_job.type,
        scrape_job.target_url,
        scrape_job.metadata,
        scrape_job.attempts,
        scrape_job.max_attempts
    FROM scrape_job
    WHERE status = 'failed'
    AND scrape_job.attempts < scrape_job.max_attempts
    AND (last_error IS NULL OR updated_at < now() - interval '5 minutes')
    ORDER BY updated_at ASC
    LIMIT limit_count;
END;
$$;