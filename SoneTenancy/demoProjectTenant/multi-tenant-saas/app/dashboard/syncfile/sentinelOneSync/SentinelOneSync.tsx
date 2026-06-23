"use client";

import { useState, useEffect } from "react";

type ApiStatus = "idle" | "running" | "done" | "error";

interface ApiResult {
  label: string;
  status: ApiStatus;
  message: string;
  count?: number;
}

// ✅ FIXED: paths now exactly match your folder names with underscores
const SYNC_APIS = [
//   { label: "Threats",             path: "/api/sentinelone/sentinalone_threats" },
  { label: "Agent Info",          path: "/api/sentinelone/sentinalone_agentinfo" },
  { label: "Application Agent",   path: "/api/sentinelone/sentinalone_applicationagent" },
  { label: "Application CVE",     path: "/api/sentinelone/sentinalone_applicationCVE" },
  { label: "Device Control",      path: "/api/sentinelone/sentinalone_devicecontrol" },
  { label: "RSS",                 path: "/api/sentinelone/sentinalone_rss" },
//   { label: "Threat Count",        path: "/api/sentinelone/sentinalone_threatcount" },
];

export default function SentinelOneSync() {
  const [accountID, setAccountID] = useState("");
  const [tokenKey, setTokenKey] = useState("");
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const [data, setData] = useState<any>(null);
  const [apiResults, setApiResults] = useState<ApiResult[]>([]);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  // Load saved credentials from the org DB on mount
  useEffect(() => {
    fetch("/api/sentinelone/credentials", { credentials: "include" })
      .then(r => r.json())
      .then(d => {
        if (d.accountId) setAccountID(d.accountId);
        if (d.tokenKey) setTokenKey(d.tokenKey);
        if (d.lastSyncedAt) setLastSyncedAt(new Date(d.lastSyncedAt));
      })
      .catch(() => {});
  }, []);

  const handleSentinelSync = async () => {
    if (!accountID.trim() || !tokenKey.trim()) {
      setStatus("error");
      setMessage("Please enter Account ID and Token Key.");
      return;
    }

    // Persist credentials to the org DB so auto-sync can reuse them across sessions
    fetch("/api/sentinelone/credentials", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ accountId: accountID.trim(), tokenKey: tokenKey.trim() }),
    }).catch(() => {});

    try {
      setStatus("running");
      setMessage("Syncing all SentinelOne data...");
      setData(null);

      const results: ApiResult[] = SYNC_APIS.map((api) => ({
        label: api.label,
        status: "idle",
        message: "Waiting...",
      }));
      setApiResults([...results]);

      let hasError = false;
      const summaryData: Record<string, any> = {};

      for (let i = 0; i < SYNC_APIS.length; i++) {
        const api = SYNC_APIS[i];

        results[i] = { ...results[i], status: "running", message: "Fetching..." };
        setApiResults([...results]);

        try {
          const response = await fetch(
            `${api.path}?accountId=${encodeURIComponent(accountID.trim())}`,
            {
              method: "GET",
              credentials: "include",
              cache: "no-store",
              headers: {
                "x-s1-token": tokenKey.trim(),
              },
            }
          );

          // ✅ ADDED: check content-type before parsing JSON to give a clearer error
          const contentType = response.headers.get("content-type") ?? "";
          if (!contentType.includes("application/json")) {
            throw new Error(`Route not found — check folder name matches: ${api.path}`);
          }

          const result = await response.json();

          if (!response.ok) {
            throw new Error(result?.message || result?.error || `${api.label} sync failed`);
          }

          const count =
            result?.pagination?.returnedItems ??
            result?.data?.length ??
            0;

          results[i] = {
            ...results[i],
            status: "done",
            message: `Synced ${count} records`,
            count,
          };

          summaryData[api.label] = result;
        } catch (err: any) {
          hasError = true;
          results[i] = {
            ...results[i],
            status: "error",
            message: err?.message || `${api.label} failed`,
          };
        }

        setApiResults([...results]);
      }

      setData(summaryData);
      setStatus(hasError ? "error" : "done");
      setMessage(
        hasError
          ? "Sync completed with some errors. Check details below."
          : "All SentinelOne data synced successfully."
      );
      if (!hasError) setLastSyncedAt(new Date());
    } catch (error: any) {
      console.error("SentinelOne Sync Error:", error);
      setStatus("error");
      setMessage(error?.message || "SentinelOne sync failed.");
    }
  };

  return (
    <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-[var(--card-border)] bg-[var(--muted-bg)]">
        <h3 className="font-semibold text-[var(--foreground)]">SentinelOne Sync</h3>
        <p className="text-xs text-[var(--muted)] mt-0.5">
          Connect SentinelOne and fetch threats data
          {lastSyncedAt && (
            <span className="ml-2">
              · Last synced: {lastSyncedAt.toLocaleString()}
            </span>
          )}
        </p>
      </div>

      <div className="p-6 space-y-4">
        {/* Account ID */}
        <div>
          <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
            Account ID
          </label>
          <input
            type="text"
            value={accountID}
            onChange={(e) => setAccountID(e.target.value)}
            placeholder="Enter SentinelOne Account ID"
            className="w-full px-4 py-2.5 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-sm text-[var(--foreground)] font-mono"
          />
        </div>

        {/* Token Key */}
        <div>
          <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
            Token Key
          </label>
          <input
            type="password"
            value={tokenKey}
            onChange={(e) => setTokenKey(e.target.value)}
            placeholder="Enter SentinelOne API Token"
            className="w-full px-4 py-2.5 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-sm text-[var(--foreground)] font-mono"
          />
        </div>

        {/* Sync Button + auto-sync status */}
        <div className="flex items-center gap-4">
          <button
            onClick={handleSentinelSync}
            disabled={status === "running"}
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors"
          >
            {status === "running" ? "Syncing..." : "Sync Now"}
          </button>

          {message && (
            <span
              className={`text-sm font-medium ${
                status === "done"
                  ? "text-green-600"
                  : status === "error"
                  ? "text-red-500"
                  : "text-indigo-600"
              }`}
            >
              {message}
            </span>
          )}
        </div>

        {/* Auto-sync indicator */}
        <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          Auto-syncs every 15 min
          {lastSyncedAt && (
            <span>
              · Last synced {lastSyncedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>

        {/* Per-API progress */}
        {apiResults.length > 0 && (
          <div className="mt-2 rounded-xl border border-[var(--card-border)] overflow-hidden">
            <div className="px-4 py-2.5 bg-[var(--muted-bg)] border-b border-[var(--card-border)]">
              <span className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">
                Sync Progress
              </span>
            </div>
            <div className="divide-y divide-[var(--card-border)]">
              {apiResults.map((api) => (
                <div
                  key={api.label}
                  className="flex items-center justify-between px-4 py-3 bg-[var(--input-bg)]"
                >
                  <span className="text-sm font-medium text-[var(--foreground)]">
                    {api.label}
                  </span>
                  <div className="flex items-center gap-2">
                    {api.status === "running" && (
                      <span className="inline-block w-3 h-3 rounded-full bg-indigo-500 animate-pulse" />
                    )}
                    <span
                      className={`text-xs font-medium ${
                        api.status === "done"
                          ? "text-green-600"
                          : api.status === "error"
                          ? "text-red-500"
                          : api.status === "running"
                          ? "text-indigo-500"
                          : "text-[var(--muted)]"
                      }`}
                    >
                      {api.message}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Response Preview */}
        {data && (
          <div className="mt-2 rounded-xl border border-[var(--card-border)] overflow-hidden">
            <div className="px-4 py-2.5 bg-[var(--muted-bg)] border-b border-[var(--card-border)]">
              <span className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">
                Response Preview
              </span>
            </div>
            <pre className="text-xs text-[var(--muted)] bg-[var(--input-bg)] p-4 overflow-auto max-h-64 whitespace-pre-wrap break-all">
              {JSON.stringify(data, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
