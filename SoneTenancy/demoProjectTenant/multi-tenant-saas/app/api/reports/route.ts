import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "../../lib/auth";
import { ReportModel } from "../../models/OrgModels";

function getOrgSlug(user: any) { return user.activeOrgSlug || user.orgSlug || null; }

/** Transform DB report row → frontend shape (camelCase + _id) */
function transformReport(r: Record<string, any>) {
  return {
    _id: r.id,
    title: r.title,
    description: r.description ?? null,
    type: r.type,
    status: r.status,
    data: r.data ?? null,
    orgSlug: r.org_slug,
    createdBy: r.created_by ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const user = verifyToken(token);
    const orgSlug = getOrgSlug(user);
    if (!orgSlug) return NextResponse.json({ message: "No active organization" }, { status: 400 });
    const reports = await ReportModel.findAll(orgSlug);
    return NextResponse.json({ reports: reports.map((r) => transformReport(r as any)) });
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
    if (!body.title) return NextResponse.json({ message: "Title required" }, { status: 400 });
    const report = await ReportModel.create({ org_slug: orgSlug, ...body, created_by: user.email });
    return NextResponse.json({ success: true, report: transformReport(report as any) }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const user = verifyToken(token);
    const orgSlug = getOrgSlug(user);
    if (!orgSlug) return NextResponse.json({ message: "No active organization" }, { status: 400 });
    const { id } = await req.json();
    if (!id) return NextResponse.json({ message: "id required" }, { status: 400 });
    await ReportModel.delete(orgSlug, id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
