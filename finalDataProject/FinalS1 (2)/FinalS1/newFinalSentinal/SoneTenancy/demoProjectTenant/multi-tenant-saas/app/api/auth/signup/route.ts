// This route is kept for backward compatibility but org users are created
// via /api/admin/org-users by super admin or org admin.
import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { message: "Direct signup is disabled. Contact your organization admin." },
    { status: 403 }
  );
}
