/**
 * GET /api/sentinelone/threats
 * Fetches ALL threats with stable pagination + retry handling.
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

async function fetchWithRetry(url: string, apiToken: string) {
  const maxRetries = 6;

  for (let retry = 0; retry <= maxRetries; retry++) {
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      headers: {
        Authorization: `ApiToken ${apiToken}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    });

    if (response.status !== 429) return response;

    const retryAfter = response.headers.get("retry-after");
    const waitMs = retryAfter
      ? Number(retryAfter) * 1000
      : Math.min(60000, 3000 * Math.pow(2, retry));

    console.warn(`[S1] 429 Rate limit. Waiting ${waitMs}ms...`);
    await sleep(waitMs);
  }

  throw new Error("SentinelOne API rate limit retries exceeded");
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

    // ✅ CHANGED: Read accountId from query param, apiToken from header (user-supplied)
    const { searchParams } = new URL(req.url);
    const accountId =
      searchParams.get("accountId") ||
      process.env.S1_ACCOUNT_ID ||
      "2099936112556801909";

    const apiToken =
      req.headers.get("x-s1-token") || process.env.S1_API_TOKEN;

    const baseUrl = process.env.S1_BASE_URL;

    if (!baseUrl || !apiToken) {
      return NextResponse.json(
        { message: "SentinelOne not configured — S1_BASE_URL or S1_API_TOKEN missing" },
        { status: 503 }
      );
    }

    const cleanBase = baseUrl.replace(/\/$/, "");

    const allData: any[] = [];
    const seenCursors = new Set<string>();

    let nextCursor: string | null = null;
    let totalItems = 0;
    let page = 1;

    while (true) {
      const url = new URL(`${cleanBase}/web/api/v2.1/threats`);

      url.searchParams.set("accountIds", accountId);
      url.searchParams.set("limit", "20");

      if (nextCursor) {
        url.searchParams.set("cursor", nextCursor);
      }

      console.log(`[S1] Page ${page}:`, url.toString());

      const response = await fetchWithRetry(url.toString(), apiToken);

      if (!response.ok) {
        const body = await response.text();

        return NextResponse.json(
          {
            success: false,
            message: `SentinelOne API returned ${response.status}`,
            detail: body.slice(0, 1000),
            fetchedSoFar: allData.length,
          },
          { status: response.status }
        );
      }

      const result = await response.json();

      const pageData = Array.isArray(result?.data) ? result.data : [];
      allData.push(...pageData);

      totalItems =
        result?.pagination?.totalItems ??
        result?.pagination?.total ??
        totalItems;

      const cursorFromResponse =
        result?.pagination?.nextCursor ??
        result?.pagination?.cursor ??
        null;

      console.log("[S1] Pagination:", result?.pagination);
      console.log(
        `[S1] Page ${page}: ${pageData.length} records | Total fetched: ${allData.length}/${totalItems}`
      );

      if (!cursorFromResponse) break;

      if (seenCursors.has(cursorFromResponse)) {
        console.warn("[S1] Duplicate cursor detected. Stopping to avoid infinite loop.");
        break;
      }

      seenCursors.add(cursorFromResponse);
      nextCursor = cursorFromResponse;

      page++;
      await sleep(1500);
    }

    // ✅ ADDED: Store fetched threats into DB
    if (allData.length > 0) {
      await SentinelOneModel.upsertThreats(orgSlug, allData);
    }

    return NextResponse.json({
      success: true,
      data: allData,
      pagination: {
        totalItems,
        returnedItems: allData.length,
        completed: totalItems ? allData.length >= totalItems : true,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: `SentinelOne fetch failed: ${error.message}`,
      },
      { status: 500 }
    );
  }
}