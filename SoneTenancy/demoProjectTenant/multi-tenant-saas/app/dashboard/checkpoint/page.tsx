"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import CheckpointDashboard from "./CheckpointDashboard/CheckpointDashboard";
import type { HarmonyEvent } from "./CheckpointDashboard/CheckpointDashboard";

interface ThreatSummary {
  total: number;
  pending: number;
  remediated: number;
  remediatedPct: number;
  detected: number;
  detectedPct: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatEventDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-US", {
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return iso;
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function Spin() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full" />
    </div>
  );
}

function SaasIcon() {
  // Office-style icon (generic)
  return (
    <div className="w-8 h-8 rounded bg-[#D83B01] flex items-center justify-center flex-shrink-0">
      <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
        <path d="M21.17 3.25Q21.5 3.25 21.76 3.5 22 3.74 22 4.08V19.92Q22 20.26 21.76 20.5 21.5 20.75 21.17 20.75H7.83Q7.5 20.75 7.24 20.5 7 20.26 7 19.92V17H2.83Q2.5 17 2.24 16.76 2 16.5 2 16.17V7.83Q2 7.5 2.24 7.24 2.5 7 2.83 7H7V4.08Q7 3.74 7.24 3.5 7.5 3.25 7.83 3.25M7 13.06L8.18 15.28H9.97L8.07 12.06 9.93 8.89H8.22L7.13 10.9 7.09 10.9 6 8.89H4.28L6.05 12 4.14 15.28H5.86M13.88 19.5V17H8.25V19.5M13.88 15.75V12.63H8.25V15.75M13.88 11.38V8.25H8.25V11.38M20.75 19.5V17H15.13V19.5M20.75 15.75V12.63H15.13V15.75M20.75 11.38V8.25H15.13V11.38Z" />
      </svg>
    </div>
  );
}

// ─── EVENT_TYPES available from API ──────────────────────────────────────────
const ALL_EVENT_TYPES = [
  "phishing",
  "malware",
  "suspicious_malware",
  "suspicious_phishing",
  "dlp",
];

interface ThreatCardProps {
  label: string;
  summary: ThreatSummary;
  expanded: boolean;
  onToggle: () => void;
  // three-dot filter: which event types to fetch
  activeTypes: string[];
  onTypeChange: (types: string[]) => void;
}

