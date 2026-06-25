import { orgQuery, query, withOrgTransaction } from "./db";

export type SyncSource = "sentinelone" | "harmony" | "crowdstrike" | "defender" | "firewall";
export type SyncJobStatus =
  | "PENDING"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED";

export interface SyncJob {
  id: string;
  org_id?: string | null;
  org_slug: string;
  source: SyncSource;
  status: SyncJobStatus;
  created_at: Date;
  started_at: Date | null;
  completed_at: Date | null;
  error: string | null;
  extra?: any;
}

/**
 * Ensure `sync_jobs` exists inside an org DB.
 * (Idempotent)
 */
export async function ensureSyncJobsTable(orgSlug: string) {
  await orgQuery(
    orgSlug,
    `CREATE TABLE IF NOT EXISTS sync_jobs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id UUID,
      org_slug TEXT NOT NULL,
      source TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING','RUNNING','COMPLETED','FAILED')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      started_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      error TEXT,
      extra JSONB
    );
    CREATE INDEX IF NOT EXISTS idx_sync_jobs_org_slug_created_at ON sync_jobs(org_slug, created_at);
    CREATE INDEX IF NOT EXISTS idx_sync_jobs_status ON sync_jobs(status);
    CREATE INDEX IF NOT EXISTS idx_sync_jobs_source ON sync_jobs(source);
    `
  );
}

export async function createSyncJob(orgSlug: string, source: SyncSource, extra?: any) {
  await ensureSyncJobsTable(orgSlug);

  // IMPORTANT:
  // Your system is multi-tenant with per-org DBs (saas_org_<slug>). Those org DBs
  // do NOT reliably contain a `organizations` table.
  // So we store org_slug only, and keep org_id nullable.
  const rows = await orgQuery<{ id: string }>(
    orgSlug,
    `INSERT INTO sync_jobs (org_id, org_slug, source, status, error, extra)
     VALUES (
       NULL,
       $1,
       $2,
       'PENDING',
       NULL,
       $3::jsonb
     )
     RETURNING id`,
    [orgSlug, source, extra ?? null]
  );

  return rows[0]?.id;
}

export async function getSyncJob(orgSlug: string, jobId: string) {
  await ensureSyncJobsTable(orgSlug);

  const rows = await orgQuery<SyncJob>(
    orgSlug,
    `SELECT id, org_id, org_slug, source, status, created_at, started_at, completed_at, error, extra
     FROM sync_jobs
     WHERE id = $1
     LIMIT 1`,
    [jobId]
  );

  return rows[0] ?? null;
}

/**
 * Atomically claim the next pending job for a given org.
 * Returns null if nothing to process.
 */
export async function claimNextPendingJob(orgSlug: string): Promise<SyncJob | null> {
  await ensureSyncJobsTable(orgSlug);

  return withOrgTransaction(orgSlug, async (client) => {
    // Use SKIP LOCKED for concurrency safety
    const { rows } = await client.query<SyncJob>(
      `SELECT *
       FROM sync_jobs
       WHERE org_slug = $1 AND status = 'PENDING'
       ORDER BY created_at ASC
       LIMIT 1
       FOR UPDATE SKIP LOCKED`,
      [orgSlug]
    );

    const job = rows[0];
    if (!job) return null;

    await client.query(
      `UPDATE sync_jobs
       SET status = 'RUNNING', started_at = NOW(), error = NULL
       WHERE id = $1`,
      [job.id]
    );

    return { ...job, status: "RUNNING", started_at: new Date(), error: null } as SyncJob;
  });
}

export async function markJobCompleted(orgSlug: string, jobId: string) {
  await ensureSyncJobsTable(orgSlug);
  await orgQuery(
    orgSlug,
    `UPDATE sync_jobs
     SET status = 'COMPLETED', completed_at = NOW(), error = NULL
     WHERE id = $1`,
    [jobId]
  );
}

export async function markJobFailed(orgSlug: string, jobId: string, error: string) {
  await ensureSyncJobsTable(orgSlug);
  await orgQuery(
    orgSlug,
    `UPDATE sync_jobs
     SET status = 'FAILED', completed_at = NOW(), error = $2
     WHERE id = $1`,
    [jobId, error]
  );
}

