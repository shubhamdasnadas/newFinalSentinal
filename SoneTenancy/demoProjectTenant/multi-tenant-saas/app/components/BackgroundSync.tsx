"use client";

import { useEffect, useRef } from "react";

const SYNC_INTERVAL_MS = 1 * 60 * 1000;

const S1_SYNC_APIS = [
  "/api/sentinelone/sentinalone_agentinfo",
  "/api/sentinelone/sentinalone_applicationagent",
  "/api/sentinelone/sentinalone_applicationCVE",
  "/api/sentinelone/sentinalone_devicecontrol",
  "/api/sentinelone/sentinalone_rss",
];

async function runSentinelOneSync() {
  const credsRes = await fetch("/api/sentinelone/credentials", { credentials: "include" });
  if (!credsRes.ok) return;
  const creds = await credsRes.json();
  if (!creds.accountId || !creds.tokenKey) return;









  

  for (const path of S1_SYNC_APIS) {
    try {
      await fetch(`${path}?accountId=${encodeURIComponent(creds.accountId)}`, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        headers: { "x-s1-token": creds.tokenKey },
      });
    } catch {
      // individual endpoint errors don't abort the rest
    }
  }
}

async function runHarmonySync() {
  const credsRes = await fetch("/api/harmony/credentials", { credentials: "include" });
  if (!credsRes.ok) return;
  const creds = await credsRes.json();
  if (!creds.clientId || !creds.accessKey) return;

  const authRes = await fetch("/api/harmony/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId: creds.clientId, accessKey: creds.accessKey }),
  });
  if (!authRes.ok) return;
  const authData = await authRes.json();
  if (!authData.token) return;

  await fetch("/api/harmony/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ token: authData.token }),
  });
}

// NOTE: This component used to trigger sync calls from the browser.
// That breaks logout-safety because long-running work was tied to the browser session.
// Sync is now handled by server-side workers using DB-backed jobs.
export default function BackgroundSync() {
  // Intentionally no-op.
  return null;
}

