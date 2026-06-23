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

/** GET /api/firewall/credentials — returns { baseUrl, apiKey, lastSyncedAt } or {} */
export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const user = verifyToken(token);
    const orgSlug = getOrgSlug(user);
    if (!orgSlug) return NextResponse.json({ message: "No active organization" }, { status: 400 });

    await orgQuery(orgSlug, ENSURE_TABLE);

    const rows = await orgQuery<{ credentials: any; updated_at: string }>(
      orgSlug,
      "SELECT credentials, updated_at FROM integration_credentials WHERE integration = 'firewall' LIMIT 1"
    );

    if (!rows[0]) return NextResponse.json({});
    return NextResponse.json({ ...rows[0].credentials, lastSyncedAt: rows[0].updated_at });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

/** PUT /api/firewall/credentials — body: { baseUrl, apiKey } */
export async function PUT(req: NextRequest) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const user = verifyToken(token);
    const orgSlug = getOrgSlug(user);
    if (!orgSlug) return NextResponse.json({ message: "No active organization" }, { status: 400 });

    const { baseUrl, apiKey } = await req.json();
    if (!baseUrl || !apiKey) {
      return NextResponse.json({ message: "baseUrl and apiKey are required" }, { status: 400 });
    }

    await orgQuery(orgSlug, ENSURE_TABLE);

    await orgQuery(
      orgSlug,
      `INSERT INTO integration_credentials (integration, credentials, updated_at)
       VALUES ('firewall', $1, NOW())
       ON CONFLICT (integration) DO UPDATE SET
         credentials = EXCLUDED.credentials,
         updated_at  = EXCLUDED.updated_at`,
      [JSON.stringify({ baseUrl, apiKey })]
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
