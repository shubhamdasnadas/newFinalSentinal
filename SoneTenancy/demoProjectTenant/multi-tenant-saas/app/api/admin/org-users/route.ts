import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "../../../lib/auth";
import { OrgUserModel } from "../../../models/OrgModels";
import bcrypt from "bcryptjs";

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

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const user = verifyToken(token);
    const orgSlug = req.nextUrl.searchParams.get("orgSlug") || user.activeOrgSlug || user.orgSlug;
    if (!orgSlug) return NextResponse.json({ message: "orgSlug required" }, { status: 400 });

    if (user.role !== "super_admin" && user.orgSlug !== orgSlug) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const users = await OrgUserModel.findAll(orgSlug);
    return NextResponse.json({ users: users.map((u) => transformUser(u as any)) });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const user = verifyToken(token);
    const body = await req.json();
    const { name, email, password, role, department, orgSlug: bodyOrgSlug } = body;

    const orgSlug = bodyOrgSlug || user.activeOrgSlug || user.orgSlug;
    if (!orgSlug) return NextResponse.json({ message: "orgSlug required" }, { status: 400 });

    if (user.role !== "super_admin" && user.role !== "org_admin") {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    if (!name || !email || !password) {
      return NextResponse.json({ message: "name, email and password are required" }, { status: 400 });
    }

    const existing = await OrgUserModel.findByEmail(orgSlug, email);
    if (existing) {
      return NextResponse.json({ message: "Email already exists in this organization" }, { status: 409 });
    }

    const hash = await bcrypt.hash(password, 10);
    const newUser = await OrgUserModel.create({
      org_slug: orgSlug,
      name,
      email,
      password: hash,
      role: role || "org_user",
      department,
      is_active: true,
    });

    return NextResponse.json({
      success: true,
      user: transformUser(newUser as any),
    }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
