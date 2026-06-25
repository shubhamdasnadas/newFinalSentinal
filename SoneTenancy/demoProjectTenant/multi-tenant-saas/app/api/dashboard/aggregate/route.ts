/**
 * GET /api/dashboard/aggregate
 *
 * Returns all dashboard data in one parallel round-trip to the DB.
 * Replaces the 8+ individual client-side fetches the dashboard previously made.
 */
import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "../../../lib/auth";
import { SentinelOneModel, CheckpointEventModel } from "../../../models/OrgModels";
import { orgQuery } from "../../../lib/db";

function safe<T>(p: Promise<T>, fallback: T): Promise<T> {
  return p.catch(() => fallback);
}

function rowsToData(rows: { data: unknown; synced_at?: Date }[]) {
  return rows.map((r) =>
    typeof r.data === "string" ? JSON.parse(r.data) : r.data
  );
}

export async function GET(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let user: ReturnType<typeof verifyToken>;
  try {
    user = verifyToken(token);
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const orgSlug = user.activeOrgSlug || user.orgSlug;
  if (!orgSlug) return NextResponse.json({ error: "No active organization" }, { status: 400 });

  // Ensure schemas exist before parallel reads (safe to run concurrently in Postgres)
  await Promise.all([
    safe(SentinelOneModel.ensureTables(orgSlug), undefined),
    safe(CheckpointEventModel.ensureTable(orgSlug), undefined),
  ]);

  // Run all data queries in parallel
  const [
    threats,
    agents,
    s1LastSync,
    appAgent,
    appCve,
    deviceControl,
    rss,
    harmonyEvents,
    harmonyLastSync,
    firewallWidgets,
    layout,
  ] = await Promise.all([
    safe(
      orgQuery<{ data: unknown }>(orgSlug, "SELECT data FROM s1_threats ORDER BY synced_at DESC").then(rowsToData),
      []
    ),
    safe(
      orgQuery<{ data: unknown }>(orgSlug, "SELECT data FROM s1_agents ORDER BY synced_at DESC").then(rowsToData),
      []
    ),
    safe(
      orgQuery<{ synced_at: Date }>(orgSlug, "SELECT synced_at FROM s1_threats ORDER BY synced_at DESC LIMIT 1").then((r) => r[0]?.synced_at?.toISOString() ?? null),
      null
    ),
    safe(
      orgQuery<{ data: unknown; synced_at: Date }>(orgSlug, "SELECT data, synced_at FROM s1_application_agent ORDER BY synced_at DESC").then(rowsToData),
      []
    ),
    safe(
      orgQuery<{ data: unknown; synced_at: Date }>(orgSlug, "SELECT data, synced_at FROM s1_application_cve ORDER BY synced_at DESC").then(rowsToData),
      []
    ),
    safe(
      orgQuery<{ data: unknown; synced_at: Date }>(orgSlug, "SELECT data, synced_at FROM s1_device_control ORDER BY synced_at DESC").then(rowsToData),
      []
    ),
    safe(
      orgQuery<{ data: unknown; synced_at: Date }>(orgSlug, "SELECT data, synced_at FROM s1_rss ORDER BY synced_at DESC").then(rowsToData),
      []
    ),
    safe(
      CheckpointEventModel.findAll(orgSlug).then((rows) =>
        rows.map((r) => ({
          eventId:             r.event_id,
          customerId:          r.customer_id ?? "",
          type:                r.type ?? "",
          state:               r.state ?? "",
          severity:            r.severity ?? "",
          confidenceIndicator: r.confidence_indicator ?? "",
          description:         r.description ?? "",
          senderAddress:       r.sender_address ?? "",
          saas:                r.saas ?? "",
          entityId:            r.entity_id ?? "",
          entityLink:          r.entity_link ?? "",
          createdAt:           r.created_at,
        }))
      ),
      []
    ),
    safe(
      CheckpointEventModel.lastSyncedAt(orgSlug).then((d) => d?.toISOString() ?? null),
      null
    ),
    safe(
      (async () => {
        await orgQuery(
          orgSlug,
          `CREATE TABLE IF NOT EXISTS firewall_widgets (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            report_name TEXT NOT NULL,
            x_axis TEXT, y_axis TEXT,
            chart_type TEXT DEFAULT 'bar',
            x INT NOT NULL DEFAULT 0, y INT NOT NULL DEFAULT 0,
            w INT NOT NULL DEFAULT 5, h INT NOT NULL DEFAULT 6,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
          ALTER TABLE firewall_widgets ADD COLUMN IF NOT EXISTS x_axis TEXT;
          ALTER TABLE firewall_widgets ADD COLUMN IF NOT EXISTS y_axis TEXT;
          ALTER TABLE firewall_widgets ADD COLUMN IF NOT EXISTS chart_type TEXT DEFAULT 'bar';`
        );
        return orgQuery(orgSlug, "SELECT * FROM firewall_widgets ORDER BY created_at ASC");
      })(),
      []
    ),
    safe(
      (async () => {
        await orgQuery(
          orgSlug,
          `CREATE TABLE IF NOT EXISTS dashboard_layout (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_email TEXT NOT NULL,
            layout JSONB NOT NULL,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE(user_email)
          )`
        );
        const rows = await orgQuery<{ layout: unknown }>(
          orgSlug,
          "SELECT layout FROM dashboard_layout WHERE user_email = $1 LIMIT 1",
          [user.email]
        );
        return rows[0]?.layout ?? null;
      })(),
      null
    ),
  ]);

  return NextResponse.json({
    sentinelone: {
      threats,
      agents,
      lastSyncedAt: s1LastSync,
      applicationAgent: appAgent,
      applicationCve:   appCve,
      deviceControl,
      rss,
    },
    harmony: {
      events:      harmonyEvents,
      lastSyncedAt: harmonyLastSync,
    },
    firewall: {
      widgets: firewallWidgets,
    },
    layout,
  });
}
