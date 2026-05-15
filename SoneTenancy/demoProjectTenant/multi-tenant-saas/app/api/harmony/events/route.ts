/**
 * POST /api/harmony/events
 *
 * Proxies the Check Point Harmony Email & Collaboration event-query request.
 * Accepts { token, eventTypes?, startDate?, endDate? } and returns ALL records
 * by automatically paginating with scrollId until every page is fetched.
 *
 * Check Point returns up to 100 records per page. The response envelope contains:
 *   responseEnvelope.scrollId        — pass this back to get the next page
 *   responseEnvelope.totalRecordsNumber — total records available
 *   responseEnvelope.recordsNumber   — records in this page
 */

import { NextRequest, NextResponse } from "next/server";

const CHECKPOINT_EVENTS_URL =
  "https://cloudinfra-gw.in.portal.checkpoint.com/app/hec-api/v1.0/event/query";

const DEFAULT_EVENT_TYPES = [
  "phishing",
  "malware",
  // "suspicious_malware",
  // "suspicious_phishing",
  "dlp",
];

// Safety cap — prevents infinite loops if the API misbehaves
const MAX_PAGES = 200;

interface CheckPointEnvelope {
  responseCode: number;
  responseText?: string;
  recordsNumber: number;
  totalRecordsNumber: number;
  scrollId?: string;
}

interface CheckPointResponse {
  responseEnvelope: CheckPointEnvelope;
  responseData: unknown[];
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      token,
      eventTypes = DEFAULT_EVENT_TYPES,
      startDate,
      endDate,
    } = body as {
      token?: string;
      eventTypes?: string[];
      startDate?: string;
      endDate?: string;
    };

    if (!token?.trim()) {
      return NextResponse.json({ error: "token is required." }, { status: 400 });
    }

    const allRecords: unknown[] = [];
    let scrollId: string | undefined = undefined;
    let totalRecordsNumber = 0;
    let page = 0;

    // ── Paginate until scrollId is absent or we hit the safety cap ────────────
    do {
      const requestData: Record<string, unknown> = { eventTypes };
      if (startDate) requestData.startDate = startDate;
      if (endDate) requestData.endDate = endDate;
      if (scrollId) requestData.scrollId = scrollId;

      const upstream = await fetch(CHECKPOINT_EVENTS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token.trim()}`,
          // x-av-req-id must be unique per request
          "x-av-req-id": `kiro-harmony-sync-page-${page}`,
        },
        body: JSON.stringify({ requestData }),
      });

      const data: CheckPointResponse | null = await upstream
        .json()
        .catch(() => null);

      if (!upstream.ok) {
        return NextResponse.json(
          {
            error: `Event query failed on page ${page} (${upstream.status})`,
            detail: data,
            recordsFetchedSoFar: allRecords.length,
          },
          { status: upstream.status }
        );
      }

      if (!data) {
        return NextResponse.json(
          { error: "Empty response from Check Point API.", page },
          { status: 502 }
        );
      }

      const pageRecords = data.responseData ?? [];
      allRecords.push(...pageRecords);

      // Capture total on first page
      if (page === 0) {
        totalRecordsNumber = data.responseEnvelope?.totalRecordsNumber ?? 0;
      }

      scrollId = data.responseEnvelope?.scrollId || undefined;
      page++;

      // Stop if this page returned nothing (defensive guard)
      if (pageRecords.length === 0) break;
    } while (scrollId && page < MAX_PAGES);

    return NextResponse.json({
      responseEnvelope: {
        totalRecordsNumber,
        recordsNumber: allRecords.length,
        pagesFetched: page,
      },
      responseData: allRecords,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
