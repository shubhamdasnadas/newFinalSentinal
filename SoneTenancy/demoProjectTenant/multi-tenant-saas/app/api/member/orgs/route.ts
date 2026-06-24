import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "../../../lib/auth";
import { OrgModel } from "../../../models/Organization";

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const user = verifyToken(token);

    if (!user.memberOrgIds?.length) {
      return NextResponse.json({ orgs: [] });
    }

    const orgs = await Promise.all(user.memberOrgIds.map((id) => OrgModel.findById(id)));
    const valid = orgs.filter(Boolean) as NonNullable<(typeof orgs)[0]>[];

    return NextResponse.json({
      orgs: valid.map((o) => ({
        _id: o.id,
        name: o.name,
        slug: o.slug,
        color: o.color,
        plan: o.plan,
        isActive: o.is_active ?? true,
      })),
    });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
