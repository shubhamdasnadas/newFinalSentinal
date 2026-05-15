/**
 * POST /api/sync-all
 *
 * One-shot endpoint that syncs ALL integrations into the org database:
 *   1. SentinelOne threats  → s1_threats
 *   2. SentinelOne agents   → s1_agents
 *   3. Checkpoint Harmony   → checkpoint_events  (requires harmonyClientId + harmonyAccessKey in body)
 *
 * Body (optional): { harmonyClientId?: string, harmonyAccessKey?: string }
 * Auth: JWT cookie
 */
import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "../../lib/auth";
import { orgQuery } from "../../lib/db";
import { CheckpointEventModel } from "../../models/OrgModels";

// ─── helpers ─────────────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchAllPagesCursor(
  baseUrl: string,
  apiToken: string,
  endpoint: string
): Promise<unknown[]> {
  const all: unknown[] = [];
  let cursor: string | null = null;

  do {
    const url = new URL(`${baseUrl}${endpoint}`);
    url.searchParams.set("limit", "100");
    if (cursor) url.searchParams.set("cursor", cursor);

    let res: Response | null = null;
    for (let retry = 0; retry <= 5; retry++) {
      res = await fetch(url.toString(), {
        headers: { Authorization: `ApiToken ${apiToken}`, Accept: "application/json" },
      });
      if (res.status !== 429) break;
      const wait = Number(res.headers.get("retry-after") || 0) * 1000 || 3000 * Math.pow(2, retry);
      await sleep(wait);
    }

    if (!res || !res.ok) {
      const body = await res?.text();
      throw new Error(`S1 API ${res?.status}: ${body?.slice(0, 200)}`);
    }

    const json = await res.json();
    all.push(...(json?.data ?? []));
    cursor = json?.pagination?.nextCursor ?? null;
    if (cursor) await sleep(300);
  } while (cursor);

  return all;
}

async function getHarmonyToken(clientId: string, accessKey: string): Promise<string> {
  const res = await fetch("https://cloudinfra-gw.in.portal.checkpoint.com/auth/external", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId, accessKey }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`Harmony auth failed (${res.status}): ${JSON.stringify(data)}`);
  const token = data?.data?.token ?? data?.token ?? data?.access_token;
  if (!token) throw new Error("No token returned from Harmony auth");
  return token;
}

async function syncHarmonyEvents(
  orgSlug: string,
  harmonyToken: string
): Promise<{ fetched: number; upserted: number }> {
  const CHECKPOINT_EVENTS_URL =
    "https://cloudinfra-gw.in.portal.checkpoint.com/app/hec-api/v1.0/event/query";
  const DEFAULT_EVENT_TYPES = ["phishing", "malware", "dlp"];
  const MAX_PAGES = 200;

  await CheckpointEventModel.ensureTable(orgSlug);

  const allRecords: Record<string, unknown>[] = [];
  let scrollId: string | undefined;
  let page = 0;

  do {
    const requestData: Record<string, unknown> = { eventTypes: DEFAULT_EVENT_TYPES };
    if (scrollId) requestData.scrollId = scrollId;

    const upstream = await fetch(CHECKPOINT_EVENTS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${harmonyToken}`,
        "x-av-req-id": `sync-all-${orgSlug}-page-${page}`,
      },
      body: JSON.stringify({ requestData }),
    });

    const data = await upstream.json().catch(() => null);
    if (!upstream.ok) throw new Error(`Checkpoint API failed (${upstream.status})`);
    if (!data) throw new Error("Empty response from Checkpoint API");

    const pageRecords = (data.responseData ?? []) as Record<string, unknown>[];
    allRecords.push(...pageRecords);
    scrollId = data.responseEnvelope?.scrollId || undefined;
    page++;
    if (pageRecords.length === 0) break;
  } while (scrollId && page < MAX_PAGES);

  const upserted = await CheckpointEventModel.upsertBatch(orgSlug, allRecords);
  return { fetched: allRecords.length, upserted };
}

// ─── route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const jwtToken = req.cookies.get("token")?.value;
    if (!jwtToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = verifyToken(jwtToken);
    const orgSlug = user.activeOrgSlug || user.orgSlug;
    if (!orgSlug) return NextResponse.json({ error: "No active organization" }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const { harmonyClientId, harmonyAccessKey } = body as {
      harmonyClientId?: string;
      harmonyAccessKey?: string;
    };

    const results: Record<string, unknown> = {};

    // ── 1. SentinelOne ────────────────────────────────────────────────────────
    const s1BaseUrl = process.env.S1_BASE_URL?.replace(/\/$/, "");
    const s1ApiToken = process.env.S1_API_TOKEN;

    if (!s1BaseUrl || !s1ApiToken) {
      results.sentinelone = { status: "skipped", reason: "S1_BASE_URL or S1_API_TOKEN not set" };
    } else {
      try {
        // Ensure tables
        await orgQuery(orgSlug, `
          CREATE TABLE IF NOT EXISTS s1_threats (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            data JSONB NOT NULL,
            synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
          CREATE TABLE IF NOT EXISTS s1_agents (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            data JSONB NOT NULL,
            synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
        `);

        const [threats, agents] = await Promise.all([
          fetchAllPagesCursor(s1BaseUrl, s1ApiToken, "/web/api/v2.1/threats"),
          fetchAllPagesCursor(s1BaseUrl, s1ApiToken, "/web/api/v2.1/agents"),
        ]);

        // Save threats
        await orgQuery(orgSlug, "TRUNCATE TABLE s1_threats");
        for (const t of threats) {
          await orgQuery(orgSlug, "INSERT INTO s1_threats (data) VALUES ($1::jsonb)", [JSON.stringify(t)]);
        }

        // Save agents
        await orgQuery(orgSlug, "TRUNCATE TABLE s1_agents");
        for (const a of agents) {
          await orgQuery(orgSlug, "INSERT INTO s1_agents (data) VALUES ($1::jsonb)", [JSON.stringify(a)]);
        }

        results.sentinelone = { status: "ok", threats: threats.length, agents: agents.length };
      } catch (err: unknown) {
        results.sentinelone = { status: "error", error: err instanceof Error ? err.message : String(err) };
      }
    }

    // ── 2. Checkpoint Harmony ─────────────────────────────────────────────────
    const clientId = harmonyClientId?.trim() || "";
    const accessKey = harmonyAccessKey?.trim() || "";

    if (!clientId || !accessKey) {
      results.checkpoint = { status: "skipped", reason: "harmonyClientId and harmonyAccessKey required in request body" };
    } else {
      try {
        const harmonyToken = await getHarmonyToken(clientId, accessKey);
        const { fetched, upserted } = await syncHarmonyEvents(orgSlug, harmonyToken);
        const totalInDb = await CheckpointEventModel.count(orgSlug);
        results.checkpoint = { status: "ok", fetched, upserted, totalInDb };
      } catch (err: unknown) {
        results.checkpoint = { status: "error", error: err instanceof Error ? err.message : String(err) };
      }
    }

    const allOk = Object.values(results).every((r: any) => r.status === "ok" || r.status === "skipped");

    return NextResponse.json({
      success: allOk,
      orgSlug,
      results,
      syncedAt: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
