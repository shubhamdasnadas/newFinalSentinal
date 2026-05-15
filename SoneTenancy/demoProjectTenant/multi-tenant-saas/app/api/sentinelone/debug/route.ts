/**
 * GET /api/sentinelone/debug
 * Diagnostic endpoint — shows what is actually stored in the DB for this org.
 * Returns row count, first row raw value, and its typeof so you can confirm
 * whether data is stored correctly.
 * Remove this file once the issue is confirmed fixed.
 */
import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "../../../lib/auth";
import { orgQuery } from "../../../lib/db";

function getOrgSlug(user: any): string | null {
  return user.activeOrgSlug || user.orgSlug || null;
}

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const user = verifyToken(token);
    const orgSlug = getOrgSlug(user);
    if (!orgSlug) return NextResponse.json({ message: "No active organization" }, { status: 400 });

    // Check if tables exist
    const tables = await orgQuery<{ tablename: string }>(
      orgSlug,
      `SELECT tablename FROM pg_tables
       WHERE schemaname = 'public'
         AND tablename IN ('sentinelone_threats','sentinelone_agents','checkpoint_events')
       ORDER BY tablename`
    );

    // Count rows
    const threatCount = await orgQuery<{ count: string }>(
      orgSlug,
      "SELECT COUNT(*) AS count FROM sentinelone_threats"
    ).catch(() => [{ count: "TABLE_MISSING" }]);

    const agentCount = await orgQuery<{ count: string }>(
      orgSlug,
      "SELECT COUNT(*) AS count FROM sentinelone_agents"
    ).catch(() => [{ count: "TABLE_MISSING" }]);

    // Sample first threat row — show raw pg value and its type
    const sampleThreat = await orgQuery<{ data: unknown }>(
      orgSlug,
      "SELECT data FROM sentinelone_threats LIMIT 1"
    ).catch(() => []);

    const sampleAgent = await orgQuery<{ data: unknown }>(
      orgSlug,
      "SELECT data FROM sentinelone_agents LIMIT 1"
    ).catch(() => []);

    const firstThreat = sampleThreat[0]?.data;
    const firstAgent = sampleAgent[0]?.data;

    return NextResponse.json({
      orgSlug,
      orgDatabase: `saas_org_${orgSlug}`,
      tables: tables.map((t) => t.tablename),
      threatCount: threatCount[0]?.count,
      agentCount: agentCount[0]?.count,
      firstThreatType: typeof firstThreat,
      firstThreatIsString: typeof firstThreat === "string",
      firstThreatSample: typeof firstThreat === "string"
        ? (firstThreat as string).slice(0, 200)
        : firstThreat
          ? JSON.stringify(firstThreat).slice(0, 200)
          : null,
      firstAgentType: typeof firstAgent,
      firstAgentSample: typeof firstAgent === "string"
        ? (firstAgent as string).slice(0, 200)
        : firstAgent
          ? JSON.stringify(firstAgent).slice(0, 200)
          : null,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
