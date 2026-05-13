/**
 * scripts/migrate-org-tables.ts
 *
 * Adds sentinelone_threats, sentinelone_agents, and checkpoint_events tables
 * to ALL existing org databases that were provisioned before these tables existed.
 *
 * Run with:
 *   npx ts-node --project tsconfig.json scripts/migrate-org-tables.ts
 *
 * Or via the API endpoint: POST /api/admin/migrate-org-tables (super_admin only)
 */

import { Pool } from "pg";

const BASE = {
  host:     process.env.PG_HOST     || "localhost",
  port:     parseInt(process.env.PG_PORT || "5432", 10),
  user:     process.env.PG_USER     || "postgres",
  password: process.env.PG_PASSWORD || "root",
};

const MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS sentinelone_threats (
  id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  data      JSONB       NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sentinelone_agents (
  id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  data      JSONB       NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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

CREATE INDEX IF NOT EXISTS idx_cp_events_type          ON checkpoint_events(type);
CREATE INDEX IF NOT EXISTS idx_cp_events_state         ON checkpoint_events(state);
CREATE INDEX IF NOT EXISTS idx_cp_events_event_created ON checkpoint_events(event_created);

CREATE TABLE IF NOT EXISTS firewall_reports (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  report_name TEXT        NOT NULL UNIQUE,
  data        JSONB       NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dashboard_layout (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT        NOT NULL UNIQUE,
  layout     JSONB       NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

async function getOrgDatabases(): Promise<string[]> {
  const masterPool = new Pool({ ...BASE, database: process.env.PG_DATABASE || "P4C" });
  try {
    const result = await masterPool.query<{ slug: string }>(
      "SELECT slug FROM organizations WHERE is_active = TRUE ORDER BY slug"
    );
    return result.rows.map((r) => r.slug);
  } finally {
    await masterPool.end();
  }
}

async function migrateOrg(slug: string): Promise<{ slug: string; status: string; error?: string }> {
  const dbName = `saas_org_${slug}`;
  const pool = new Pool({ ...BASE, database: dbName });
  try {
    await pool.query(MIGRATION_SQL);
    return { slug, status: "ok" };
  } catch (err: any) {
    return { slug, status: "error", error: err.message };
  } finally {
    await pool.end();
  }
}

async function main() {
  console.log("🔄 Starting org database migration...\n");

  let slugs: string[];
  try {
    slugs = await getOrgDatabases();
  } catch (err: any) {
    console.error("❌ Failed to fetch org list:", err.message);
    process.exit(1);
  }

  console.log(`Found ${slugs.length} active org(s): ${slugs.join(", ")}\n`);

  const results = await Promise.all(slugs.map(migrateOrg));

  let ok = 0, failed = 0;
  for (const r of results) {
    if (r.status === "ok") {
      console.log(`  ✅ saas_org_${r.slug}`);
      ok++;
    } else {
      console.log(`  ❌ saas_org_${r.slug} — ${r.error}`);
      failed++;
    }
  }

  console.log(`\nDone. ${ok} succeeded, ${failed} failed.`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
