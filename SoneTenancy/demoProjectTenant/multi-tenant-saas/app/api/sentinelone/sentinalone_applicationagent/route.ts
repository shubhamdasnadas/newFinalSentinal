/**
 * GET /api/sentinelone/risks-applications
 * Fetches ALL application risk applications with pagination + 429 retry handling.
 */
import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "../../../lib/auth";
// ✅ ADDED: import model for DB storage
import { SentinelOneModel } from "../../../models/OrgModels";

function getOrgSlug(user: any): string | null {
  return user.activeOrgSlug || user.orgSlug || null;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const user = verifyToken(token);
    const orgSlug = getOrgSlug(user);
    if (!orgSlug) return NextResponse.json({ message: "No active organization" }, { status: 400 });

    const baseUrl = process.env.S1_BASE_URL;

    // ✅ CHANGED: Read accountId from query param, apiToken from header (user-supplied)
    const { searchParams } = new URL(req.url);
    const accountId =
      searchParams.get("accountId") ||
      process.env.S1_ACCOUNT_ID ||
      "2099936112556801909";

    const apiToken =
      req.headers.get("x-s1-token") || process.env.S1_API_TOKEN;

    if (!baseUrl || !apiToken) {
      return NextResponse.json(
        { message: "SentinelOne not configured — S1_BASE_URL or S1_API_TOKEN missing in .env.local" },
        { status: 503 }
      );
    }

    const cleanBase = baseUrl.replace(/\/$/, "");

    let allData: any[] = [];
    let nextCursor: string | null = null;
    let totalItems = 0;

    do {
      const url = new URL(`${cleanBase}/web/api/v2.1/application-management/risks/applications`);

      url.searchParams.set("accountIds", accountId);
      url.searchParams.set("limit", "50");

      if (nextCursor) {
        url.searchParams.set("cursor", nextCursor);
      }

      let response: Response | null = null;
      let retryCount = 0;
      const maxRetries = 5;

      while (retryCount <= maxRetries) {
        console.log(`[S1] Fetching attempt ${retryCount + 1}:`, url.toString());

        response = await fetch(url.toString(), {
          method: "GET",
          headers: {
            Authorization: `ApiToken ${apiToken}`,
            Accept: "application/json",
            "Content-Type": "application/json",
          },
        });

        if (response.status !== 429) break;

        const retryAfter = response.headers.get("retry-after");
        const waitMs = retryAfter
          ? Number(retryAfter) * 1000
          : Math.min(30000, 3000 * Math.pow(2, retryCount));

        console.warn(`[S1] 429 Too Many Requests. Waiting ${waitMs}ms...`);

        await sleep(waitMs);
        retryCount++;
      }

      if (!response) {
        return NextResponse.json(
          { message: "SentinelOne API request failed before response" },
          { status: 500 }
        );
      }

      if (!response.ok) {
        const body = await response.text();

        return NextResponse.json(
          {
            message: `SentinelOne API returned ${response.status}`,
            detail: body.slice(0, 500),
            fetchedItems: allData.length,
          },
          { status: response.status }
        );
      }

      const result = await response.json();

      const pageData = result?.data || [];
      allData = [...allData, ...pageData];

      totalItems = result?.pagination?.totalItems ?? allData.length;
      nextCursor = result?.pagination?.nextCursor || null;

      console.log(`[S1] Page fetched: ${pageData.length}, Total: ${allData.length}/${totalItems}`);

      await sleep(1000);
    } while (nextCursor);

    // ✅ ADDED: Store fetched risk applications into DB
    if (allData.length > 0) {
      await SentinelOneModel.upsertRiskApplications(orgSlug, allData);
    }

    return NextResponse.json({
      data: allData,
      pagination: {
        totalItems,
        returnedItems: allData.length,
        nextCursor: null,
      },
    });
  } catch (error: any) {
    console.error("[S1] Fetch error:", error.message);

    return NextResponse.json(
      { message: `SentinelOne fetch failed: ${error.message}` },
      { status: 500 }
    );
  }
}