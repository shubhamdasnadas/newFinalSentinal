/**
 * GET /api/sentinelone/db/threats
 * Returns threats stored in the s1_threats DB table (no live S1 call).
 */
import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "../../../../lib/auth";
import { SentinelOneModel } from "../../../../models/OrgModels";

function getOrgSlug(u: any) { return u.activeOrgSlug || u.orgSlug || null; }

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const user = verifyToken(token);
    const orgSlug = getOrgSlug(user);
    if (!orgSlug) return NextResponse.json({ message: "No active organization" }, { status: 400 });

    const data = await SentinelOneModel.findAllThreats(orgSlug);
    const lastSyncedAt = await SentinelOneModel.lastSyncedAt(orgSlug);
    return NextResponse.json({ data, total: data.length, lastSyncedAt: lastSyncedAt?.toISOString() ?? null });
  } catch (e: any) {
    return NextResponse.json({ message: e.message }, { status: 500 });
  }
}
