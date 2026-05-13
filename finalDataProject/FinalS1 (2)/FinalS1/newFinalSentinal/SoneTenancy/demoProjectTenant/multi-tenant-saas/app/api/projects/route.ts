import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "../../lib/auth";
import { ProjectModel } from "../../models/OrgModels";

function getOrgSlug(user: any): string | null {
  return user.activeOrgSlug || user.orgSlug || null;
}

/** Transform DB project row → frontend shape (camelCase + _id) */
function transformProject(p: Record<string, any>) {
  return {
    _id: p.id,
    name: p.name,
    key: p.key,
    description: p.description ?? null,
    status: p.status,
    orgSlug: p.org_slug,
    createdBy: p.created_by ?? null,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  };
}

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const user = verifyToken(token);
    const orgSlug = getOrgSlug(user);
    if (!orgSlug) return NextResponse.json({ message: "No active organization" }, { status: 400 });

    const projects = await ProjectModel.findAll(orgSlug);
    return NextResponse.json({ projects: projects.map((p) => transformProject(p as any)) });
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
    if (!body.name) return NextResponse.json({ message: "Name is required" }, { status: 400 });

    // Auto-generate key from name if not provided
    const key = body.key || body.name.slice(0, 6).toUpperCase().replace(/\s+/g, "");

    const project = await ProjectModel.create({
      org_slug: orgSlug,
      name: body.name,
      key,
      description: body.description,
      status: body.status,
      created_by: user.email,
    });

    return NextResponse.json({ success: true, project: transformProject(project as any) }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
