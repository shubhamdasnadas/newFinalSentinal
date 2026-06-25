/**
 * PostgreSQL multi-database connection manager.
 *
 * Architecture:
 *   P4C (master DB)  → users + organizations tables only
 *   saas_org_<slug>  → per-org tables (org_users, projects, reports, etc.)
 *
 * masterPool  → always connects to P4C
 * getOrgPool  → returns a cached pool for the org's own database
 */
import { Pool, PoolClient } from "pg";

// ─── Connection base config ───────────────────────────────────────────────────

const BASE = {
  host:     process.env.PG_HOST     || "localhost",
  port:     parseInt(process.env.PG_PORT || "5432", 10),
  user:     process.env.PG_USER     || "postgres",
  password: process.env.PG_PASSWORD || "root",
};

function dbName(slug: string) {
  return `saas_org_${slug}`;
}

// ─── Master pool (P4C) ────────────────────────────────────────────────────────

declare global {
  // eslint-disable-next-line no-var
  var __masterPool: Pool | undefined;
  // eslint-disable-next-line no-var
  var __orgPools: Map<string, Pool> | undefined;
}

export const masterPool: Pool =
  global.__masterPool ??
new Pool({ ...BASE, database: process.env.PG_DATABASE || "CISO" });

if (process.env.NODE_ENV !== "production") {
  global.__masterPool = masterPool;
}

// ─── Per-org pool cache ───────────────────────────────────────────────────────

const orgPoolMap: Map<string, Pool> =
  global.__orgPools ?? new Map<string, Pool>();

if (process.env.NODE_ENV !== "production") {
  global.__orgPools = orgPoolMap;
}

/** Return (or create) a connection pool for a specific org database */
export function getOrgPool(orgSlug: string): Pool {
  const db = dbName(orgSlug);
  if (!orgPoolMap.has(orgSlug)) {
    orgPoolMap.set(orgSlug, new Pool({ ...BASE, database: db }));
  }
  return orgPoolMap.get(orgSlug)!;
}

// ─── Query helpers ────────────────────────────────────────────────────────────

/** Query the master P4C database */
export async function query<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const result = await masterPool.query(text, params);
  return result.rows as T[];
}

/** Query a specific org's database */
export async function orgQuery<T = Record<string, unknown>>(
  orgSlug: string,
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const pool = getOrgPool(orgSlug);
  const result = await pool.query(text, params);
  return result.rows as T[];
}

/** Get a client from the master pool for transactions */
export async function getClient(): Promise<PoolClient> {
  return masterPool.connect();
}

/** Get a client from an org pool for transactions */
export async function getOrgClient(orgSlug: string): Promise<PoolClient> {
  return getOrgPool(orgSlug).connect();
}

