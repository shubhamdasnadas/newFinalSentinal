import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "../../lib/auth";
import { NotificationModel } from "../../models/OrgModels";

function getOrgSlug(user: any): string | null {
  return user.activeOrgSlug || user.orgSlug || null;
}

/** Transform DB notification row → frontend shape (camelCase + _id) */
function transformNotification(n: Record<string, any>) {
  return {
    _id: n.id,
    title: n.title,
    message: n.message,
    type: n.type,
    isRead: n.is_read,
    targetUser: n.target_user ?? null,
    orgSlug: n.org_slug,
    createdAt: n.created_at,
    updatedAt: n.updated_at,
  };
}

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const user = verifyToken(token);
    const orgSlug = getOrgSlug(user);
    if (!orgSlug) return NextResponse.json({ message: "No active organization" }, { status: 400 });

    const notifications = await NotificationModel.findForUser(orgSlug, user.email);
    return NextResponse.json({ notifications: notifications.map((n) => transformNotification(n as any)) });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const user = verifyToken(token);
    if (user.role !== "super_admin" && user.role !== "org_admin") {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const orgSlug = getOrgSlug(user);
    if (!orgSlug) return NextResponse.json({ message: "No active organization" }, { status: 400 });

    const body = await req.json();
    if (!body.title || !body.message) {
      return NextResponse.json({ message: "title and message are required" }, { status: 400 });
    }

    const notification = await NotificationModel.create({
      org_slug: orgSlug,
      title: body.title,
      message: body.message,
      type: body.type,
      is_read: false,
      target_user: body.targetUser || body.target_user || "all",
    });

    return NextResponse.json({ success: true, notification: transformNotification(notification as any) }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
