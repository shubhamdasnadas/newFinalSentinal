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

export default function BackgroundSync() {
  const s1InFlight = useRef(false);
  const harmonyInFlight = useRef(false);

  useEffect(() => {
    const s1Id = setInterval(async () => {
      if (s1InFlight.current) return;
      s1InFlight.current = true;
      try { await runSentinelOneSync(); }
      catch { /* ignore */ }
      finally { s1InFlight.current = false; }
    }, SYNC_INTERVAL_MS);

    const harmonyId = setInterval(async () => {
      if (harmonyInFlight.current) return;
      harmonyInFlight.current = true;
      try { await runHarmonySync(); }
      catch { /* ignore */ }
      finally { harmonyInFlight.current = false; }
    }, SYNC_INTERVAL_MS);

    return () => {
      clearInterval(s1Id);
      clearInterval(harmonyId);
    };
  }, []);

  return null;
}