/** Run multiple statements in a transaction on the master DB */
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await masterPool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/** Run multiple statements in a transaction on an org DB */
export async function withOrgTransaction<T>(
  orgSlug: string,
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getOrgPool(orgSlug).connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// ─── Database provisioning ────────────────────────────────────────────────────

/** SQL to create all org-specific tables inside a fresh org database */
export const ORG_SCHEMA_SQL = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS org_users (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  email       TEXT        NOT NULL UNIQUE,
  password    TEXT,
  role        TEXT        NOT NULL DEFAULT 'org_user'
                          CHECK (role IN ('org_admin', 'org_user')),
  department  TEXT,
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS projects (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  key         TEXT        NOT NULL,
  description TEXT,
  status      TEXT        NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active', 'inactive', 'archived')),
  created_by  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reports (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT        NOT NULL,
  description TEXT,
  type        TEXT        NOT NULL DEFAULT 'custom'
                          CHECK (type IN ('sales', 'finance', 'hr', 'operations', 'custom')),
  data        JSONB,
  status      TEXT        NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft', 'published', 'archived')),
  created_by  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT        NOT NULL,
  message     TEXT        NOT NULL,
  type        TEXT        NOT NULL DEFAULT 'info'
                          CHECK (type IN ('info', 'warning', 'success', 'error')),
  is_read     BOOLEAN     NOT NULL DEFAULT FALSE,
  target_user TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS support_tickets (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  subject     TEXT        NOT NULL,
  description TEXT        NOT NULL,
  status      TEXT        NOT NULL DEFAULT 'open'
                          CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  priority    TEXT        NOT NULL DEFAULT 'medium'
                          CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  created_by  TEXT,
  assigned_to TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS billing (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  plan         TEXT          NOT NULL DEFAULT 'free'
                             CHECK (plan IN ('free', 'starter', 'pro', 'enterprise')),
  amount       NUMERIC(10,2) NOT NULL DEFAULT 0,
  currency     TEXT          NOT NULL DEFAULT 'USD',
  status       TEXT          NOT NULL DEFAULT 'active'
                             CHECK (status IN ('active', 'past_due', 'cancelled')),
  billing_date TIMESTAMPTZ,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invoices (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_ref TEXT          NOT NULL,
  amount      NUMERIC(10,2) NOT NULL DEFAULT 0,
  date        TIMESTAMPTZ,
  status      TEXT          NOT NULL DEFAULT 'pending',
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS analytics_events (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event       TEXT        NOT NULL,
  page        TEXT,
  "user"      TEXT,
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS firewall_reports (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  report_name TEXT        NOT NULL UNIQUE,
  data        JSONB       NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS s1_threats (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  data       JSONB       NOT NULL,
  synced_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS s1_agents (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  data       JSONB       NOT NULL,
  synced_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS checkpoint_events (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id             TEXT        NOT NULL UNIQUE,
  customer_id          TEXT,
  type                 TEXT,
  state                TEXT,
  severity             TEXT,
  confidence_indicator TEXT,
  description          TEXT,
  sender_address       TEXT,
  saas                 TEXT,
  entity_id            TEXT,
  entity_link          TEXT,
  event_created        TIMESTAMPTZ,
  actions              JSONB,
  additional_data      JSONB,
  raw                  JSONB       NOT NULL,
  synced_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_checkpoint_events_type         ON checkpoint_events(type);
CREATE INDEX IF NOT EXISTS idx_checkpoint_events_state        ON checkpoint_events(state);
CREATE INDEX IF NOT EXISTS idx_checkpoint_events_event_created ON checkpoint_events(event_created);

CREATE TABLE IF NOT EXISTS zohotable (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  data_name  TEXT        NOT NULL UNIQUE,
  data       JSONB       NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_zohotable_data_name ON zohotable(data_name);

CREATE TABLE IF NOT EXISTS dashboard_layout (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT        NOT NULL UNIQUE,
  layout     JSONB       NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);



CREATE INDEX IF NOT EXISTS idx_org_users_email        ON org_users(email);
CREATE INDEX IF NOT EXISTS idx_notifications_target   ON notifications(target_user);
CREATE INDEX IF NOT EXISTS idx_analytics_created_at   ON analytics_events(created_at);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['org_users','projects','reports','notifications','support_tickets','billing'] LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS trg_%s_updated_at ON %I;
      CREATE TRIGGER trg_%s_updated_at
        BEFORE UPDATE ON %I
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    ', t, t, t, t);
  END LOOP;
END;
$$;
`;

/**
 * Create a new PostgreSQL database for an org and apply the schema.
 * Uses a superuser connection (no database selected) to run CREATE DATABASE.
 */
export async function provisionOrgDatabase(orgSlug: string): Promise<void> {
  const db = dbName(orgSlug);

  // Connect to postgres (maintenance DB) to create the new database
  const adminPool = new Pool({ ...BASE, database: "postgres" });
  try {
    // CREATE DATABASE cannot run inside a transaction
    await adminPool.query(`CREATE DATABASE "${db}"`);
  } finally {
    await adminPool.end();
  }

  // Now connect to the new database and apply the schema
  const orgPool = new Pool({ ...BASE, database: db });
  try {
    await orgPool.query(ORG_SCHEMA_SQL);
  } finally {
    await orgPool.end();
    // Remove any cached pool so a fresh one is created next time
    orgPoolMap.delete(orgSlug);
  }
}

/**
 * Drop an org's database entirely (used when deactivating/deleting an org).
 * Terminates all active connections first.
 */
export async function dropOrgDatabase(orgSlug: string): Promise<void> {
  const db = dbName(orgSlug);

  // Close cached pool first
  const existing = orgPoolMap.get(orgSlug);
  if (existing) {
    await existing.end().catch(() => {});
    orgPoolMap.delete(orgSlug);
  }

  const adminPool = new Pool({ ...BASE, database: "postgres" });
  try {
    // Terminate all connections to the target DB
    await adminPool.query(`
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE datname = $1 AND pid <> pg_backend_pid()
    `, [db]);
    await adminPool.query(`DROP DATABASE IF EXISTS "${db}"`);
  } finally {
    await adminPool.end();
  }
}