function ThreatCard({
  label,
  summary,
  expanded,
  onToggle,
  activeTypes,
  onTypeChange,
}: ThreatCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const toggleType = (t: string) => {
    if (activeTypes.includes(t)) {
      if (activeTypes.length === 1) return; // keep at least one
      onTypeChange(activeTypes.filter((x) => x !== t));
    } else {
      onTypeChange([...activeTypes, t]);
    }
  };

  return (
    <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--card-border)]">
        <span className="font-semibold text-[var(--foreground)] text-sm capitalize">{label}</span>
        <div className="flex items-center gap-3">
          {/* Three-dot menu */}
          <div className="relative">
            <button
              onClick={() => setMenuOpen((p) => !p)}
              className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors p-1 rounded-lg hover:bg-[var(--muted-bg)]"
              aria-label="Filter event types"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="5" cy="12" r="1.5" />
                <circle cx="12" cy="12" r="1.5" />
                <circle cx="19" cy="12" r="1.5" />
              </svg>
            </button>

            {menuOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-8 z-40 w-52 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl shadow-xl py-1.5">
                  <p className="px-3 py-1 text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">
                    Event Types
                  </p>
                  {ALL_EVENT_TYPES.map((t) => (
                    <button
                      key={t}
                      onClick={() => toggleType(t)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--muted-bg)] transition-colors capitalize"
                    >
                      <span
                        className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                          activeTypes.includes(t)
                            ? "bg-indigo-600 border-indigo-600"
                            : "border-[var(--card-border)]"
                        }`}
                      >
                        {activeTypes.includes(t) && (
                          <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </span>
                      {t.replace(/_/g, " ")}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Body — Total big, then Remediated% | Detected% | Pending% all out of 100 */}
      <div className="px-5 py-5">
        {summary.total === 0 ? (
          <p className="text-sm text-[var(--muted)] text-center py-4">No events</p>
        ) : (
          <>
            {/* Total */}
            <div className="mb-4">
              <p className="text-4xl font-bold text-blue-600 dark:text-blue-400 leading-none">
                {summary.total}
              </p>
              <p className="text-xs text-[var(--muted)] mt-1.5 font-medium">Total</p>
            </div>

            {/* Three percentage stats side by side */}
            <div className="flex items-end justify-between">

              {/* Remediated */}
              <div>
                <p className={`text-3xl font-bold leading-none ${
                  summary.remediatedPct === 100
                    ? "text-green-600 dark:text-green-400"
                    : summary.remediatedPct > 0
                    ? "text-blue-600 dark:text-blue-400"
                    : "text-[var(--muted)]"
                }`}>
                  {summary.remediatedPct}%
                </p>
                <p className={`text-xs mt-1.5 font-medium ${
                  summary.remediatedPct === 100
                    ? "text-green-600 dark:text-green-400"
                    : "text-[var(--muted)]"
                }`}>
                  Remediated
                </p>
              </div>

              {/* Detected */}
              <div>
                <p className={`text-3xl font-bold leading-none ${
                  summary.detectedPct > 0
                    ? "text-orange-500"
                    : "text-[var(--muted)]"
                }`}>
                  {summary.detectedPct}%
                </p>
                <p className="text-xs text-[var(--muted)] mt-1.5 font-medium">Detected</p>
              </div>

              {/* Pending */}
              <div>
                <p className={`text-3xl font-bold leading-none ${
                  summary.pending > 0 ? "text-red-500" : "text-[var(--muted)]"
                }`}>
                  {summary.pending > 0
                    ? `${Math.round((summary.pending / summary.total) * 100)}%`
                    : "0%"}
                </p>
                <p className={`text-xs mt-1.5 font-medium ${
                  summary.pending > 0 ? "text-red-500" : "text-[var(--muted)]"
                }`}>
                  Pending
                  {summary.pending > 0 && (
                    <span className="ml-1 text-red-400">({summary.pending})</span>
                  )}
                </p>
              </div>

            </div>
          </>
        )}
      </div>

      {/* Expand toggle arrow */}
      <div className="flex justify-center pb-3">
        <button
          onClick={onToggle}
          className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors p-1"
          aria-label={expanded ? "Collapse" : "Expand"}
        >
          <svg
            className={`w-5 h-5 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ─── Detail panel — rendered OUTSIDE the grid so it never stretches sibling cards ─
interface DetailPanelProps {
  label: string;
  events: HarmonyEvent[];
}

function DetailPanel({ label, events }: DetailPanelProps) {
  return (
    <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl overflow-hidden shadow-sm mb-6">
      {/* Panel header */}
      <div className="px-5 py-3.5 border-b border-[var(--card-border)] bg-[var(--muted-bg)]">
        <p className="text-sm font-semibold text-[var(--foreground)] capitalize">
          {label} — {events.length} event{events.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Rows */}
      <div className="divide-y divide-[var(--card-border)] max-h-96 overflow-y-auto">
        {events.length === 0 ? (
          <p className="px-5 py-6 text-sm text-[var(--muted)] text-center">No events to show.</p>
        ) : (
          events.map((ev) => {
            const isPending = ev.state === "new" || ev.state === "pending";
            return (
              <div
                key={ev.eventId}
                className={`flex items-start gap-3 px-5 py-2.5 transition-colors ${
                  isPending
                    ? "bg-red-50 dark:bg-red-900/10 hover:bg-red-100 dark:hover:bg-red-900/20"
                    : "hover:bg-[var(--muted-bg)]"
                }`}
              >
                {/* state dot */}
                <span
                  className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${
                    isPending
                      ? "bg-red-500"
                      : ev.state === "remediated" || ev.state === "closed"
                      ? "bg-green-500"
                      : "bg-amber-400"
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-[var(--foreground)] truncate leading-snug">
                    {ev.description || "No description"}
                  </p>
                  <p className="text-xs text-[var(--muted)] mt-0.5">
                    {formatEventDate(ev.eventCreated)}
                    {ev.senderAddress ? ` · ${ev.senderAddress}` : ""}
                  </p>
                </div>
                <span
                  className={`flex-shrink-0 text-xs px-1.5 py-0.5 rounded capitalize font-medium ${
                    isPending
                      ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                      : "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                  }`}
                >
                  {ev.state}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CheckpointPage() {
  const [events, setEvents] = useState<HarmonyEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [harmonyClientId, setHarmonyClientId] = useState("");
  const [harmonyAccessKey, setHarmonyAccessKey] = useState("");

  // only one card open at a time — store the key of the open card (or null)
  const [openCard, setOpenCard] = useState<string | null>(null);

  // per-card active event types (three-dot filter)
  const [phishingTypes, setPhishingTypes] = useState<string[]>(["phishing"]);
  const [malwareTypes, setMalwareTypes] = useState<string[]>(["malware"]);
  const [dlpTypes, setDlpTypes] = useState<string[]>(["dlp"]);

  // security events table filter + pagination
  const [tableFilter, setTableFilter] = useState<string>("all");
  const [tablePage, setTablePage] = useState(1);
  const TABLE_PAGE_SIZE = 15;

  // ── Chart state ───────────────────────────────────────────────────────────
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 29);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const [chartStart, setChartStart] = useState(fmt(thirtyDaysAgo));
  const [chartEnd, setChartEnd] = useState(fmt(today));
  const [chartTypes, setChartTypes] = useState<string[]>(["phishing", "malware", "dlp"]);
  const [chartMode, setChartMode] = useState<"bar" | "line">("bar");

  const CHART_COLORS: Record<string, string> = {
    phishing: "#f97316",
    malware: "#ef4444",
    dlp: "#3b82f6",
    suspicious_phishing: "#fb923c",
    suspicious_malware: "#f87171",
  };

  // ── Load events from DB on mount — auto-sync if empty ────────────────────
  const loadFromDb = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/harmony/events-db", { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `Request failed (${res.status})`);

      const records: HarmonyEvent[] = Array.isArray(data.responseData) ? data.responseData : [];
      setEvents(records);
      setLastSyncedAt(data.lastSyncedAt ?? null);

      // If DB is empty, try to auto-sync using stored credentials
      if (records.length === 0) {
        const clientId = typeof window !== "undefined" ? localStorage.getItem("harmony_client_id") : null;
        const accessKey = typeof window !== "undefined" ? localStorage.getItem("harmony_access_key") : null;
        if (clientId && accessKey) {
          setSyncMsg({ text: "Database empty — auto-syncing from Checkpoint…", ok: true });
          // Step 1: auth
          const authRes = await fetch("/api/harmony/auth", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ clientId, accessKey }),
          });
          const authData = await authRes.json();
          if (authRes.ok && authData.token) {
            localStorage.setItem("harmony_token", authData.token);
            // Step 2: sync to DB
            const syncRes = await fetch("/api/harmony/sync", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ token: authData.token }),
            });
            const syncData = await syncRes.json();
            if (syncRes.ok) {
              setSyncMsg({ text: `Auto-sync complete — ${syncData.upserted} events saved`, ok: true });
              // Reload from DB
              const res2 = await fetch("/api/harmony/events-db", { credentials: "include" });
              const data2 = await res2.json();
              if (res2.ok) {
                setEvents(Array.isArray(data2.responseData) ? data2.responseData : []);
                setLastSyncedAt(data2.lastSyncedAt ?? null);
              }
            }
          }
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load events.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadFromDb(); }, []);

  // Load Harmony credentials from org DB on mount; also write to localStorage
  // so the existing loadFromDb auto-sync logic continues to work.
  useEffect(() => {
    fetch("/api/harmony/credentials", { credentials: "include" })
      .then(r => r.json())
      .then(d => {
        if (d.clientId) {
          setHarmonyClientId(d.clientId);
          localStorage.setItem("harmony_client_id", d.clientId);
        }
        if (d.accessKey) {
          setHarmonyAccessKey(d.accessKey);
          localStorage.setItem("harmony_access_key", d.accessKey);
        }
      })
      .catch(() => {});
  }, []);

  // ── Sync from Checkpoint API → save to DB → reload ───────────────────────
  // Gets a fresh token if the cached one is missing or expired, then syncs.
  const handleSync = async () => {
    let harmonyToken =
      typeof window !== "undefined" ? localStorage.getItem("harmony_token") : null;
    const tokenExpiry =
      typeof window !== "undefined" ? localStorage.getItem("harmony_token_expiry") : null;

    if (!harmonyToken || !tokenExpiry || Date.now() > Number(tokenExpiry)) {
      if (!harmonyClientId || !harmonyAccessKey) {
        setSyncMsg({ text: "No Harmony credentials found. Please save them in Settings first.", ok: false });
        return;
      }
      try {
        const authRes = await fetch("/api/harmony/auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clientId: harmonyClientId, accessKey: harmonyAccessKey }),
        });
        const authData = await authRes.json();
        if (!authRes.ok || !authData.token) throw new Error(authData?.error ?? "Auth failed");
        harmonyToken = authData.token;
        localStorage.setItem("harmony_token", authData.token);
        localStorage.setItem("harmony_token_expiry", String(Date.now() + 30 * 60 * 1000));
        // Update the token in the org DB
        fetch("/api/harmony/credentials", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ clientId: harmonyClientId, accessKey: harmonyAccessKey, token: authData.token }),
        }).catch(() => {});
      } catch (err: unknown) {
        setSyncMsg({ text: err instanceof Error ? err.message : "Re-authentication failed.", ok: false });
        return;
      }
    }

    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await fetch("/api/harmony/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token: harmonyToken }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `Sync failed (${res.status})`);
      setSyncMsg({
        text: `Sync complete — ${data.upserted} events saved (${data.totalInDb} total in DB)`,
        ok: true,
      });
      await loadFromDb();
    } catch (err: unknown) {
      setSyncMsg({ text: err instanceof Error ? err.message : "Sync failed.", ok: false });
    } finally {
      setSyncing(false);
    }
  };

  // Sync immediately when credentials first become available on page open.
  const hasInitialSynced = useRef(false);
  useEffect(() => {
    if (harmonyClientId && harmonyAccessKey && !hasInitialSynced.current) {
      hasInitialSynced.current = true;
      handleSync();
    }
  }, [harmonyClientId, harmonyAccessKey]);

  const toggleCard = (key: string) =>
    setOpenCard((prev) => (prev === key ? null : key));

  // ── Derived data ─────────────────────────────────────────────────────────────
  // Build summary from whichever types are active for each card
  const buildMultiSummary = (types: string[]): ThreatSummary => {
    const filtered = events.filter((e) => types.includes(e.type));
    const total = filtered.length;

    // state-based buckets — all three add up to total (= 100%)
    const pending = filtered.filter(
      (e) => e.state === "new" || e.state === "pending"
    ).length;
    const remediated = filtered.filter(
      (e) => e.state === "remediated" || e.state === "closed" || e.state === "done"
    ).length;
    // "detected" = everything that is neither remediated nor pending
    const detected = total - remediated - pending;

    const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

    return {
      total,
      pending,
      remediated,
      remediatedPct: pct(remediated),
      detected: detected < 0 ? 0 : detected,
      detectedPct: pct(detected < 0 ? 0 : detected),
    };
  };

  const phishingSummary = buildMultiSummary(phishingTypes);
  const malwareSummary = buildMultiSummary(malwareTypes);
  const dlpSummary = buildMultiSummary(dlpTypes);

  // ── Chart data — events per day per selected type within date range ────────
  const chartData = useMemo(() => {
    const start = new Date(chartStart + "T00:00:00");
    const end = new Date(chartEnd + "T23:59:59");

    // Build a map: date-string → { [type]: count }
    const map: Record<string, Record<string, number>> = {};

    // Pre-fill every day in range so gaps show as 0
    const cursor = new Date(start);
    while (cursor <= end) {
      map[fmt(cursor)] = {};
      cursor.setDate(cursor.getDate() + 1);
    }

    events.forEach((ev) => {
      if (!chartTypes.includes(ev.type)) return;
      const d = new Date(ev.eventCreated);
      if (d < start || d > end) return;
      const key = fmt(d);
      if (!map[key]) return;
      map[key][ev.type] = (map[key][ev.type] || 0) + 1;
    });

    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, counts]) => ({
        date: date, // full "YYYY-MM-DD"
        fullDate: date,
        ...counts,
      }));
  }, [events, chartStart, chartEnd, chartTypes]);

  // Unique event types present in data for table filter tabs
  const tableEventTypes = ["all", ...Array.from(new Set(events.map((e) => e.type))).sort()];

  // Sorted events — newest first
  const sortedEvents = [...events].sort(
    (a, b) => new Date(b.eventCreated).getTime() - new Date(a.eventCreated).getTime()
  );

  const filteredTableEvents =
    tableFilter === "all"
      ? sortedEvents
      : sortedEvents.filter((e) => e.type === tableFilter);

  const totalTablePages = Math.max(1, Math.ceil(filteredTableEvents.length / TABLE_PAGE_SIZE));
  const pagedTableEvents = filteredTableEvents.slice(
    (tablePage - 1) * TABLE_PAGE_SIZE,
    tablePage * TABLE_PAGE_SIZE
  );

  // Detail events per card (newest first, filtered by active types)
  const phishingDetail = sortedEvents.filter((e) => phishingTypes.includes(e.type));
  const malwareDetail = sortedEvents.filter((e) => malwareTypes.includes(e.type));
  const dlpDetail = sortedEvents.filter((e) => dlpTypes.includes(e.type));

  // ── Render ────────────────────────────────────────────────────────────────────
  if (loading) return <Spin />;

  if (error) {
    return (
      <div className="p-6 lg:p-8">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-2">
            <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="font-semibold text-red-800 dark:text-red-300">Failed to load events</h3>
          </div>
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          <p className="text-xs text-red-600 dark:text-red-500 mt-2">
            Go to <strong>Settings → Harmony Email &amp; Collaboration</strong> and click <strong>Sync Now</strong> to authenticate.
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="p-6 lg:p-8">
      {/* Page header */}
      <div className="mb-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
                <svg className="w-4 h-4 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-[var(--foreground)]">Checkpoint</h1>
            </div>
            <p className="text-sm text-[var(--muted)]">
              Harmony Email &amp; Collaboration — {events.length} event{events.length !== 1 ? "s" : ""} in database
              {lastSyncedAt && (
                <span className="ml-2 text-xs">
                  · Last synced: {new Date(lastSyncedAt).toLocaleString()}
                </span>
              )}
            </p>
          </div>

          {/* Sync button */}
          {/* <div className="flex flex-col items-end gap-1.5">
            <button
              onClick={handleSync}
              disabled={syncing}
              className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {syncing ? (
                <>
                  <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  Syncing…
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Sync from Checkpoint
                </>
              )}
            </button> 
            {syncMsg && (
              <p className={`text-xs font-medium ${syncMsg.ok ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>
                {syncMsg.text}
              </p>
            )}
            <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              Auto-syncs every 15 min
            </div>
          </div> */}
        </div>
      </div>

      {events.length === 0 ? (
        <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-16 text-center">
          <div className="w-14 h-14 bg-[var(--muted-bg)] rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-[var(--foreground)] mb-1">No events found</h3>
          <p className="text-[var(--muted)] text-sm">Sync your Harmony credentials in Settings to load events.</p>
        </div>
      ) : (
        <>
          {/* ── Threat summary cards ─────────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            <ThreatCard
              label={phishingTypes.length === 1 ? phishingTypes[0].replace(/_/g, " ") : "Phishing"}
              summary={phishingSummary}
              expanded={openCard === "phishing"}
              onToggle={() => toggleCard("phishing")}
              activeTypes={phishingTypes}
              onTypeChange={setPhishingTypes}
            />
            <ThreatCard
              label={malwareTypes.length === 1 ? malwareTypes[0].replace(/_/g, " ") : "Malware"}
              summary={malwareSummary}
              expanded={openCard === "malware"}
              onToggle={() => toggleCard("malware")}
              activeTypes={malwareTypes}
              onTypeChange={setMalwareTypes}
            />
            <ThreatCard
              label={dlpTypes.length === 1 ? dlpTypes[0].replace(/_/g, " ") : "DLP"}
              summary={dlpSummary}
              expanded={openCard === "dlp"}
              onToggle={() => toggleCard("dlp")}
              activeTypes={dlpTypes}
              onTypeChange={setDlpTypes}
            />
          </div>

          {/* ── Detail panel — below the grid, only one visible at a time ───── */}
          {openCard === "phishing" && (
            <DetailPanel
              label={phishingTypes.length === 1 ? phishingTypes[0].replace(/_/g, " ") : "Phishing"}
              events={phishingDetail}
            />
          )}
          {openCard === "malware" && (
            <DetailPanel
              label={malwareTypes.length === 1 ? malwareTypes[0].replace(/_/g, " ") : "Malware"}
              events={malwareDetail}
            />
          )}
          {openCard === "dlp" && (
            <DetailPanel
              label={dlpTypes.length === 1 ? dlpTypes[0].replace(/_/g, " ") : "DLP"}
              events={dlpDetail}
            />
          )}

          {/* ── Events per Day Chart ─────────────────────────────────────── */}
          <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl overflow-hidden shadow-sm mb-6">
            {/* Chart header */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-[var(--card-border)]">
              <h2 className="font-semibold text-[var(--foreground)] text-sm">Events per Day</h2>

              <div className="flex flex-wrap items-center gap-3">
                {/* Date range */}
                <div className="flex items-center gap-2">
                  <label className="text-xs text-[var(--muted)] font-medium">From</label>
                  <input
                    type="date"
                    value={chartStart}
                    max={chartEnd}
                    onChange={(e) => setChartStart(e.target.value)}
                    className="px-2 py-1 text-xs bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <label className="text-xs text-[var(--muted)] font-medium">To</label>
                  <input
                    type="date"
                    value={chartEnd}
                    min={chartStart}
                    max={fmt(today)}
                    onChange={(e) => setChartEnd(e.target.value)}
                    className="px-2 py-1 text-xs bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Type multi-select */}
                <div className="flex items-center gap-1 flex-wrap">
                  {ALL_EVENT_TYPES.map((t) => (
                    <button
                      key={t}
                      onClick={() =>
                        setChartTypes((prev) =>
                          prev.includes(t)
                            ? prev.length === 1 ? prev : prev.filter((x) => x !== t)
                            : [...prev, t]
                        )
                      }
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium capitalize transition-colors border ${
                        chartTypes.includes(t)
                          ? "text-white border-transparent"
                          : "bg-[var(--muted-bg)] text-[var(--muted)] border-[var(--card-border)] hover:text-[var(--foreground)]"
                      }`}
                      style={
                        chartTypes.includes(t)
                          ? { backgroundColor: CHART_COLORS[t] ?? "#6366f1", borderColor: CHART_COLORS[t] ?? "#6366f1" }
                          : {}
                      }
                    >
                      {t.replace(/_/g, " ")}
                    </button>
                  ))}
                </div>

                {/* Bar / Line toggle */}
                <div className="flex items-center gap-1 bg-[var(--muted-bg)] p-0.5 rounded-lg">
                  {(["bar", "line"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setChartMode(m)}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium capitalize transition-colors ${
                        chartMode === m
                          ? "bg-[var(--card-bg)] text-[var(--foreground)] shadow-sm"
                          : "text-[var(--muted)] hover:text-[var(--foreground)]"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Chart body */}
            <div className="px-4 py-4" style={{ height: 260 }}>
              {chartData.every((d) => chartTypes.every((t) => !d[t as keyof typeof d])) ? (
                <div className="flex items-center justify-center h-full text-sm text-[var(--muted)]">
                  No events in selected range / types
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  {chartMode === "bar" ? (
                    <BarChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 10, fill: "var(--muted)" }}
                        tickLine={false}
                        axisLine={false}
                        interval="preserveStartEnd"
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: "var(--muted)" }}
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
                        label={{ value: "Count / day", angle: -90, position: "insideLeft", offset: 16, style: { fontSize: 10, fill: "var(--muted)" } }}
                      />
                      <Tooltip
                        contentStyle={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 8, fontSize: 12 }}
                        labelFormatter={(l) => `Date: ${l}`}
                      />
                      <Legend iconSize={10} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                      {chartTypes.map((t) => (
                        <Bar key={t} dataKey={t} name={t.replace(/_/g, " ")} fill={CHART_COLORS[t] ?? "#6366f1"} radius={[3, 3, 0, 0]} maxBarSize={28} />
                      ))}
                    </BarChart>
                  ) : (
                    <LineChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 10, fill: "var(--muted)" }}
                        tickLine={false}
                        axisLine={false}
                        interval="preserveStartEnd"
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: "var(--muted)" }}
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
                        label={{ value: "Count / day", angle: -90, position: "insideLeft", offset: 16, style: { fontSize: 10, fill: "var(--muted)" } }}
                      />
                      <Tooltip
                        contentStyle={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 8, fontSize: 12 }}
                        labelFormatter={(l) => `Date: ${l}`}
                      />
                      <Legend iconSize={10} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                      {chartTypes.map((t) => (
                        <Line key={t} type="monotone" dataKey={t} name={t.replace(/_/g, " ")} stroke={CHART_COLORS[t] ?? "#6366f1"} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                      ))}
                    </LineChart>
                  )}
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* ── Analytics widgets ────────────────────────────────────────────── */}
          <CheckpointDashboard events={events} />

          {/* ── Security Events table ────────────────────────────────────────── */}
          <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl overflow-hidden shadow-sm">
            {/* Table header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--card-border)]">
              <h2 className="font-semibold text-[var(--foreground)] text-sm">Security Events</h2>
              {/* <svg className="w-4 h-4 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
              </svg> */}
            </div>

            {/* Type filter tabs */}
            <div className="flex gap-1 px-5 pt-3 pb-2 flex-wrap">
              {tableEventTypes.map((t) => (
                <button
                  key={t}
                  onClick={() => { setTableFilter(t); setTablePage(1); }}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors capitalize ${
                    tableFilter === t
                      ? "bg-indigo-600 text-white"
                      : "bg-[var(--muted-bg)] text-[var(--muted)] hover:text-[var(--foreground)]"
                  }`}
                >
                  {t.replace(/_/g, " ")}
                </button>
              ))}
            </div>

            {/* Events list */}
            <div className="divide-y divide-[var(--card-border)]">
              {pagedTableEvents.length === 0 ? (
                <div className="px-5 py-10 text-center text-sm text-[var(--muted)]">
                  No events for this filter.
                </div>
              ) : (
                pagedTableEvents.map((event) => (
                  <div
                    key={event.eventId}
                    className="flex items-start gap-4 px-5 py-3.5 hover:bg-[var(--muted-bg)] transition-colors"
                  >
                    {/* Date/time */}
                    <div className="w-28 flex-shrink-0 text-xs text-[var(--muted)] leading-snug pt-0.5">
                      {formatEventDate(event.eventCreated)}
                    </div>

                    {/* SaaS icon */}
                    <div className="flex-shrink-0 mt-0.5">
                      <SaasIcon />
                    </div>

                    {/* Type badge */}
                    <div className="w-24 flex-shrink-0 pt-0.5">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold capitalize ${
                          event.type === "phishing" || event.type === "suspicious_phishing"
                            ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300"
                            : event.type === "malware" || event.type === "suspicious_malware"
                            ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                            : event.type === "dlp"
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                            : "bg-[var(--muted-bg)] text-[var(--muted)]"
                        }`}
                      >
                        {event.type.replace(/_/g, " ").toUpperCase()}
                      </span>
                    </div>

                    {/* Description */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-blue-600 dark:text-blue-400 leading-snug">
                        {event.description || "No description"}
                      </p>
                      {event.senderAddress && (
                        <p className="text-xs text-[var(--muted)] mt-0.5 truncate">
                          {event.senderAddress}
                        </p>
                      )}
                    </div>

                    {/* Severity badge */}
                    {event.severity && (
                      <div className="flex-shrink-0 pt-0.5">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${
                            Number(event.severity) >= 4
                              ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                              : Number(event.severity) >= 2
                              ? "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
                              : "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                          }`}
                        >
                          Sev {event.severity}
                        </span>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Pagination footer */}
            {filteredTableEvents.length > TABLE_PAGE_SIZE && (
              <div className="flex items-center justify-between px-5 py-3.5 border-t border-[var(--card-border)] bg-[var(--muted-bg)]">
                {/* Info */}
                <p className="text-xs text-[var(--muted)]">
                  Showing{" "}
                  <span className="font-medium text-[var(--foreground)]">
                    {(tablePage - 1) * TABLE_PAGE_SIZE + 1}–
                    {Math.min(tablePage * TABLE_PAGE_SIZE, filteredTableEvents.length)}
                  </span>{" "}
                  of{" "}
                  <span className="font-medium text-[var(--foreground)]">
                    {filteredTableEvents.length}
                  </span>
                </p>

                {/* Controls */}
                <div className="flex items-center gap-1">
                  {/* First */}
                  <button
                    onClick={() => setTablePage(1)}
                    disabled={tablePage === 1}
                    className="p-1.5 rounded-lg text-[var(--muted)] hover:bg-[var(--card-bg)] hover:text-[var(--foreground)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    aria-label="First page"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7M18 19l-7-7 7-7" />
                    </svg>
                  </button>

                  {/* Prev */}
                  <button
                    onClick={() => setTablePage((p) => Math.max(1, p - 1))}
                    disabled={tablePage === 1}
                    className="p-1.5 rounded-lg text-[var(--muted)] hover:bg-[var(--card-bg)] hover:text-[var(--foreground)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    aria-label="Previous page"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>

                  {/* Page numbers */}
                  {Array.from({ length: totalTablePages }, (_, i) => i + 1)
                    .filter((p) =>
                      p === 1 ||
                      p === totalTablePages ||
                      Math.abs(p - tablePage) <= 1
                    )
                    .reduce<(number | "…")[]>((acc, p, idx, arr) => {
                      if (idx > 0 && (p as number) - (arr[idx - 1] as number) > 1) acc.push("…");
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((item, idx) =>
                      item === "…" ? (
                        <span key={`ellipsis-${idx}`} className="px-1 text-xs text-[var(--muted)]">…</span>
                      ) : (
                        <button
                          key={item}
                          onClick={() => setTablePage(item as number)}
                          className={`min-w-[28px] h-7 rounded-lg text-xs font-medium transition-colors ${
                            tablePage === item
                              ? "bg-indigo-600 text-white"
                              : "text-[var(--muted)] hover:bg-[var(--card-bg)] hover:text-[var(--foreground)]"
                          }`}
                        >
                          {item}
                        </button>
                      )
                    )}

                  {/* Next */}
                  <button
                    onClick={() => setTablePage((p) => Math.min(totalTablePages, p + 1))}
                    disabled={tablePage === totalTablePages}
                    className="p-1.5 rounded-lg text-[var(--muted)] hover:bg-[var(--card-bg)] hover:text-[var(--foreground)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    aria-label="Next page"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>

                  {/* Last */}
                  <button
                    onClick={() => setTablePage(totalTablePages)}
                    disabled={tablePage === totalTablePages}
                    className="p-1.5 rounded-lg text-[var(--muted)] hover:bg-[var(--card-bg)] hover:text-[var(--foreground)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    aria-label="Last page"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M6 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
