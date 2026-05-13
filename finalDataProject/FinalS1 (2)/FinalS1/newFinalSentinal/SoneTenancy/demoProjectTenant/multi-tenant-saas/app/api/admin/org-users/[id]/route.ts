import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "../../../../lib/auth";
import { OrgUserModel } from "../../../../models/OrgModels";

/** Transform DB org_user row → frontend shape (camelCase + _id) */
function transformUser(u: Record<string, any>) {
  return {
    _id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    department: u.department ?? null,
    orgSlug: u.org_slug,
    isActive: u.is_active,
    createdAt: u.created_at,
    updatedAt: u.updated_at,
  };
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const user = verifyToken(token);
    if (user.role !== "super_admin" && user.role !== "org_admin") {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const orgSlug = body.orgSlug || user.activeOrgSlug || user.orgSlug;
    if (!orgSlug) return NextResponse.json({ message: "orgSlug required" }, { status: 400 });

    const updated = await OrgUserModel.update(orgSlug, id, {
      name: body.name,
      role: body.role,
      department: body.department,
      // Accept both camelCase (frontend) and snake_case
      is_active: body.isActive ?? body.is_active,
    });

    if (!updated) return NextResponse.json({ message: "User not found" }, { status: 404 });
    return NextResponse.json({ success: true, user: transformUser(updated as any) });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const user = verifyToken(token);
    if (user.role !== "super_admin" && user.role !== "org_admin") {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const orgSlug = searchParams.get("orgSlug") || user.activeOrgSlug || user.orgSlug;
    if (!orgSlug) return NextResponse.json({ message: "orgSlug required" }, { status: 400 });

    await OrgUserModel.deactivate(orgSlug, id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
