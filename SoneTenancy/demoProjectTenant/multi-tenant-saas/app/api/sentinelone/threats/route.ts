import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "../../../lib/auth";
import { SentinelOneModel } from "../../../models/OrgModels";

function getOrgSlug(user: any): string | null {
  return user.activeOrgSlug || user.orgSlug || null;
}

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("token")?.value;

    if (!token) {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 }
      );
    }

    const user = verifyToken(token);

    const orgSlug =
      user.activeOrgSlug ||
      user.orgSlug ||
      null;

    if (!orgSlug) {
      return NextResponse.json(
        { message: "No active organization" },
        { status: 400 }
      );
    }

    const data = await SentinelOneModel.findAllThreats(orgSlug);

    const lastSyncedAt =
      await SentinelOneModel.lastSyncedAt(orgSlug);

    return NextResponse.json({
      success: true,
      count: data.length,
      data,
      pagination: {
        totalItems: data.length,
        returnedItems: data.length,
        nextCursor: null,
      },
      lastSyncedAt:
        lastSyncedAt?.toISOString() ?? null,
    });
  } catch (error: any) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        message: error.message,
      },
      { status: 500 }
    );
  }
}