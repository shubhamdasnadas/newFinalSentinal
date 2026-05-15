/**
 * GET /api/firewall/reports/[report]
 * Returns a specific firewall report from the org's PostgreSQL database.
 * Mirrors the original Express getFirewallReport() exactly.
 */
import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "../../../../lib/auth";
import { orgQuery } from "../../../../lib/db";

function getOrgSlug(user: any): string | null {
  return user.activeOrgSlug || user.orgSlug || null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ report: string }> }
) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const user = verifyToken(token);
    const orgSlug = getOrgSlug(user);
    if (!orgSlug) return NextResponse.json({ message: "No active organization" }, { status: 400 });

    const { report } = await params;

    // Ensure table exists (graceful — won't fail if collect hasn't run yet)
    await orgQuery(
      orgSlug,
      `CREATE TABLE IF NOT EXISTS firewall_reports (
        id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        report_name TEXT        NOT NULL UNIQUE,
        data        JSONB       NOT NULL,
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`
    );

    const rows = await orgQuery<{ data: any; updated_at: string }>(
      orgSlug,
      "SELECT data, updated_at FROM firewall_reports WHERE report_name = $1 LIMIT 1",
      [report]
    );

    // Mirrors: res.json(data?.data || {})
    return NextResponse.json({
      report,
      data: rows[0]?.data ?? null,
      updatedAt: rows[0]?.updated_at ?? null,
    });
  } catch (error: any) {
    console.error("[FW] getFirewallReport error:", error.message);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
