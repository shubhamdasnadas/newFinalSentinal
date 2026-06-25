import { orgQuery } from "../db";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchAllPages(
  baseUrl: string,
  apiToken: string,
  endpoint: string
): Promise<any[]> {
  const all: any[] = [];
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

export interface S1Credentials {
  tokenKey: string;
  baseUrl?: string;
}

export interface S1SyncResult {
  threats: number;
  agents: number;
  syncedAt: string;
}

export async function syncSentinelOne(
  orgSlug: string,
  creds: S1Credentials
): Promise<S1SyncResult> {
  const baseUrl = (creds.baseUrl || process.env.S1_BASE_URL)?.replace(/\/$/, "");
  const apiToken = creds.tokenKey;

  if (!baseUrl || !apiToken) {
    throw new Error(
      "SentinelOne not configured — provide tokenKey/baseUrl or set S1_BASE_URL/S1_API_TOKEN"
    );
  }

  await orgQuery(orgSlug, `
    CREATE TABLE IF NOT EXISTS s1_threats (
      id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      data      JSONB       NOT NULL,
      synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await orgQuery(orgSlug, `
    CREATE TABLE IF NOT EXISTS s1_agents (
      id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      data      JSONB       NOT NULL,
      synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  console.log(`[S1 sync][${orgSlug}] Fetching threats...`);
  const threats = await fetchAllPages(baseUrl, apiToken, "/web/api/v2.1/threats");
  console.log(`[S1 sync][${orgSlug}] Got ${threats.length} threats`);

  console.log(`[S1 sync][${orgSlug}] Fetching agents...`);
  const agents = await fetchAllPages(baseUrl, apiToken, "/web/api/v2.1/agents");
  console.log(`[S1 sync][${orgSlug}] Got ${agents.length} agents`);

  await orgQuery(orgSlug, "TRUNCATE TABLE s1_threats");
  for (const t of threats) {
    await orgQuery(orgSlug, "INSERT INTO s1_threats (data) VALUES ($1::jsonb)", [
      JSON.stringify(t),
    ]);
  }

  await orgQuery(orgSlug, "TRUNCATE TABLE s1_agents");
  for (const a of agents) {
    await orgQuery(orgSlug, "INSERT INTO s1_agents (data) VALUES ($1::jsonb)", [
      JSON.stringify(a),
    ]);
  }

  console.log(`[S1 sync][${orgSlug}] Done.`);
  return { threats: threats.length, agents: agents.length, syncedAt: new Date().toISOString() };
}
