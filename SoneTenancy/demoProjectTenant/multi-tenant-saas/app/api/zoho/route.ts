import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "../../lib/auth";
import { orgQuery } from "../../lib/db";

function getOrgSlug(user: any): string | null {
  return user.activeOrgSlug || user.orgSlug || null;
}

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const user = verifyToken(token);
    const orgSlug = getOrgSlug(user);
    if (!orgSlug) {
      return NextResponse.json(
        { message: "No active organization" },
        { status: 400 }
      );
    }

    const code = req.nextUrl.searchParams.get("code");

    if (!code) {
      return NextResponse.json(
        { message: "Authorization code is required" },
        { status: 400 }
      );
    }

    // ==========================
    // ZOHO CONFIG
    // ==========================
    const CLIENT_ID =
      "1000.J3CKPA2EZY8R02USWHPEWQVA7NGJJR";

    const CLIENT_SECRET =
      "f90d167c12050cc341e62a3e24cf2c762af0cec441";

    const REDIRECT_URI =
      "https://www.zylker.com/oauthgrant";

    const ORG_ID = "60021258041";

    // ==========================
    // STEP 1: GET ACCESS TOKEN
    // ==========================
    const tokenUrl =
      `https://accounts.zoho.in/oauth/v2/token` +
      `?code=${encodeURIComponent(code)}` +
      `&grant_type=authorization_code` +
      `&client_id=${CLIENT_ID}` +
      `&client_secret=${CLIENT_SECRET}` +
      `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;

    const tokenResponse = await fetch(tokenUrl, {
      method: "POST",
      cache: "no-store",
    });

    const tokenData = await tokenResponse.json();

    if (!tokenData.access_token) {
      return NextResponse.json(
        {
          success: false,
          step: "token_generation",
          response: tokenData,
        },
        { status: 400 }
      );
    }

    const accessToken = tokenData.access_token;

    // ==========================
    // STEP 2: GET TICKETS
    // ==========================
    const ticketResponse = await fetch(
      "https://desk.zoho.in/api/v1/tickets?include=contacts,assignee,departments,team,isRead&limit=100",
      {
        method: "GET",
        cache: "no-store",
        headers: {
          Authorization: `Zoho-oauthtoken ${accessToken}`,
          orgId: ORG_ID,
          Accept: "application/json",
        },
      }
    );

    const ticketData = await ticketResponse.json();

    if (!ticketResponse.ok) {
      return NextResponse.json(
        {
          success: false,
          step: "ticket_fetch",
          response: ticketData,
        },
        { status: ticketResponse.status }
      );
    }

    // Ensure table exists (graceful — won't fail if Zoho sync hasn't run yet)
    await orgQuery(
      orgSlug,
      `CREATE TABLE IF NOT EXISTS zohotable (
        id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        data_name  TEXT        NOT NULL UNIQUE,
        data       JSONB       NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`
    );

    await orgQuery(
      orgSlug,
      `ALTER TABLE zohotable
        ADD COLUMN IF NOT EXISTS data_name TEXT,
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
    );

    await orgQuery(
      orgSlug,
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_zohotable_data_name ON zohotable(data_name)"
    );

    await orgQuery(
      orgSlug,
      `INSERT INTO zohotable (data_name, data, updated_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (data_name) DO UPDATE SET
         data = EXCLUDED.data,
         updated_at = NOW()`,
      ["ticket_data", JSON.stringify(ticketData)]
    );

    const rows = await orgQuery<{ data: any; updated_at: string }>(
      orgSlug,
      "SELECT data, updated_at FROM zohotable WHERE data_name = $1 LIMIT 1",
      ["ticket_data"]
    );

    return NextResponse.json({
      success: true,
      tickets: rows[0]?.data ?? ticketData,
      updatedAt: rows[0]?.updated_at ?? null,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
