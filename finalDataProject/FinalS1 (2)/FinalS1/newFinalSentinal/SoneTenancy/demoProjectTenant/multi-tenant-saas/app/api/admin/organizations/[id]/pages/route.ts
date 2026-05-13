/**
 * GET  /api/admin/organizations/[id]/pages  - Get allowed pages for an org
 * PUT  /api/admin/organizations/[id]/pages  - Update allowed pages for an org
 */
import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "../../../../../lib/auth";
import { OrgModel, ALL_PAGES } from "../../../../../models/Organization";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const user = verifyToken(token);
    if (user.role !== "super_admin") return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const { id } = await params;
    const org = await OrgModel.findById(id);
    if (!org) return NextResponse.json({ message: "Not found" }, { status: 404 });

    return NextResponse.json({ allowedPages: org.allowed_pages || ALL_PAGES, allPages: ALL_PAGES });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const user = verifyToken(token);
    if (user.role !== "super_admin") return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const { id } = await params;
    const { allowedPages } = await req.json();

    // dashboard is always required
    const pages = Array.isArray(allowedPages)
      ? [...new Set(["dashboard", ...allowedPages])]
      : ALL_PAGES;

    const org = await OrgModel.update(id, { allowed_pages: pages });
    if (!org) return NextResponse.json({ message: "Not found" }, { status: 404 });

    return NextResponse.json({ success: true, allowedPages: org.allowed_pages });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
