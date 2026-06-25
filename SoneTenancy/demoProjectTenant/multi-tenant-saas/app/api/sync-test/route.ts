import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "../../lib/auth";
import { orgQuery } from "../../lib/db";

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const user = verifyToken(token);
    const orgSlug = user.activeOrgSlug || user.orgSlug;
    if (!orgSlug) return NextResponse.json({ message: "No active organization" }, { status: 400 });

    const rows = await orgQuery(
      orgSlug,
      "SELECT id, counter, label, created_at FROM sync_test_log ORDER BY created_at DESC LIMIT 10",
      []
    );

    return NextResponse.json({ rows, count: rows.length, orgSlug });
  } catch (error: any) {
    if (error.message?.includes("sync_test_log")) {
      return NextResponse.json({ rows: [], count: 0, info: "Table not created yet — run the generator script first" });
    }
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
