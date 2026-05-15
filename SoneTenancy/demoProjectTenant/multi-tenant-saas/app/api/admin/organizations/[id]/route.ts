/**
 * GET    /api/admin/organizations/[id]  - Get single org
 * PUT    /api/admin/organizations/[id]  - Update org
 * DELETE /api/admin/organizations/[id]  - Deactivate org
 */
import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "../../../../lib/auth";
import { OrgModel } from "../../../../models/Organization";

/** Transform DB org row (snake_case) → frontend shape (camelCase + _id) */
function transformOrg(org: Record<string, any>) {
  return {
    _id: org.id,
    name: org.name,
    slug: org.slug,
    description: org.description ?? null,
    color: org.color,
    email: org.email ?? null,
    phone: org.phone ?? null,
    address: org.address ?? null,
    website: org.website ?? null,
    industry: org.industry ?? null,
    plan: org.plan,
    isActive: org.is_active,
    allowedPages: org.allowed_pages ?? [],
    createdAt: org.created_at,
    updatedAt: org.updated_at,
  };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const user = verifyToken(token);
    if (user.role !== "super_admin") {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const org = await OrgModel.findById(id);
    if (!org) return NextResponse.json({ message: "Organization not found" }, { status: 404 });

    return NextResponse.json({ org: transformOrg(org as any) });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const user = verifyToken(token);
    if (user.role !== "super_admin") {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const { name, email, phone, address, website, industry, plan, is_active, isActive } = body;

    const org = await OrgModel.update(id, {
      name,
      email,
      phone,
      address,
      website,
      industry,
      plan,
      // Accept both snake_case and camelCase from frontend
      is_active: is_active ?? isActive,
    });
    if (!org) return NextResponse.json({ message: "Organization not found" }, { status: 404 });

    return NextResponse.json({ success: true, org: transformOrg(org as any) });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const user = verifyToken(token);
    if (user.role !== "super_admin") {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    await OrgModel.deactivate(id);

    return NextResponse.json({ success: true, message: "Organization deactivated" });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
