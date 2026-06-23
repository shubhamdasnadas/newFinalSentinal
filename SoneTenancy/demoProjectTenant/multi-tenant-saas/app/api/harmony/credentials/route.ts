import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "../../../lib/auth";
import { orgQuery } from "../../../lib/db";

function getOrgSlug(user: any): string | null {
  return user.activeOrgSlug || user.orgSlug || null;
}

// CREATE TABLE won't add columns to an existing table, so we run an ALTER
// afterwards to safely add the token column if it isn't there yet.
async function ensureTable(orgSlug: string) {
  await orgQuery(orgSlug, `
    CREATE TABLE IF NOT EXISTS integration_credentials (
      integration TEXT        PRIMARY KEY,
      credentials JSONB       NOT NULL,
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await orgQuery(orgSlug, `
    ALTER TABLE integration_credentials
      ADD COLUMN IF NOT EXISTS token TEXT
  `);
}

/** GET /api/harmony/credentials — returns { clientId, accessKey, token } or {} */
export async function GET(req: NextRequest) {
  try {
    const authToken = req.cookies.get("token")?.value;
    if (!authToken) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const user = verifyToken(authToken);
    const orgSlug = getOrgSlug(user);
    if (!orgSlug) return NextResponse.json({ message: "No active organization" }, { status: 400 });

    await ensureTable(orgSlug);

    const rows = await orgQuery<{ credentials: any; token: string | null }>(
      orgSlug,
      "SELECT credentials, token FROM integration_credentials WHERE integration = 'harmony' LIMIT 1"
    );

    if (!rows[0]) return NextResponse.json({});
    return NextResponse.json({ ...rows[0].credentials, token: rows[0].token });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

/** PUT /api/harmony/credentials — body: { clientId, accessKey, token } */
export async function PUT(req: NextRequest) {
  try {
    const authToken = req.cookies.get("token")?.value;
    if (!authToken) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const user = verifyToken(authToken);
    const orgSlug = getOrgSlug(user);
    if (!orgSlug) return NextResponse.json({ message: "No active organization" }, { status: 400 });

    const { clientId, accessKey, token } = await req.json();
    if (!clientId || !accessKey) {
      return NextResponse.json({ message: "clientId and accessKey are required" }, { status: 400 });
    }

    await ensureTable(orgSlug);

    await orgQuery(
      orgSlug,
      `INSERT INTO integration_credentials (integration, credentials, token, updated_at)
       VALUES ('harmony', $1, $2, NOW())
       ON CONFLICT (integration) DO UPDATE SET
         credentials = EXCLUDED.credentials,
         token       = EXCLUDED.token,
         updated_at  = EXCLUDED.updated_at`,
      [JSON.stringify({ clientId, accessKey }), token ?? null]
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
