/**
 * POST /api/harmony/sync
 *
 * Fetches ALL events from the Checkpoint Harmony API (paginated) and
 * upserts them into the calling org's `checkpoint_events` table.
 *
 * Body: { token: string, eventTypes?: string[] }
 * Auth: JWT cookie (org must be active)
 */
import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "../../../lib/auth";
import { CheckpointEventModel } from "../../../models/OrgModels";

const CHECKPOINT_EVENTS_URL =
  "https://cloudinfra-gw.in.portal.checkpoint.com/app/hec-api/v1.0/event/query";

const DEFAULT_EVENT_TYPES = ["phishing", "malware", "dlp"];
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
  responseData: Record<string, unknown>[];
}

export async function POST(req: NextRequest) {
  try {
    // ── Auth ────────────────────────────────────────────────────────────────
    const token = req.cookies.get("token")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = verifyToken(token);
    const orgSlug = user.activeOrgSlug || user.orgSlug;
    if (!orgSlug) return NextResponse.json({ error: "No active organization" }, { status: 400 });

    // ── Body ────────────────────────────────────────────────────────────────
    const body = await req.json();
    const {
      token: harmonyToken,
      eventTypes = DEFAULT_EVENT_TYPES,
    } = body as { token?: string; eventTypes?: string[] };

    if (!harmonyToken?.trim()) {
      return NextResponse.json({ error: "Harmony token is required." }, { status: 400 });
    }

    // ── Ensure table exists (idempotent) ────────────────────────────────────
    await CheckpointEventModel.ensureTable(orgSlug);

    // ── Paginate Checkpoint API ─────────────────────────────────────────────
    const allRecords: Record<string, unknown>[] = [];
    let scrollId: string | undefined;
    let totalRecordsNumber = 0;
    let page = 0;

    do {
      const requestData: Record<string, unknown> = { eventTypes };
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

      const data: CheckPointResponse | null = await upstream.json().catch(() => null);

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

    // ── Upsert into org DB ──────────────────────────────────────────────────
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
