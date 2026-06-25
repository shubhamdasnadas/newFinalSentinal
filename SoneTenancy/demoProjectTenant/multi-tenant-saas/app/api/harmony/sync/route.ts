/**
 * POST /api/harmony/sync
 * Thin wrapper — auth + credential extraction, then delegates to lib/sync/harmony.
 * Core sync logic lives in app/lib/sync/harmony.ts so the cron job can call it directly.
 *
 * Body: { token: string, eventTypes?: string[] }
 * Auth: JWT cookie (org must be active)
 */
import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "../../../lib/auth";
import { syncHarmony } from "../../../lib/sync/harmony";

export async function POST(req: NextRequest) {
  try {
    const cookie = req.cookies.get("token")?.value;
    if (!cookie) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = verifyToken(cookie);
    const orgSlug = user.activeOrgSlug || user.orgSlug;
    if (!orgSlug) return NextResponse.json({ error: "No active organization" }, { status: 400 });

    const body = await req.json();
    const { token: harmonyToken, eventTypes } = body as {
      token?: string;
      eventTypes?: string[];
    };

    if (!harmonyToken?.trim()) {
      return NextResponse.json({ error: "Harmony token is required." }, { status: 400 });
    }

    // When called from the browser the caller already has a token — use it directly.
    // The cron path obtains a fresh token itself via clientId/accessKey.
    const { CheckpointEventModel } = await import("../../../models/OrgModels");
    await CheckpointEventModel.ensureTable(orgSlug);

    const CHECKPOINT_EVENTS_URL =
      "https://cloudinfra-gw.in.portal.checkpoint.com/app/hec-api/v1.0/event/query";
    const DEFAULT_EVENT_TYPES = ["phishing", "malware", "dlp"];
    const MAX_PAGES = 200;

    const types = eventTypes ?? DEFAULT_EVENT_TYPES;
    const allRecords: Record<string, unknown>[] = [];
    let scrollId: string | undefined;
    let totalRecordsNumber = 0;
    let page = 0;

    do {
      const requestData: Record<string, unknown> = { eventTypes: types };
      if (scrollId) requestData.scrollId = scrollId;

      const upstream = await fetch(CHECKPOINT_EVENTS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${harmonyToken.trim()}`,
          "x-av-req-id": `harmony-sync-${orgSlug}-page-${page}`,
        },
        body: JSON.stringify({ requestData }),
      });

      const data = await upstream.json().catch(() => null);
      if (!upstream.ok) {
        return NextResponse.json(
          { error: `Checkpoint API failed on page ${page} (${upstream.status})`, detail: data },
          { status: upstream.status }
        );
      }
      if (!data) {
        return NextResponse.json({ error: "Empty response from Checkpoint API" }, { status: 502 });
      }

      const pageRecords = (data.responseData ?? []) as Record<string, unknown>[];
      allRecords.push(...pageRecords);
      if (page === 0) totalRecordsNumber = data.responseEnvelope?.totalRecordsNumber ?? 0;
      scrollId = data.responseEnvelope?.scrollId || undefined;
      page++;
      if (pageRecords.length === 0) break;
    } while (scrollId && page < MAX_PAGES);

    const upserted = await CheckpointEventModel.upsertBatch(orgSlug, allRecords);
    const totalInDb = await CheckpointEventModel.count(orgSlug);

    return NextResponse.json({
      success: true,
      fetched: allRecords.length,
      upserted,
      totalInDb,
      pagesFetched: page,
      totalRecordsNumber,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
