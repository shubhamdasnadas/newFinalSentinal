/**
 * POST /api/cron/sync
 *
 * Server-side background sync for all active organizations.
 * Called by an external scheduler (Vercel Cron, system cron, GitHub Actions) —
 * no user session required.
 *
 * Authentication: Authorization: Bearer <CRON_SECRET>
 *
 * For each active org it:
 *   1. Fetches stored integration credentials from that org's database
 *   2. Runs whichever syncs have credentials configured
 *   3. Isolates errors per org so one failure never aborts the rest
 *
 * To trigger manually during development:
 *   curl -X POST http://localhost:3000/api/cron/sync \
 *     -H "Authorization: Bearer <your-CRON_SECRET>"
 */
import { NextRequest, NextResponse } from "next/server";
import { OrgModel } from "../../../models/Organization";
import { orgQuery } from "../../../lib/db";
import { syncSentinelOne } from "../../../lib/sync/sentinelone";
import { syncHarmony } from "../../../lib/sync/harmony";
import { syncFirewall } from "../../../lib/sync/firewall";

interface IntegrationCredentialRow {
  integration: string;
  credentials: Record<string, string>;
  token?: string | null;
}

async function getOrgCredentials(orgSlug: string) {
  try {
    const rows = await orgQuery<IntegrationCredentialRow>(
      orgSlug,
      "SELECT integration, credentials, token FROM integration_credentials"
    );
    return rows;
  } catch {
    return [];
  }
}

type OrgResult =
  | { status: "skipped"; reason: string }
  | { status: "success"; integrations: Record<string, unknown> }
  | { status: "error"; error: string };

async function syncOrg(orgSlug: string): Promise<OrgResult> {
  const credRows = await getOrgCredentials(orgSlug);
  if (credRows.length === 0) {
    return { status: "skipped", reason: "no credentials configured" };
  }

  const byIntegration = Object.fromEntries(
    credRows.map((r) => [r.integration, { ...r.credentials, token: r.token }])
  );

  const integrations: Record<string, unknown> = {};

  // ── SentinelOne ────────────────────────────────────────────────────────────
  const s1 = byIntegration["sentinelone"];
  if (s1?.tokenKey) {
    try {
      integrations.sentinelone = await syncSentinelOne(orgSlug, {
        tokenKey: s1.tokenKey,
        baseUrl: s1.baseUrl,
      });
    } catch (err: any) {
      console.error(`[cron][${orgSlug}] SentinelOne sync failed:`, err.message);
      integrations.sentinelone = { status: "error", error: err.message };
    }
  }

  // ── Checkpoint Harmony ─────────────────────────────────────────────────────
  const harmony = byIntegration["harmony"];
  if (harmony?.clientId && harmony?.accessKey) {
    try {
      integrations.harmony = await syncHarmony(orgSlug, {
        clientId: harmony.clientId,
        accessKey: harmony.accessKey,
      });
    } catch (err: any) {
      console.error(`[cron][${orgSlug}] Harmony sync failed:`, err.message);
      integrations.harmony = { status: "error", error: err.message };
    }
  }

  // ── Palo Alto Firewall ─────────────────────────────────────────────────────
  const fw = byIntegration["firewall"];
  if (fw?.baseUrl && fw?.apiKey) {
    try {
      integrations.firewall = await syncFirewall(orgSlug, {
        baseUrl: fw.baseUrl,
        apiKey: fw.apiKey,
      });
    } catch (err: any) {
      console.error(`[cron][${orgSlug}] Firewall sync failed:`, err.message);
      integrations.firewall = { status: "error", error: err.message };
    }
  }

  if (Object.keys(integrations).length === 0) {
    return { status: "skipped", reason: "no matching integration credentials found" };
  }

  return { status: "success", integrations };
}

export async function POST(req: NextRequest) {
  // ── Authenticate via shared secret ─────────────────────────────────────────
  const authHeader = req.headers.get("authorization") ?? "";
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error("[cron] CRON_SECRET is not set — refusing request");
    return NextResponse.json({ error: "Cron not configured" }, { status: 500 });
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = new Date().toISOString();
  console.log(`[cron] Sync started at ${startedAt}`);

  // ── Fetch all active orgs from master DB ───────────────────────────────────
  let orgs: Awaited<ReturnType<typeof OrgModel.findActive>>;
  try {
    orgs = await OrgModel.findActive();
  } catch (err: any) {
    console.error("[cron] Failed to fetch organizations:", err.message);
    return NextResponse.json({ error: "Failed to load organizations" }, { status: 500 });
  }

  console.log(`[cron] Syncing ${orgs.length} active org(s)`);

  // ── Sync each org (concurrency cap of 3 to avoid overwhelming the DB) ──────
  const CONCURRENCY = 3;
  const results: Record<string, OrgResult> = {};

  for (let i = 0; i < orgs.length; i += CONCURRENCY) {
    const batch = orgs.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map(async (org) => {
        const result = await syncOrg(org.slug);
        return [org.slug, result] as const;
      })
    );
    for (const [slug, result] of batchResults) {
      results[slug] = result;
    }
  }

  const completedAt = new Date().toISOString();
  const summary = {
    startedAt,
    completedAt,
    orgsProcessed: orgs.length,
    results,
  };

  console.log(`[cron] Sync complete at ${completedAt}`);
  return NextResponse.json(summary);
}
