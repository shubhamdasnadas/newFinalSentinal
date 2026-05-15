import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "../../../lib/auth";
import { orgQuery } from "../../../lib/db";

function getOrgSlug(user: any): string | null {
  return user.activeOrgSlug || user.orgSlug || null;
}

/**
 * GET  /api/dashboard/layout  - Fetch saved layout/state for current user+org
 * PUT  /api/dashboard/layout  - Save layout/state for current user+org
 *
 * Accepts ANY valid JSON object — no type validation that would reject
 * the security page's PageState shape.
 */

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const user = verifyToken(token);
    const orgSlug = getOrgSlug(user);
    if (!orgSlug) return NextResponse.json({ message: "No active organization" }, { status: 400 });

    // Ensure table exists
    await orgQuery(
      orgSlug,
      `CREATE TABLE IF NOT EXISTS dashboard_layout (
        id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        user_email TEXT        NOT NULL,
        layout     JSONB       NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(user_email)
      )`
    );

    const rows = await orgQuery<{ layout: any }>(
      orgSlug,
      "SELECT layout FROM dashboard_layout WHERE user_email = $1 LIMIT 1",
      [user.email]
    );

    // Return whatever was saved — no type-checking that would reject valid data
    if (!rows[0] || !rows[0].layout) {
      return NextResponse.json({ layout: null });
    }

    return NextResponse.json({ layout: rows[0].layout });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const user = verifyToken(token);
    const orgSlug = getOrgSlug(user);
    if (!orgSlug) return NextResponse.json({ message: "No active organization" }, { status: 400 });

    const body = await req.json();
    const layout = body.layout;

    if (!layout || typeof layout !== "object") {
      return NextResponse.json({ message: "layout is required and must be an object" }, { status: 400 });
    }

    // Ensure table exists
    await orgQuery(
      orgSlug,
      `CREATE TABLE IF NOT EXISTS dashboard_layout (
        id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        user_email TEXT        NOT NULL,
        layout     JSONB       NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(user_email)
      )`
    );

    // Upsert — insert or update on conflict
    await orgQuery(
      orgSlug,
      `INSERT INTO dashboard_layout (user_email, layout, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_email) DO UPDATE SET
         layout     = EXCLUDED.layout,
         updated_at = EXCLUDED.updated_at`,
      [user.email, JSON.stringify(layout)]
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
