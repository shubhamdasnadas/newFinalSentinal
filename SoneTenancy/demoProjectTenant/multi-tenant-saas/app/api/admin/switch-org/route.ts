import { NextRequest, NextResponse } from "next/server";
import { verifyToken, signToken } from "../../../lib/auth";
import { OrgModel, ALL_PAGES } from "../../../models/Organization";

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const user = verifyToken(token);

    const isSuperAdmin = user.role === "super_admin";
    const isMultiOrgMember = !isSuperAdmin && (user.memberOrgIds?.length ?? 0) > 1;

    if (!isSuperAdmin && !isMultiOrgMember) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const { orgId } = await req.json();

    if (!orgId) {
      const newToken = signToken({ userId: user.userId, email: user.email, name: user.name, role: user.role });
      const response = NextResponse.json({ success: true, activeOrg: null });
      response.cookies.set("token", newToken, { httpOnly: true, path: "/", maxAge: 60 * 60 * 24 * 7, sameSite: "lax" });
      return response;
    }

    // Multi-org members can only switch to orgs they belong to
    if (isMultiOrgMember && !user.memberOrgIds!.includes(orgId)) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const org = await OrgModel.findById(orgId);
    if (!org) return NextResponse.json({ message: "Organization not found" }, { status: 404 });

    const newToken = signToken({
      userId: user.userId,
      email: user.email,
      name: user.name,
      role: user.role,
      orgId: org.id,
      orgSlug: org.slug,
      orgName: org.name,
      activeOrgId: org.id,
      activeOrgSlug: org.slug,
      activeOrgName: org.name,
      allowedPages: org.allowed_pages?.length ? org.allowed_pages : ALL_PAGES,
      memberOrgIds: user.memberOrgIds, // preserve across switches
    });

    const response = NextResponse.json({ success: true, activeOrg: { id: org.id, name: org.name, slug: org.slug } });
    response.cookies.set("token", newToken, { httpOnly: true, path: "/", maxAge: 60 * 60 * 24 * 7, sameSite: "lax" });
    return response;
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
