/**
 * GET /api/Paloalto/sentinalone_agentinfo
 * Fetches ALL agents from Paloalto API using pagination cursor.
 */
import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "../../../lib/auth";

function getOrgSlug(user: any): string | null {
  return user.activeOrgSlug || user.orgSlug || null;
}

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const user = verifyToken(token);
    const orgSlug = getOrgSlug(user);
    if (!orgSlug) return NextResponse.json({ message: "No active organization" }, { status: 400 });

    const baseUrl = process.env.FIREWALL_BASE_URL;
    const apiToken = process.env.FIREWALL_API_KEY;

    if (!baseUrl || !apiToken) {
      return NextResponse.json(
        { message: "Paloalto not configured — S1_BASE_URL or S1_API_TOKEN missing in .env.local" },
        { status: 503 }
      );
    }

    const cleanBase = baseUrl.replace(/\/$/, "");
    const accountId = "2099936112556801909";

    let allData: any[] = [];
    let nextCursor: string | null = null;

    do {
      const url = new URL(`${cleanBase}/api/?type=report&reporttype=predefined&reportname=top-attacks&period=last-24-hours&key=${apiToken}`);
    //   url.searchParams.set("accountIds", accountId);
      url.searchParams.set("limit", "100");
      if (nextCursor) url.searchParams.set("cursor", nextCursor);

      const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
        //   Authorization: `Bearer ${apiToken}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const body = await response.text();
        return NextResponse.json(
          { message: `Paloalto API returned ${response.status}`, detail: body.slice(0, 300) },
          { status: response.status }
        );
      }

      const result = await response.json();
      allData = [...allData, ...(result?.data || [])];
      nextCursor = result?.pagination?.nextCursor || null;
    } while (nextCursor);

    return NextResponse.json({
      data: allData,
      pagination: { totalItems: allData.length, nextCursor: null },
    });
  } catch (error: any) {
    return NextResponse.json(
      { message: `Paloalto fetch failed: ${error.message}` },
      { status: 500 }
    );
  }
}
