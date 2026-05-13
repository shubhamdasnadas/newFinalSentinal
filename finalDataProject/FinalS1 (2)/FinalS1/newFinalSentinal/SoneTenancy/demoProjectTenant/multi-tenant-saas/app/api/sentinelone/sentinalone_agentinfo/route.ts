/**
 * GET /api/sentinelone/sentinalone_agentinfo
 * Returns SentinelOne agents stored in the org's database.
 * Use POST /api/sentinelone/sync to refresh from the live S1 API.
 */
import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "../../../lib/auth";
import { SentinelOneModel } from "../../../models/OrgModels";

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

    const data = await SentinelOneModel.findAllAgents(orgSlug);
    const lastSyncedAt = await SentinelOneModel.lastSyncedAt(orgSlug);

    return NextResponse.json({
      data,
      pagination: { totalItems: data.length, nextCursor: null },
      lastSyncedAt: lastSyncedAt?.toISOString() ?? null,
    });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
