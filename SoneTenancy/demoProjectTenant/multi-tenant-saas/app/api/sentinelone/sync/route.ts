/**
 * POST /api/sentinelone/sync
 * Pulls threats + agents from the SentinelOne API and stores them
 * in the org-specific PostgreSQL database.
 * The dashboard reads from DB — this is the only place that calls S1 directly.
 */
import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "../../../lib/auth";
import { orgQuery } from "../../../lib/db";

function getOrgSlug(user: any): string | null {
  return user.activeOrgSlug || user.orgSlug || null;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
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
      const wait = Number(res.headers.get("retry-after") || 0) * 1000 || 3000 * Math.pow(2, retry);
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

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const user = verifyToken(token);
    const orgSlug = getOrgSlug(user);
    if (!orgSlug) return NextResponse.json({ message: "No active organization" }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const baseUrl = (body.baseUrl || process.env.S1_BASE_URL)?.replace(/\/$/, "");
    const apiToken = body.tokenKey || process.env.S1_API_TOKEN;

    if (!baseUrl || !apiToken) {
      return NextResponse.json(
        { message: "SentinelOne not configured — provide tokenKey/baseUrl in body or set S1_BASE_URL/S1_API_TOKEN" },
        { status: 503 }
      );
    }

    // Ensure tables exist
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

    // ── Fetch threats from S1 API ─────────────────────────────────────────────
    console.log("[S1 sync] Fetching threats...");
    const threats = await fetchAllPages(baseUrl, apiToken, "/web/api/v2.1/threats");
    console.log(`[S1 sync] Got ${threats.length} threats`);

    // ── Fetch agents from S1 API ──────────────────────────────────────────────
    console.log("[S1 sync] Fetching agents...");
    const agents = await fetchAllPages(baseUrl, apiToken, "/web/api/v2.1/agents");
    console.log(`[S1 sync] Got ${agents.length} agents`);

    // ── Save threats to DB (truncate + insert) ───────────────────────────────
    await orgQuery(orgSlug, "TRUNCATE TABLE s1_threats");
    for (const t of threats) {
      await orgQuery(
        orgSlug,
        "INSERT INTO s1_threats (data) VALUES ($1::jsonb)",
        [JSON.stringify(t)]
      );
    }

    // ── Save agents to DB ─────────────────────────────────────────────────────
    await orgQuery(orgSlug, "TRUNCATE TABLE s1_agents");
    for (const a of agents) {
      await orgQuery(
        orgSlug,
        "INSERT INTO s1_agents (data) VALUES ($1::jsonb)",
        [JSON.stringify(a)]
      );
    }

    console.log("[S1 sync] Done.");

    return NextResponse.json({
      message: `Synced ${threats.length} threats and ${agents.length} agents to database`,
      threats: threats.length,
      agents: agents.length,
      syncedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[S1 sync] Error:", error.message);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
