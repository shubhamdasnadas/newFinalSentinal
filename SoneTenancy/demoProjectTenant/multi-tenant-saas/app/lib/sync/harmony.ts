import { CheckpointEventModel } from "../../models/OrgModels";

const CHECKPOINT_AUTH_URL =
  "https://cloudinfra-gw.in.portal.checkpoint.com/auth/external";
const CHECKPOINT_EVENTS_URL =
  "https://cloudinfra-gw.in.portal.checkpoint.com/app/hec-api/v1.0/event/query";

const DEFAULT_EVENT_TYPES = ["phishing", "malware", "dlp"];
const MAX_PAGES = 200;

export interface HarmonyCredentials {
  clientId: string;
  accessKey: string;
}

export interface HarmonySyncResult {
  fetched: number;
  upserted: number;
  totalInDb: number;
  syncedAt: string;
}

async function getHarmonyToken(clientId: string, accessKey: string): Promise<string> {
  const res = await fetch(CHECKPOINT_AUTH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId: clientId.trim(), accessKey: accessKey.trim() }),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(`Harmony auth failed (${res.status}): ${JSON.stringify(data)}`);
  }

  const token: string | undefined =
    data?.data?.token ?? data?.token ?? data?.access_token;
  if (!token) {
    throw new Error("No token returned from Checkpoint auth endpoint");
  }
  return token;
}

export async function syncHarmony(
  orgSlug: string,
  creds: HarmonyCredentials,
  eventTypes: string[] = DEFAULT_EVENT_TYPES
): Promise<HarmonySyncResult> {
  const harmonyToken = await getHarmonyToken(creds.clientId, creds.accessKey);

  await CheckpointEventModel.ensureTable(orgSlug);

  const allRecords: Record<string, unknown>[] = [];
  let scrollId: string | undefined;
  let page = 0;

  do {
    const requestData: Record<string, unknown> = { eventTypes };
    if (scrollId) requestData.scrollId = scrollId;

    const upstream = await fetch(CHECKPOINT_EVENTS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${harmonyToken}`,
        "x-av-req-id": `harmony-cron-${orgSlug}-page-${page}`,
      },
      body: JSON.stringify({ requestData }),
    });

    const data = await upstream.json().catch(() => null);

    if (!upstream.ok) {
      throw new Error(
        `Checkpoint API failed on page ${page} (${upstream.status}): ${JSON.stringify(data)}`
      );
    }
    if (!data) throw new Error("Empty response from Checkpoint API");

    const pageRecords = (data.responseData ?? []) as Record<string, unknown>[];
    allRecords.push(...pageRecords);
    scrollId = data.responseEnvelope?.scrollId || undefined;
    page++;
    if (pageRecords.length === 0) break;
  } while (scrollId && page < MAX_PAGES);

  const upserted = await CheckpointEventModel.upsertBatch(orgSlug, allRecords);
  const totalInDb = await CheckpointEventModel.count(orgSlug);

  console.log(`[Harmony sync][${orgSlug}] Fetched ${allRecords.length}, upserted ${upserted}`);
  return {
    fetched: allRecords.length,
    upserted,
    totalInDb,
    syncedAt: new Date().toISOString(),
  };
}
