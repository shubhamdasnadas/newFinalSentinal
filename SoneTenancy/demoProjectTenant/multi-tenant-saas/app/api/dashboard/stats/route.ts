import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "../../../lib/auth";
import { OrgUserModel, ProjectModel } from "../../../models/OrgModels";
import { OrgModel } from "../../../models/Organization";

/** Transform DB project row → frontend shape */
function transformProject(p: Record<string, any>) {
  return {
    _id: p.id,
    name: p.name,
    key: p.key,
    description: p.description ?? null,
    status: p.status,
    createdBy: p.created_by ?? null,
    createdAt: p.created_at,
  };
}

/** Transform DB org_user row → frontend shape */
function transformMember(m: Record<string, any>) {
  return {
    _id: m.id,
    name: m.name,
    email: m.email,
    role: m.role,
    department: m.department ?? null,
    isActive: m.is_active,
    createdAt: m.created_at,
  };
}

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const user = verifyToken(token);
    const orgSlug = user.activeOrgSlug || user.orgSlug;
    if (!orgSlug) return NextResponse.json({ message: "No active organization" }, { status: 400 });

    const [memberCount, projectCount, activeProjectCount, recentProjects, recentMembers, org] =
      await Promise.all([
        OrgUserModel.countActive(orgSlug),
        ProjectModel.count(orgSlug),
        ProjectModel.countByStatus(orgSlug, "active"),
        ProjectModel.findRecent(orgSlug, 5),
        OrgUserModel.findActiveRecent(orgSlug, 5),
        OrgModel.findBySlug(orgSlug),
      ]);

    return NextResponse.json({
      memberCount,
      projectCount,
      activeProjectCount,
      plan: org?.plan || "free",
      recentProjects: recentProjects.map((p) => transformProject(p as any)),
      recentMembers: recentMembers.map((m) => transformMember(m as any)),
      orgName: org?.name,
      orgSlug,
      orgColor: org?.color || "#6366f1",
      orgIndustry: org?.industry,
    });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
