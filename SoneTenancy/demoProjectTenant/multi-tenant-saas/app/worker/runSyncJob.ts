import { orgQuery } from "../lib/db";

import {
  claimNextPendingJob,
  markJobCompleted,
  markJobFailed,
  SyncSource,
} from "../lib/syncJobs";

import { SentinelOneModel, CheckpointEventModel } from "../models/OrgModels";
import { OrgModel } from "../models/Organization";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// Helper to load credentials from org DB (integration_credentials table)
async function getIntegrationCredentials(orgSlug: string, integration: string) {
  await orgQuery(
    orgSlug,
    `CREATE TABLE IF NOT EXISTS integration_credentials (
      integration TEXT PRIMARY KEY,
      credentials JSONB NOT NULL,
      token TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`
  );

  const rows = await orgQuery<{ credentials: any; token: string | null }>(
    orgSlug,
    `SELECT credentials, token
     FROM integration_credentials
     WHERE integration = $1
     LIMIT 1`,
    [integration]
  );
  if (!rows[0]) return null;
  return rows[0];
}

async function fetchAllPages(
  baseUrl: string,
  apiToken: string,
  endpoint: string,
  extraParams: Record<string, string> = {}
): Promise<any[]> {
  const all: any[] = [];
  let cursor: string | null = null;

  do {
    const url = new URL(`${baseUrl}${endpoint}`);
    url.searchParams.set("limit", "100");
    for (const [k, v] of Object.entries(extraParams)) url.searchParams.set(k, v);
    if (cursor) url.searchParams.set("cursor", cursor);

    let res: Response | null = null;
    for (let retry = 0; retry <= 5; retry++) {
      res = await fetch(url.toString(), {
        headers: { Authorization: `ApiToken ${apiToken}`, Accept: "application/json" },
      });
      if (res.status !== 429) break;
      const wait =
        Number(res.headers.get("retry-after") || 0) * 1000 ||
        3000 * Math.pow(2, retry);
      console.warn(`[S1 sync] 429 — waiting ${wait}ms`);
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

const CHECKPOINT_EVENTS_URL =
  "https://cloudinfra-gw.in.portal.checkpoint.com/app/hec-api/v1.0/event/query";

async function getHarmonyToken(clientId: string, accessKey: string): Promise<string> {
  const res = await fetch(
    "https://cloudinfra-gw.in.portal.checkpoint.com/auth/external",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, accessKey }),
    }
  );

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(`Harmony auth failed (${res.status}): ${JSON.stringify(data)}`);
  }

  const token: string | undefined =
    data?.data?.token ?? data?.token ?? data?.access_token;

  if (!token) throw new Error("No token returned from Harmony auth");
  return token;
}

async function runHarmonySync(orgSlug: string, harmonyToken: string) {
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
        "x-av-req-id": `worker-harmony-${orgSlug}-page-${page}`,
      },
      body: JSON.stringify({ requestData }),
    });

    const data: any = await upstream.json().catch(() => null);
    if (!upstream.ok) throw new Error(`Checkpoint API failed (${upstream.status})`);
    if (!data) throw new Error("Empty response from Checkpoint API");

    const pageRecords = (data.responseData ?? []) as Record<string, unknown>[];
    allRecords.push(...pageRecords);

    scrollId = data.responseEnvelope?.scrollId || undefined;
    page++;

    if (pageRecords.length === 0) break;
  } while (scrollId && page < MAX_PAGES);

  await CheckpointEventModel.upsertBatch(orgSlug, allRecords);
}

async function runSentinelOneSync(orgSlug: string, extra?: any) {
  const row = await getIntegrationCredentials(orgSlug, "sentinelone");
  if (!row?.credentials) throw new Error("SentinelOne credentials not set");

  const baseUrl = (
    extra?.baseUrl ||
    row.credentials.baseUrl ||
    row.credentials.s1BaseUrl ||
    process.env.S1_BASE_URL
  )?.replace(/\/$/, "");

  const apiToken = (
    extra?.tokenKey ||
    row.credentials.tokenKey ||
    row.credentials.apiToken ||
    process.env.S1_API_TOKEN
  );

  if (!baseUrl || !apiToken) throw new Error("SentinelOne not configured (baseUrl/tokenKey)");

  await SentinelOneModel.ensureTables(orgSlug);

  const threats = await fetchAllPages(baseUrl, apiToken, "/web/api/v2.1/threats");
  const agents = await fetchAllPages(baseUrl, apiToken, "/web/api/v2.1/agents");

  await SentinelOneModel.upsertThreats(orgSlug, threats);
  await SentinelOneModel.upsertAgents(orgSlug, agents);
}

async function executeSourceSync(orgSlug: string, source: SyncSource, extra?: any) {
  switch (source) {
    case "sentinelone":
      await runSentinelOneSync(orgSlug, extra);
      return;
    case "harmony": {
      const row = await getIntegrationCredentials(orgSlug, "harmony");
      if (!row?.credentials) throw new Error("Harmony credentials not set");

      const clientId = row.credentials.clientId || row.credentials.client_id;
      const accessKey = row.credentials.accessKey || row.credentials.access_key;
      if (!clientId || !accessKey) throw new Error("Harmony clientId/accessKey missing");

      const harmonyToken = await getHarmonyToken(String(clientId), String(accessKey));
      await runHarmonySync(orgSlug, harmonyToken);
      return;
    }
    default:
      throw new Error(`Source sync not implemented: ${source}`);
  }
}

export async function processJobsForOrg(orgSlug: string) {
  const job = await claimNextPendingJob(orgSlug);
  if (!job) return;

  try {
    await executeSourceSync(orgSlug, job.source as SyncSource, job.extra);
    await markJobCompleted(orgSlug, job.id);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await markJobFailed(orgSlug, job.id, msg);
  }
}


