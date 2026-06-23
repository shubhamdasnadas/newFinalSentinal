"use client";

import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { useState } from "react";
import SentinelOneSync from "../syncfile/sentinelOneSync/SentinelOneSync";

export default function SettingsPage() {
  const { user, activeOrgName, activeOrgSlug } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [saved, setSaved] = useState(false);
  const [displayName, setDisplayName] = useState(user?.name || "");
  const [accountID, setAccountID] = useState("");
  const [tokenKey, setTokenKey] = useState("");
  // ── Sync All ──────────────────────────────────────────────────────────────
  const [syncAllStatus, setSyncAllStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [syncAllResult, setSyncAllResult] = useState<Record<string, unknown> | null>(null);

  const handleSyncAll = async () => {
    const cId = typeof window !== "undefined" ? localStorage.getItem("harmony_client_id") || "" : "";
    const aKey = typeof window !== "undefined" ? localStorage.getItem("harmony_access_key") || "" : "";

    setSyncAllStatus("running");
    setSyncAllResult(null);
    try {
      const res = await fetch("/api/sync-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ harmonyClientId: cId, harmonyAccessKey: aKey }),
      });
      const data = await res.json();
      setSyncAllResult(data);
      setSyncAllStatus(res.ok ? "done" : "error");
    } catch (err: unknown) {
      setSyncAllResult({ error: err instanceof Error ? err.message : "Sync failed" });
      setSyncAllStatus("error");
    }
  };

  // ── Harmony Email & Collaboration ────────────────────────────────────────────
  const [clientId, setClientId] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("harmony_client_id") || "" : ""
  );
  const [accessKey, setAccessKey] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("harmony_access_key") || "" : ""
  );
  const [syncStatus, setSyncStatus] = useState<"idle" | "auth" | "fetching" | "done" | "error">("idle");
  const [syncMsg, setSyncMsg] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [syncData, setSyncData] = useState<any>(null);

  const handleSync = async () => {
    if (!clientId.trim() || !accessKey.trim()) {
      setSyncMsg("Please enter both Client ID and Access Key.");
      setSyncStatus("error");
      return;
    }

    // // Persist credentials locally
    // localStorage.setItem("harmony_client_id", clientId.trim());
    // localStorage.setItem("harmony_access_key", accessKey.trim());

    setSyncData(null);
    setSyncMsg("Step 1: Authenticating...");
    setSyncStatus("auth");

    try {
      // ── Step 1: Authenticate via /api/harmony/auth ───────────────────────────
      const authRes = await fetch("/api/harmony/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: clientId.trim(), accessKey: accessKey.trim() }),
      });

      const authData = await authRes.json();

      if (!authRes.ok) {
        throw new Error(authData?.error ?? `Auth failed (${authRes.status})`);
      }

      const token: string = authData.token;

      // Cache token with 30-min expiry for reuse elsewhere in the app
      localStorage.setItem("harmony_token", token);
      localStorage.setItem("harmony_token_expiry", String(Date.now() + 30 * 60 * 1000));

      // Save clientId, accessKey, and token to the org DB
      fetch("/api/harmony/credentials", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ clientId: clientId.trim(), accessKey: accessKey.trim(), token }),
      }).catch(() => {});

      // ── Step 2: Sync events → save to org database ───────────────────────────
      setSyncMsg("Step 2: Fetching & saving events to database...");
      setSyncStatus("fetching");

      const syncRes = await fetch("/api/harmony/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token }),
      });

      const syncResult = await syncRes.json();

      if (!syncRes.ok) {
        throw new Error(syncResult?.error ?? `Sync failed (${syncRes.status})`);
      }

      setSyncData(syncResult);
      setSyncMsg(
        `Sync complete — ${syncResult.upserted ?? syncResult.fetched ?? "?"} event(s) saved to database (${syncResult.totalInDb ?? "?"} total).`
      );
      setSyncStatus("done");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Sync failed.";
      setSyncMsg(message);
      setSyncStatus("error");
    }
  };

  const handleSentinelsync =async () => {
    const response = await fetch(
      `/api/sentinelone/threats?accountId=${accountID}`,
      {
        method: "GET",
        headers: {
          "x-s1-token": tokenKey,
          "x-s1-url": "https://your-console.sentinelone.net",
        },
      }
    );

    const result = await response.json();

    console.log(result);
  }

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const statusColor = {
    idle: "",
    auth: "text-indigo-600 dark:text-indigo-400",
    fetching: "text-indigo-600 dark:text-indigo-400",
    done: "text-green-600 dark:text-green-400",
    error: "text-red-500",
  }[syncStatus];

  return (
    <div className="p-6 lg:p-8 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Settings</h1>
        {activeOrgName && <p className="text-[var(--muted)] text-sm mt-1">{activeOrgName}</p>}
      </div>

      <div className="space-y-5">
        {/* ── Sync All Data to Database ── */}
        <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-indigo-200 dark:border-indigo-800 bg-indigo-100 dark:bg-indigo-900/30 flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-indigo-900 dark:text-indigo-200 leading-tight">Sync All Data to Database</h3>
              <p className="text-xs text-indigo-700 dark:text-indigo-400 mt-0.5">
                Pulls SentinelOne threats + agents and Checkpoint events into your org database
              </p>
            </div>
          </div>
          <div className="p-6">
            <p className="text-sm text-indigo-800 dark:text-indigo-300 mb-4">
              Make sure your <strong>Harmony Client ID</strong> and <strong>Access Key</strong> are saved below before syncing.
              SentinelOne uses the <code className="text-xs bg-indigo-100 dark:bg-indigo-900/40 px-1 rounded">S1_BASE_URL</code> and <code className="text-xs bg-indigo-100 dark:bg-indigo-900/40 px-1 rounded">S1_API_TOKEN</code> from your environment.
            </p>
            <div className="flex items-center gap-4 flex-wrap">
              <button
                onClick={handleSyncAll}
                disabled={syncAllStatus === "running"}
                className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors"
              >
                {syncAllStatus === "running" ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                    Syncing all data…
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Sync All Data Now
                  </>
                )}
              </button>
              {syncAllStatus === "done" && (
                <span className="text-sm font-medium text-green-600 dark:text-green-400 flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Sync complete
                </span>
              )}
              {syncAllStatus === "error" && (
                <span className="text-sm font-medium text-red-500 flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Sync failed
                </span>
              )}
            </div>

            {/* Result breakdown */}
            {syncAllResult && (
              <div className="mt-4 space-y-2">
                {Object.entries(syncAllResult.results as Record<string, Record<string, unknown>> ?? {}).map(([key, val]) => (
                  <div key={key} className={`flex items-start gap-3 px-4 py-3 rounded-xl text-sm border ${val.status === "ok"
                    ? "bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800"
                    : val.status === "skipped"
                      ? "bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800"
                      : "bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800"
                    }`}>
                    <span className={`font-semibold capitalize w-28 flex-shrink-0 ${val.status === "ok" ? "text-green-700 dark:text-green-400"
                      : val.status === "skipped" ? "text-amber-700 dark:text-amber-400"
                        : "text-red-600"
                      }`}>{key}</span>
                    <span className={`${val.status === "ok" ? "text-green-700 dark:text-green-300"
                      : val.status === "skipped" ? "text-amber-700 dark:text-amber-300"
                        : "text-red-600"
                      }`}>
                      {val.status === "ok" && key === "sentinelone" && `${val.threats} threats, ${val.agents} agents saved`}
                      {val.status === "ok" && key === "checkpoint" && `${val.upserted} events saved (${val.totalInDb} total in DB)`}
                      {val.status === "skipped" && `Skipped — ${val.reason}`}
                      {val.status === "error" && `Error: ${val.error}`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Account */}
        <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--card-border)] bg-[var(--muted-bg)]">
            <h3 className="font-semibold text-[var(--foreground)]">Account Information</h3>
          </div>
          <div className="p-6 space-y-0 divide-y divide-[var(--card-border)]">
            {[
              { label: "Email", value: user?.email },
              { label: "Role", value: user?.role?.replace(/_/g, " "), capitalize: true },
              activeOrgName ? { label: "Organization", value: activeOrgName } : null,
              activeOrgSlug ? { label: "Database", value: `saas_org_${activeOrgSlug}`, mono: true } : null,
            ].filter(Boolean).map((item) => (
              <div key={item!.label} className="flex items-center justify-between py-3.5">
                <p className="text-sm font-medium text-[var(--muted)]">{item!.label}</p>
                <p className={`text-sm text-[var(--foreground)] ${item!.capitalize ? "capitalize" : ""} ${item!.mono ? "font-mono text-xs" : ""}`}>
                  {item!.value}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Harmony Email & Collaboration Integration ── */}
        <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--card-border)] bg-[var(--muted-bg)] flex items-center gap-3 justify-between">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-[var(--foreground)] leading-tight">Harmony Email &amp; Collaboration</h3>
                <p className="text-xs text-[var(--muted)] mt-0.5">Check Point — connect to fetch security events</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              auto-sync in 1 minute
            </div>
          </div>

          <div className="p-6 space-y-4">
            {/* Client ID */}
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                Client ID
              </label>
              <input
                type="text"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="e.g. 44550823d2824f439d7f099071133ce3"
                className="w-full px-4 py-2.5 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-sm text-[var(--foreground)] font-mono placeholder:font-sans placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
              />
            </div>

            {/* Access Key */}
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                Access Key
              </label>
              <input
                type="password"
                value={accessKey}
                onChange={(e) => setAccessKey(e.target.value)}
                placeholder="e.g. 0a204c1a2ba143a886654fa5bf934956"
                className="w-full px-4 py-2.5 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-sm text-[var(--foreground)] font-mono placeholder:font-sans placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
              />
              <p className="text-xs text-[var(--muted)] mt-1.5">
                Token is valid for 30 minutes after sync. Credentials are stored locally.
              </p>
              
            </div>

            {/* Sync button + status */}
            <div className="flex items-center gap-4 pt-1">
              <button
                onClick={handleSync}
                disabled={syncStatus === "auth" || syncStatus === "fetching"}
                className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors"
              >
                {(syncStatus === "auth" || syncStatus === "fetching") ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                    {syncStatus === "auth" ? "Authenticating..." : "Fetching..."}
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Sync Now
                  </>
                )}
              </button>

              {syncMsg && (
                <span className={`text-sm font-medium flex items-center gap-1.5 ${statusColor}`}>
                  {syncStatus === "done" && (
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  {syncStatus === "error" && (
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                  {syncMsg}
                </span>
              )}
            </div>

            {/* Auto-sync status indicator */}
            <div className="flex items-center gap-2 text-xs">
              {(syncStatus === "auth" || syncStatus === "fetching") ? (
                <>
                  <div className="animate-spin w-3 h-3 border-2 border-indigo-500 border-t-transparent rounded-full flex-shrink-0" />
                  <span className="text-indigo-600 font-medium">
                    {syncStatus === "auth" ? "Authenticating with Checkpoint…" : "Fetching & saving events…"}
                  </span>
                </>
              ) : syncStatus === "done" ? (
                <>
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
                  <span className="text-green-600 font-medium">Sync complete — auto-syncs every 15 min on the Checkpoint page</span>
                </>
              ) : syncStatus === "error" ? (
                <>
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                  <span className="text-red-500 font-medium">Sync failed — check credentials and try again</span>
                </>
              ) : (
                <>
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse flex-shrink-0" />
                  <span className="text-[var(--muted)]">Auto-syncs every 15 min on the Checkpoint page</span>
                </>
              )}
            </div>

            {/* Response preview */}
            {syncData && (
              <div className="mt-2 rounded-xl border border-[var(--card-border)] overflow-hidden">
                <div className="px-4 py-2.5 bg-[var(--muted-bg)] border-b border-[var(--card-border)] flex items-center justify-between">
                  <span className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">Response Preview</span>
                  <button
                    onClick={() => setSyncData(null)}
                    className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                  >
                    Clear
                  </button>
                </div>
                <pre className="text-xs text-[var(--muted)] bg-[var(--input-bg)] p-4 overflow-auto max-h-64 whitespace-pre-wrap break-all">
                  {JSON.stringify(syncData, null, 2)}
                </pre>
              </div>
            )}
          </div>


        </div>

            {/* Sentinel One sync */}
        <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl overflow-hidden">
            <SentinelOneSync />
        </div>


        {/* Appearance */}
        {/* <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--card-border)] bg-[var(--muted-bg)]">
            <h3 className="font-semibold text-[var(--foreground)]">Appearance</h3>
          </div>
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[var(--foreground)]">Theme</p>
                <p className="text-xs text-[var(--muted)] mt-0.5">Switch between light and dark mode</p>
              </div>
              <button
                onClick={toggleTheme}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${theme === "dark" ? "bg-indigo-600" : "bg-gray-300"
                  }`}
                aria-label="Toggle theme"
              >
                <span
                  className="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform"
                  style={{ transform: theme === "dark" ? "translateX(22px)" : "translateX(2px)" }}
                />
              </button>
            </div>
            <p className="text-xs text-[var(--muted)] mt-3">
              Currently: <span className="font-medium text-[var(--foreground)] capitalize">{theme} mode</span>
            </p>
          </div>
        </div> */}

        {/* Preferences */}
        {/* <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--card-border)] bg-[var(--muted-bg)]">
            <h3 className="font-semibold text-[var(--foreground)]">Preferences</h3>
          </div>
          <form onSubmit={handleSave} className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">Display Name</label>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-4 py-2.5 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">Timezone</label>
              <select className="w-full px-4 py-2.5 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                <option value="UTC">UTC</option>
                <option value="America/New_York">America/New_York (EST)</option>
                <option value="America/Los_Angeles">America/Los_Angeles (PST)</option>
                <option value="Europe/London">Europe/London (GMT)</option>
              </select>
            </div>
            <div className="flex items-center gap-4">
              <button
                type="submit"
                className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors"
              >
                Save Preferences
              </button>
              {saved && (
                <span className="text-green-600 dark:text-green-400 text-sm font-medium flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Saved!
                </span>
              )}
            </div>
          </form>
        </div> */}

        {/* Security */}
        {/* <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--card-border)] bg-[var(--muted-bg)]">
            <h3 className="font-semibold text-[var(--foreground)]">Security</h3>
          </div>
          <div className="p-6 divide-y divide-[var(--card-border)]">
            <div className="flex items-center justify-between py-3.5">
              <div>
                <p className="text-sm font-medium text-[var(--foreground)]">Password</p>
                <p className="text-xs text-[var(--muted)] mt-0.5">Last changed: unknown</p>
              </div>
              <button className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-medium transition-colors">
                Change
              </button>
            </div>
            <div className="flex items-center justify-between py-3.5">
              <div>
                <p className="text-sm font-medium text-[var(--foreground)]">Two-Factor Authentication</p>
                <p className="text-xs text-[var(--muted)] mt-0.5">Not enabled</p>
              </div>
              <button className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-medium transition-colors">
                Enable
              </button>
            </div>
            <div className="flex items-center justify-between py-3.5">
              <div>
                <p className="text-sm font-medium text-[var(--foreground)]">Active Sessions</p>
                <p className="text-xs text-[var(--muted)] mt-0.5">1 active session</p>
              </div>
              <button className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] font-medium transition-colors">
                View
              </button>
            </div>
          </div>
        </div> */}

        {/* Danger zone */}
        <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-2xl p-6">
          <h3 className="font-semibold text-red-900 dark:text-red-400 mb-1">Danger Zone</h3>
          <p className="text-sm text-red-700 dark:text-red-500 mb-4">
            These actions are irreversible. Please proceed with caution.
          </p>
          <button className="bg-red-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-red-700 transition-colors">
            Delete Account
          </button>
        </div>
      </div>
    </div>
  );
}
