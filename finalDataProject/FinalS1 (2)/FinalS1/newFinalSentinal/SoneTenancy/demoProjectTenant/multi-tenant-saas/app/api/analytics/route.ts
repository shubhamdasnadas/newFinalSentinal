import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "../../lib/auth";
import { AnalyticsModel } from "../../models/OrgModels";

function getOrgSlug(user: any) { return user.activeOrgSlug || user.orgSlug || null; }

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const user = verifyToken(token);
    const orgSlug = getOrgSlug(user);
    if (!orgSlug) return NextResponse.json({ message: "No active organization" }, { status: 400 });

    const [pageStats, dailyStats, totalEvents, topUsers] = await Promise.all([
      AnalyticsModel.pageStats(orgSlug),
      AnalyticsModel.dailyStats(orgSlug),
      AnalyticsModel.totalEvents(orgSlug),
      AnalyticsModel.topUsers(orgSlug),
    ]);

    // pageStats, dailyStats, topUsers already return { _id, count } from the model
    return NextResponse.json({ pageStats, dailyStats, totalEvents, topUsers });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const user = verifyToken(token);
    const orgSlug = getOrgSlug(user);
    if (!orgSlug) return NextResponse.json({ message: "No active organization" }, { status: 400 });
    const body = await req.json();
    await AnalyticsModel.create({
      org_slug: orgSlug,
      event: body.event || "page_view",
      page: body.page,
      user: user.email,
      metadata: body.metadata,
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
