import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyToken, signToken } from "../../../lib/auth";
import { OrgModel, ALL_PAGES } from "../../../models/Organization";

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) {
      return NextResponse.json({ message: "Not authenticated." }, { status: 401 });
    }

    let user;
    try {
      user = verifyToken(token);
    } catch {
      return NextResponse.json({ message: "Session expired. Please log in again." }, { status: 401 });
    }

    if (!user.pendingOrgIds?.length) {
      return NextResponse.json({ message: "No pending org selection." }, { status: 400 });
    }

    const { orgId } = await req.json();
    if (!orgId || !user.pendingOrgIds.includes(orgId)) {
      return NextResponse.json({ message: "Invalid organization selection." }, { status: 403 });
    }

    const org = await OrgModel.findById(orgId);
    if (!org) {
      return NextResponse.json({ message: "Organization not found." }, { status: 404 });
    }

    const fullToken = signToken({
      userId: user.userId,
      email: user.email,
      name: user.name,
      role: user.role,
      orgId: org.id,
      orgSlug: org.slug,
      orgName: org.name,
      orgColor: org.color,
      activeOrgId: org.id,
      activeOrgSlug: org.slug,
      activeOrgName: org.name,
      activeOrgColor: org.color,
      allowedPages: org.allowed_pages?.length ? org.allowed_pages : ALL_PAGES,
      memberOrgIds: user.pendingOrgIds, // all orgs this user can access
    });

    const response = NextResponse.json({ success: true });
    response.cookies.set({
      name: "token",
      value: fullToken,
      httpOnly: true,
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
      sameSite: "lax",
      secure: false,
    });
    return response;
  } catch (error: any) {
    console.error("[CONFIRM-ORG ERROR]", error);
    return NextResponse.json({ message: "Server error: " + error.message }, { status: 500 });
  }
}
