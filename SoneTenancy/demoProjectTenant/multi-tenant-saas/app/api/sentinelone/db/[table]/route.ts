/**
 * GET /api/sentinelone/db/[table]
 * Generic DB-read endpoint for any s1_* table.
 * Supported: application-agent, application-cve, device-control, rss
 */
import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "../../../../lib/auth";
import { orgQuery } from "../../../../lib/db";
import { SentinelOneModel } from "../../../../models/OrgModels";

function getOrgSlug(u: any) { return u.activeOrgSlug || u.orgSlug || null; }

const TABLE_MAP: Record<string, string> = {
  "threats":           "s1_threats",
  "agents":            "s1_agents",
  "application-agent": "s1_application_agent",
  "application-cve":   "s1_application_cve",
  "device-control":    "s1_device_control",
  "rss":               "s1_rss",
  "threat-count":      "s1_threat_count",
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ table: string }> }
) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const user = verifyToken(token);
    const orgSlug = getOrgSlug(user);
    if (!orgSlug) return NextResponse.json({ message: "No active organization" }, { status: 400 });

    const { table } = await params;
    const dbTable = TABLE_MAP[table];
    if (!dbTable) return NextResponse.json({ message: `Unknown table: ${table}` }, { status: 400 });

    // Ensure tables exist
    await SentinelOneModel.ensureTables(orgSlug);

    const rows = await orgQuery<{ data: unknown; synced_at: Date }>(
      orgSlug,
      `SELECT data, synced_at FROM ${dbTable} ORDER BY synced_at DESC`
    );

    const data = rows.map(r => (typeof r.data === "string" ? JSON.parse(r.data) : r.data));
    const lastSyncedAt = rows[0]?.synced_at?.toISOString() ?? null;

    return NextResponse.json({ data, total: data.length, lastSyncedAt });
  } catch (e: any) {
    return NextResponse.json({ message: e.message }, { status: 500 });
  }
}
