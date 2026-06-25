/**
 * POST /api/firewall/collect
 * Thin wrapper — auth + credential extraction, then delegates to lib/sync/firewall.
 * Core sync logic lives in app/lib/sync/firewall.ts so the cron job can call it directly.
 */
import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "../../../lib/auth";
import { orgQuery } from "../../../lib/db";
import { syncFirewall } from "../../../lib/sync/firewall";

function getOrgSlug(user: any): string | null {
  return user.activeOrgSlug || user.orgSlug || null;
}

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const user = verifyToken(token);
    const orgSlug = getOrgSlug(user);
    if (!orgSlug) return NextResponse.json({ message: "No active organization" }, { status: 400 });

    // Credentials: body → org DB → env vars
    const body = await req.json().catch(() => ({}));
    let baseUrl: string | undefined = body.baseUrl;
    let apiKey: string | undefined = body.apiKey;

    if (!baseUrl || !apiKey) {
      const rows = await orgQuery<{ credentials: { baseUrl: string; apiKey: string } }>(
        orgSlug,
        "SELECT credentials FROM integration_credentials WHERE integration = 'firewall' LIMIT 1"
      ).catch(() => [] as { credentials: { baseUrl: string; apiKey: string } }[]);
      const creds = rows[0]?.credentials;
      if (!baseUrl) baseUrl = creds?.baseUrl;
      if (!apiKey) apiKey = creds?.apiKey;
    }

    baseUrl = baseUrl || process.env.FIREWALL_BASE_URL;
    apiKey = apiKey || process.env.FIREWALL_API_KEY;

    if (!baseUrl || !apiKey) {
      return NextResponse.json(
        { message: "Firewall not configured — save credentials in Settings or set FIREWALL_BASE_URL/FIREWALL_API_KEY" },
        { status: 503 }
      );
    }

    const result = await syncFirewall(orgSlug, { baseUrl, apiKey });

    return NextResponse.json({
      message: `Saved ${result.success}/${result.total} reports to PostgreSQL`,
      ...result,
    });
  } catch (error: any) {
    console.error("[FW] Collection error:", error.message);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
