/**
 * POST /api/sentinelone/sync
 * Thin wrapper — auth + credential extraction, then delegates to lib/sync/sentinelone.
 * Core sync logic lives in app/lib/sync/sentinelone.ts so the cron job can call it directly.
 */
import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "../../../lib/auth";
import { syncSentinelOne } from "../../../lib/sync/sentinelone";

function getOrgSlug(user: any): string | null {
  return user.activeOrgSlug || user.orgSlug || null;
}

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const user = verifyToken(token);
    const orgSlug = getOrgSlug(user);
    if (!orgSlug) return NextResponse.json({ message: "No active organization" }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const tokenKey = body.tokenKey || process.env.S1_API_TOKEN;
    const baseUrl = body.baseUrl || process.env.S1_BASE_URL;

    if (!tokenKey) {
      return NextResponse.json(
        { message: "SentinelOne not configured — provide tokenKey in body or set S1_API_TOKEN" },
        { status: 503 }
      );
    }

    const result = await syncSentinelOne(orgSlug, { tokenKey, baseUrl });

    return NextResponse.json({
      message: `Synced ${result.threats} threats and ${result.agents} agents to database`,
      ...result,
    });
  } catch (error: any) {
    console.error("[S1 sync] Error:", error.message);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
