import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "../../../lib/auth";
import { orgQuery } from "../../../lib/db";

function getOrgSlug(user: any): string | null {
  return user.activeOrgSlug || user.orgSlug || null;
}

const ENSURE_TABLE = `
  CREATE TABLE IF NOT EXISTS integration_credentials (
    integration TEXT        PRIMARY KEY,
    credentials JSONB       NOT NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`;

/** GET /api/sentinelone/credentials — returns { accountId, tokenKey } or {} */
export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const user = verifyToken(token);
    const orgSlug = getOrgSlug(user);
    if (!orgSlug) return NextResponse.json({ message: "No active organization" }, { status: 400 });

    await orgQuery(orgSlug, ENSURE_TABLE);

    const rows = await orgQuery<{ credentials: any }>(
      orgSlug,
      "SELECT credentials FROM integration_credentials WHERE integration = 'sentinelone' LIMIT 1"
    );

    return NextResponse.json(rows[0]?.credentials ?? {});
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

/** PUT /api/sentinelone/credentials — body: { accountId, tokenKey } */
export async function PUT(req: NextRequest) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const user = verifyToken(token);
    const orgSlug = getOrgSlug(user);
    if (!orgSlug) return NextResponse.json({ message: "No active organization" }, { status: 400 });

    const { accountId, tokenKey } = await req.json();
    if (!accountId || !tokenKey) {
      return NextResponse.json({ message: "accountId and tokenKey are required" }, { status: 400 });
    }

    await orgQuery(orgSlug, ENSURE_TABLE);

    await orgQuery(
      orgSlug,
      `INSERT INTO integration_credentials (integration, credentials, updated_at)
       VALUES ('sentinelone', $1, NOW())
       ON CONFLICT (integration) DO UPDATE SET
         credentials = EXCLUDED.credentials,
         updated_at  = EXCLUDED.updated_at`,
      [JSON.stringify({ accountId, tokenKey })]
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
