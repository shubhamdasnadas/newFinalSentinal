/**
 * POST /api/admin/migrate-org-tables
 *
 * Adds s1_threats, s1_agents, checkpoint_events, firewall_reports,
 * and dashboard_layout tables to ALL existing org databases.
 *
 * Super admin only. Safe to run multiple times (all statements use IF NOT EXISTS).
 */
import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "../../../lib/auth";
import { query, getOrgPool } from "../../../lib/db";

const MIGRATION_SQL = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS firewall_reports (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  report_name TEXT        NOT NULL UNIQUE,
  data        JSONB       NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS s1_threats (
  id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  data      JSONB       NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS s1_agents (
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

CREATE TABLE IF NOT EXISTS dashboard_layout (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT        NOT NULL UNIQUE,
  layout     JSONB       NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const user = verifyToken(token);
    if (user.role !== "super_admin") {
      return NextResponse.json({ message: "Forbidden — super_admin only" }, { status: 403 });
    }

    // Get all active org slugs from master DB
    const orgs = await query<{ slug: string }>(
      "SELECT slug FROM organizations WHERE is_active = TRUE ORDER BY slug"
    );

    const results: { slug: string; status: string; error?: string }[] = [];

    for (const org of orgs) {
      const pool = getOrgPool(org.slug);
      try {
        await pool.query(MIGRATION_SQL);
        results.push({ slug: org.slug, status: "ok" });
      } catch (err: any) {
        results.push({ slug: org.slug, status: "error", error: err.message });
      }
    }

    const ok = results.filter((r) => r.status === "ok").length;
    const failed = results.filter((r) => r.status === "error").length;

    return NextResponse.json({
      message: `Migration complete — ${ok} org(s) updated, ${failed} failed`,
      results,
      ok,
      failed,
    });
  } catch (err: any) {
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}
