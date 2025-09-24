# Redis Alternatives for DataShelf Scraper Service

Since you're concerned about Upstash Redis costs, here are alternatives for job queues and distributed locks:

## Option 1: PostgreSQL-Based Queues (Recommended)

Use Supabase PostgreSQL for both job queues and locks - no additional service needed!

### Job Queue Table:
```sql
CREATE TABLE job_queue (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    type text NOT NULL,
    payload jsonb NOT NULL,
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    attempts integer DEFAULT 0,
    max_attempts integer DEFAULT 3,
    scheduled_at timestamptz DEFAULT now(),
    started_at timestamptz,
    completed_at timestamptz,
    error_message text,
    created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_job_queue_status_scheduled ON job_queue(status, scheduled_at);
```

### Distributed Locks Table:
```sql
CREATE TABLE distributed_locks (
    lock_key text PRIMARY KEY,
    owner_id text NOT NULL,
    expires_at timestamptz NOT NULL,
    created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_locks_expires ON distributed_locks(expires_at);
```

### Benefits:
- ✅ **Free** (uses existing Supabase)
- ✅ **ACID transactions** for reliability
- ✅ **No additional infrastructure**
- ✅ **Built-in monitoring** via Supabase dashboard

## Option 2: Cloudflare Durable Objects

Use Cloudflare Durable Objects for stateful operations:

### Benefits:
- ✅ **Generous free tier** (1M requests/month)
- ✅ **Strong consistency** guarantees
- ✅ **Same infrastructure** as Workers
- ✅ **No external dependencies**

### Limitations:
- ⚠️ **More complex** to implement
- ⚠️ **Cloudflare-specific** (vendor lock-in)

## Option 3: Hybrid Approach

- **Job Queue**: PostgreSQL (Supabase)
- **Distributed Locks**: Cloudflare KV with TTL
- **Rate Limiting**: In-memory with Workers

### Benefits:
- ✅ **Completely free**
- ✅ **Simple implementation**
- ✅ **Uses existing services**

## Recommendation: PostgreSQL Queues

For your use case, PostgreSQL-based queues are the best choice:

1. **Cost**: $0 (uses existing Supabase)
2. **Reliability**: ACID transactions
3. **Monitoring**: Built into Supabase
4. **Scalability**: Handles thousands of jobs easily
5. **Familiarity**: Standard SQL operations

Would you like me to implement the PostgreSQL-based job queue system instead of Redis?