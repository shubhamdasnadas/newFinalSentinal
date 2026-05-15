import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "../../lib/auth";
import { SupportTicketModel } from "../../models/OrgModels";

function getOrgSlug(user: any): string | null {
  return user.activeOrgSlug || user.orgSlug || null;
}

/** Transform DB support_ticket row → frontend shape (camelCase + _id) */
function transformTicket(t: Record<string, any>) {
  return {
    _id: t.id,
    subject: t.subject,
    description: t.description,
    status: t.status,
    priority: t.priority,
    orgSlug: t.org_slug,
    createdBy: t.created_by ?? null,
    assignedTo: t.assigned_to ?? null,
    createdAt: t.created_at,
    updatedAt: t.updated_at,
  };
}

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const user = verifyToken(token);
    const orgSlug = getOrgSlug(user);
    if (!orgSlug) return NextResponse.json({ message: "No active organization" }, { status: 400 });

    const tickets = await SupportTicketModel.findAll(orgSlug);
    return NextResponse.json({ tickets: tickets.map((t) => transformTicket(t as any)) });
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
    if (!body.subject || !body.description) {
      return NextResponse.json({ message: "Subject and description are required" }, { status: 400 });
    }

    const ticket = await SupportTicketModel.create({
      org_slug: orgSlug,
      subject: body.subject,
      description: body.description,
      status: body.status,
      priority: body.priority,
      created_by: user.email,
      assigned_to: body.assignedTo || body.assigned_to,
    });

    return NextResponse.json({ success: true, ticket: transformTicket(ticket as any) }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
