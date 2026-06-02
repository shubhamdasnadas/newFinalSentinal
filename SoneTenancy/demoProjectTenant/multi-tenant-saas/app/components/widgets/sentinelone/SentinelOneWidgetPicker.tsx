"use client";

import { useEffect, useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

// ─── Widget definitions ───────────────────────────────────────────────────────
export interface S1WidgetDef {
  id: string;
  label: string;
  description: string;
  dbRoute: string;
  color: "emerald" | "red" | "orange" | "blue" | "purple" | "indigo";
  statOnly?: boolean;
  rssOnly?: boolean;
}

export const S1_WIDGETS: S1WidgetDef[] = [
  { id: "s1-mitigation", label: "Mitigation Status", description: "Threat mitigation state breakdown", dbRoute: "/api/sentinelone/db/threats", color: "emerald", statOnly: true },
  { id: "s1-severity", label: "Threat Severity", description: "Horizontal bar of threat confidence levels", dbRoute: "/api/sentinelone/db/threats", color: "red", statOnly: true },
  { id: "s1-threats", label: "Recent Threats", description: "Scrollable table of the 15 most recent threats", dbRoute: "/api/sentinelone/db/threats", color: "orange" },
  { id: "s1-agents", label: "Agent Status", description: "Table of all agents with active / inactive status", dbRoute: "/api/sentinelone/db/agents", color: "blue" },
  { id: "s1-app-agent", label: "Application Agents", description: "Application risk agents from s1_application_agent table", dbRoute: "/api/sentinelone/db/application-agent", color: "purple" },
  { id: "s1-app-cve", label: "Application CVEs", description: "Application vulnerability CVEs from s1_application_cve", dbRoute: "/api/sentinelone/db/application-cve", color: "red" },
  { id: "s1-device-control", label: "Device Control", description: "Device control events from s1_device_control table", dbRoute: "/api/sentinelone/db/device-control", color: "indigo" },
  { id: "s1-rss", label: "RSS Feed", description: "SentinelOne RSS security news from s1_rss table", dbRoute: "/api/sentinelone/db/rss", color: "emerald", rssOnly: true },
];

// ─── Colours ──────────────────────────────────────────────────────────────────
const ACCENT: Record<S1WidgetDef["color"], string> = {
  emerald: "#10b981", red: "#ef4444", orange: "#f97316",
  blue: "#3b82f6", purple: "#a855f7", indigo: "#6366f1",
};
const BADGE_COLOR: Record<S1WidgetDef["color"], string> = {
  emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  red: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  orange: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  blue: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  purple: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  indigo: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const toISODate = (d: Date) => d.toISOString().split("T")[0];
const subtractDays = (d: Date, n: number) => { const r = new Date(d); r.setDate(r.getDate() - n); return r; };

/** Flatten one level of nested object keys, returns dot-path strings */
function flattenKeys(obj: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === "object" && !Array.isArray(v))
      return flattenKeys(v as Record<string, unknown>, key);
    return [key];
  });
}

/** Safely read a dot-path value from an object */
function getPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, k) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[k] : undefined), obj);
}

/** Collect all unique flat keys from an array of records (sample first 20) */
function collectKeys(data: unknown[]): string[] {
  const set = new Set<string>();
  data.slice(0, 20).forEach(r => {
    if (r && typeof r === "object") flattenKeys(r as Record<string, unknown>).forEach(k => set.add(k));
  });
  return Array.from(set).sort();
}

/** Is a key's typical value numeric? */
function isNumericKey(data: unknown[], key: string): boolean {
  const sample = data.slice(0, 20).map(r => getPath(r, key)).filter(v => v != null);
  return sample.length > 0 && sample.every(v => typeof v === "number" || (typeof v === "string" && !isNaN(Number(v))));
}

/** Try multiple date paths commonly used in S1 / other APIs */
function extractDate(record: unknown): string {
  const paths = [
    "synced_at", "createdAt", "created_at", "date",
    "threatInfo.createdAt", "threatInfo.createdDate",
    "createdDate", "updatedAt", "updated_at"
  ];
  for (const p of paths) {
    const val = getPath(record, p);
    if (val) return String(val);
  }
  return "";
}

/** Detect if a value looks like any date string (ISO, RFC 2822, or other parseable) */
function looksLikeDate(val: unknown): boolean {
  if (typeof val !== "string" || val.length < 6) return false;
  // ISO: 2026-05-12... or 2026-05-12T...
  if (/^\d{4}-\d{2}-\d{2}/.test(val)) return true;
  // RFC 2822: "Mon, 02 Jun 2026 ..." or "02 Jun 2026 ..."
  if (/^\w{3},?\s+\d{1,2}\s+\w{3}\s+\d{4}/.test(val)) return true;
  // Other: "Jun 2 2026", "2026/05/12"
  if (/^\d{4}\/\d{2}\/\d{2}/.test(val)) return true;
  // Any string that parses to a valid date and isn't just a number
  if (!/^\d+$/.test(val.trim()) && !isNaN(Date.parse(val))) return true;
  return false;
}

/** Normalise any date value to YYYY-MM-DD for bucketing; returns "" if not parseable */
function toYMD(val: unknown): string {
  if (!val) return "";
  const s = String(val);
  // Already ISO YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  // Try generic Date.parse for RFC 2822, etc.
  const ms = Date.parse(s);
  if (!isNaN(ms)) return new Date(ms).toISOString().slice(0, 10);
  return "";
}

/** Normalise an X-axis value: if it's a date string, convert to YYYY-MM-DD */
function normaliseXVal(raw: unknown): string {
  const ymd = toYMD(raw);
  if (ymd) return ymd;
  return String(raw ?? "—").slice(0, 30);
}
function buildChartData(
  data: unknown[], xKey: string, yKey: string | "count",
  dateFrom: string, dateTo: string,
): { x: string; y: number }[] {
  // Detect whether the X field is date-like by sampling first 5 non-null values
  const sample = data.slice(0, 10).map(r => getPath(r, xKey)).filter(v => v != null);
  const xIsDate = sample.length > 0 && sample.every(v => looksLikeDate(v));

  // Filter by date range:
  // - If X is a date field, normalise to YYYY-MM-DD first (handles RFC 2822, ISO, etc.)
  // - Otherwise, fall back to extractDate() on the record
  const filtered = data.filter(r => {
    const dateStr = xIsDate
      ? toYMD(getPath(r, xKey))
      : extractDate(r).slice(0, 10);
    return (!dateFrom || dateStr >= dateFrom) && (!dateTo || dateStr <= dateTo);
  });

  const buckets: Record<string, number[]> = {};
  filtered.forEach(r => {
    const xVal = normaliseXVal(getPath(r, xKey));
    if (!buckets[xVal]) buckets[xVal] = [];
    if (yKey === "count") {
      buckets[xVal].push(1);
    } else {
      const yVal = Number(getPath(r, yKey) ?? 0);
      buckets[xVal].push(isNaN(yVal) ? 0 : yVal);
    }
  });

  const entries = Object.entries(buckets).map(([x, vals]) => ({
    x,
    y: yKey === "count" ? vals.length : vals.reduce((a, b) => a + b, 0),
  }));

  // Date fields: sort chronologically and show all days in range
  if (xIsDate) {
    return entries.sort((a, b) => a.x.localeCompare(b.x));
  }

  // Categorical fields: sort by value descending, cap at 20 bars
  return entries.sort((a, b) => b.y - a.y).slice(0, 20);
}

// ─── Cache ────────────────────────────────────────────────────────────────────
const dataCache: Record<string, { data: unknown[]; lastSyncedAt: string | null }> = {};

// ─── Mitigation stat box ──────────────────────────────────────────────────────
function MitigationBox({ data, loading }: { data: unknown[]; loading: boolean }) {
  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    data.forEach((r: any) => {
      const s = r?.mitigationStatus?.[0]?.status ?? r?.mitigation_status ?? "unknown";
      map[s] = (map[s] ?? 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [data]);

  if (loading) return <div className="h-32 bg-[var(--muted-bg)] rounded-xl animate-pulse" />;
  return (
    <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4">
      <p className="text-xs font-bold text-[var(--muted)] uppercase tracking-wider mb-3">Mitigation Status Breakdown</p>
      {counts.length === 0
        ? <p className="text-sm text-[var(--muted)]">No data — sync first.</p>
        : <div className="space-y-2">{counts.map(([s, c]) => (
          <div key={s} className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--foreground)] capitalize">{s}</span>
            <div className="flex items-center gap-2">
              <div className="w-28 h-2 rounded-full bg-[var(--muted-bg)] overflow-hidden">
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.round((c / data.length) * 100)}%` }} />
              </div>
              <span className="text-xs font-bold text-[var(--foreground)] w-8 text-right">{c}</span>
            </div>
          </div>
        ))}</div>}
    </div>
  );
}

// ─── Severity stat box ────────────────────────────────────────────────────────
function SeverityBox({ data, loading }: { data: unknown[]; loading: boolean }) {
  const SEV_COLOR: Record<string, string> = {
    malicious: "#ef4444", suspicious: "#f97316", low: "#22c55e",
    high: "#ef4444", medium: "#f97316", unknown: "#94a3b8",
  };
  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    data.forEach((r: any) => {
      const s = r?.confidenceLevel ?? r?.threatInfo?.confidenceLevel ?? r?.severity ?? "unknown";
      map[s] = (map[s] ?? 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [data]);

  if (loading) return <div className="h-32 bg-[var(--muted-bg)] rounded-xl animate-pulse" />;
  return (
    <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4">
      <p className="text-xs font-bold text-[var(--muted)] uppercase tracking-wider mb-3">Threat Severity / Confidence</p>
      {counts.length === 0
        ? <p className="text-sm text-[var(--muted)]">No data — sync first.</p>
        : <div className="space-y-2">{counts.map(([s, c]) => {
          const col = SEV_COLOR[s.toLowerCase()] ?? "#94a3b8";
          return (
            <div key={s} className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: col }} />
                <span className="text-xs font-medium text-[var(--foreground)] capitalize">{s}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-28 h-2 rounded-full bg-[var(--muted-bg)] overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${Math.round((c / data.length) * 100)}%`, background: col }} />
                </div>
                <span className="text-xs font-bold text-[var(--foreground)] w-8 text-right">{c}</span>
              </div>
            </div>
          );
        })}</div>}
    </div>
  );
}

// ─── Human-readable header label ─────────────────────────────────────────────
function labelFor(key: string): string {
  // Take last segment of dot-path, then format camelCase/snake_case → Title Case
  const seg = key.split(".").pop() ?? key;
  return seg
    .replace(/([a-z])([A-Z])/g, "$1 $2")   // camelCase split
    .replace(/_/g, " ")                      // snake_case split
    .replace(/\b\w/g, c => c.toUpperCase()); // title case
}

// ─── Fallback table preview ───────────────────────────────────────────────────
interface TablePreviewProps {
  data: unknown[];
  loading: boolean;
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (v: string) => void;
  onDateToChange: (v: string) => void;
}

function TablePreview({ data, loading, dateFrom, dateTo, onDateFromChange, onDateToChange }: TablePreviewProps) {
  const allKeys = useMemo(() => collectKeys(data), [data]);

  // Find all keys whose sampled values look like dates
  const dateKeys = useMemo(() => {
    return allKeys.filter(k => {
      const samples = data.slice(0, 10).map(r => getPath(r, k)).filter(Boolean);
      return samples.length > 0 && samples.some(v => looksLikeDate(v));
    });
  }, [allKeys, data]);

  // Auto-select the best default date key
  const defaultDateKey = useMemo(() => {
    const preferred = [
      "synced_at", "createdAt", "created_at", "date",
      "published", "pubDate", "publishedDate",           // RSS
      "threatInfo.createdAt", "threatInfo.createdDate", "createdDate",
      "detectionDate", "markedDate", "lastScanDate",     // CVE / device-control
    ];
    return preferred.find(k => dateKeys.includes(k)) ?? dateKeys[0] ?? allKeys[0] ?? "";
  }, [dateKeys, allKeys]);

  // The user-selected date column used for filtering AND the pinned first column
  const [dateKey, setDateKey] = useState<string>("");

  // Sync default when data/keys change
  useEffect(() => {
    setDateKey(defaultDateKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultDateKey]);

  const activeDateKey = dateKey || defaultDateKey;

  const nonDateKeys = useMemo(
    () => allKeys.filter(k => k !== activeDateKey),
    [allKeys, activeDateKey]
  );

  // Visible extra columns the user toggled on
  const [visibleCols, setVisibleCols] = useState<string[]>([]);
  useEffect(() => {
    setVisibleCols(nonDateKeys.slice(0, 4));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonDateKeys.join(",")]);

  const toggleCol = (k: string) =>
    setVisibleCols(prev =>
      prev.includes(k) ? prev.filter(c => c !== k) : [...prev, k]
    );

  // Filter rows using the user-selected date key — normalise any format to YYYY-MM-DD
  const filtered = useMemo(() => {
    if (!activeDateKey) return data.slice(0, 50);
    return data.filter(r => {
      const day = toYMD(getPath(r, activeDateKey));
      return (!dateFrom || day >= dateFrom) && (!dateTo || day <= dateTo);
    }).slice(0, 50);
  }, [data, activeDateKey, dateFrom, dateTo]);

  if (loading) return <div className="h-40 bg-[var(--muted-bg)] rounded-xl animate-pulse" />;

  return (
    <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] overflow-hidden">
      {/* ── Controls ── */}
      <div className="px-3 py-2.5 border-b border-[var(--card-border)] space-y-2 bg-[var(--muted-bg)]">

        {/* Date column selector + range pickers on one row */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Date column picker */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wide shrink-0">Date column:</span>
            <div className="relative">
              <select
                value={activeDateKey}
                onChange={e => setDateKey(e.target.value)}
                className="appearance-none pl-2 pr-6 py-0.5 rounded border border-[var(--card-border)] bg-[var(--card-bg)] text-[10px] font-semibold text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                {(dateKeys.length > 0 ? dateKeys : allKeys).map(k => (
                  <option key={k} value={k}>{labelFor(k)}</option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[var(--muted)]">
                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </span>
            </div>
          </div>

          {/* From / To pickers */}
          <div className="flex items-center gap-1">
            <label className="text-[10px] text-[var(--muted)]">From</label>
            <input type="date" value={dateFrom} max={dateTo} onChange={e => onDateFromChange(e.target.value)}
              className="text-[10px] px-1.5 py-0.5 rounded border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-emerald-500" />
          </div>
          <div className="flex items-center gap-1">
            <label className="text-[10px] text-[var(--muted)]">To</label>
            <input type="date" value={dateTo} min={dateFrom} onChange={e => onDateToChange(e.target.value)}
              className="text-[10px] px-1.5 py-0.5 rounded border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-emerald-500" />
          </div>
          <span className="text-[10px] text-[var(--muted)] ml-auto">{filtered.length} rows</span>
        </div>

        {/* Extra column picker pills */}
        {nonDateKeys.length > 0 && (
          <div className="flex items-start gap-1.5 flex-wrap">
            <span className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wide mt-0.5 shrink-0">Columns:</span>
            {nonDateKeys.slice(0, 24).map(k => {
              const on = visibleCols.includes(k);
              return (
                <button key={k} type="button" onClick={() => toggleCol(k)} title={k}
                  className={`px-1.5 py-0.5 rounded text-[9px] font-medium border transition-colors ${on
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                      : "border-[var(--card-border)] text-[var(--muted)] hover:border-emerald-400 hover:text-[var(--foreground)]"
                    }`}>
                  {labelFor(k)}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Table ── */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-20 gap-1">
          <span className="text-xs text-[var(--muted)]">No records in selected date range.</span>
          <span className="text-[10px] text-[var(--muted)] italic">
            Try a wider range or select a different date column above.
          </span>
        </div>
      ) : (
        <div className="overflow-auto max-h-52">
          <table className="w-full text-[10px] border-separate border-spacing-0">
            <thead>
              <tr>
                {/* Pinned date column */}
                <th className="sticky left-0 top-0 z-20 px-2 py-1.5 text-left font-bold text-[var(--muted)] uppercase tracking-wide whitespace-nowrap bg-[var(--muted-bg)] border-b border-r border-[var(--card-border)]">
                  {labelFor(activeDateKey)}
                </th>
                {visibleCols.map(col => (
                  <th key={col} className="sticky top-0 z-10 px-2 py-1.5 text-left font-bold text-[var(--muted)] uppercase tracking-wide whitespace-nowrap bg-[var(--muted-bg)] border-b border-[var(--card-border)]">
                    {labelFor(col)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, i) => {
                const rawDate = String(getPath(row, activeDateKey) ?? "—");
                const displayDate = toYMD(rawDate) || rawDate.slice(0, 20);
                return (
                  <tr key={i} className="hover:bg-[var(--muted-bg)]/50">
                    {/* Pinned date cell */}
                    <td className="sticky left-0 z-10 px-2 py-1 font-medium text-[var(--foreground)] whitespace-nowrap bg-[var(--card-bg)] border-b border-r border-[var(--card-border)]">
                      {displayDate}
                    </td>
                    {visibleCols.map(col => {
                      const val = getPath(row, col);
                      const display = val == null
                        ? "—"
                        : typeof val === "object"
                          ? JSON.stringify(val).slice(0, 60)
                          : String(val).slice(0, 60);
                      return (
                        <td key={col} className="px-2 py-1 text-[var(--foreground)] whitespace-nowrap border-b border-[var(--card-border)]">
                          {display}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── RSS news card preview ────────────────────────────────────────────────────
interface RssPreviewProps { data: unknown[]; loading: boolean; }

function RssFeedPreview({ data, loading }: RssPreviewProps) {
  const today = toISODate(new Date());
  const defaultFrom = toISODate(subtractDays(new Date(), 365));
  const [dateFrom, setDateFrom] = useState(defaultFrom);
  const [dateTo, setDateTo] = useState(today);

  const items = useMemo(() => {
    return data
      .map((r: any) => {
        const pubRaw = r?.published ?? r?.pubDate ?? r?.publishedDate ?? r?.date ?? "";
        const pubDate = toYMD(pubRaw) ?? "";
        const title = r?.title ?? r?.name ?? r?.summary ?? "Untitled";
        const link = r?.link ?? r?.guidislink ?? r?.links?.[0]?.href ?? r?.links?.[0] ?? "#";
        // Try common image paths in RSS/Atom feeds
        // Extract enclosure image from links array (rel === "enclosure")
        const enclosureLink = Array.isArray(r?.links)
          ? r.links.find((l: any) => l?.rel === "enclosure")?.href ?? null
          : null;
        const image =
          enclosureLink ??
          r?.media_thumbnail ?? r?.enclosure?.url ?? r?.image?.url ??
          r?.["media:thumbnail"]?.url ?? r?.thumbnail ?? null;
        const summary = r?.summary ?? r?.content ?? r?.description ?? "";
        return { pubDate, title: String(title), link: String(link), image: image ? String(image) : null, summary: String(summary) };
      })
      .filter(item => {
        if (!item.pubDate) return true; // keep if no date
        return (!dateFrom || item.pubDate >= dateFrom) && (!dateTo || item.pubDate <= dateTo);
      })
      .sort((a, b) => b.pubDate.localeCompare(a.pubDate));
  }, [data, dateFrom, dateTo]);

  if (loading) return <div className="h-48 bg-[var(--muted-bg)] rounded-xl animate-pulse" />;

  return (
    <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] overflow-hidden">
      {/* Date range filter */}
      <div className="px-3 py-2 border-b border-[var(--card-border)] bg-[var(--muted-bg)] flex items-center gap-2 flex-wrap">
        <span className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wide">Published:</span>
        <div className="flex items-center gap-1">
          <label className="text-[10px] text-[var(--muted)]">From</label>
          <input type="date" value={dateFrom} max={dateTo} onChange={e => setDateFrom(e.target.value)}
            className="text-[10px] px-1.5 py-0.5 rounded border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-emerald-500" />
        </div>
        <div className="flex items-center gap-1">
          <label className="text-[10px] text-[var(--muted)]">To</label>
          <input type="date" value={dateTo} min={dateFrom} onChange={e => setDateTo(e.target.value)}
            className="text-[10px] px-1.5 py-0.5 rounded border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-emerald-500" />
        </div>
        <span className="text-[10px] text-[var(--muted)] ml-auto">{items.length} articles</span>
      </div>

      {/* News cards */}
      {items.length === 0 ? (
        <div className="flex items-center justify-center h-20 text-xs text-[var(--muted)]">No articles in selected date range.</div>
      ) : (
        <div className="overflow-y-auto max-h-64 divide-y divide-[var(--card-border)]">
          {items.map((item, i) => (
            <a key={i} href={item.link} target="_blank" rel="noopener noreferrer"
              className="flex items-start gap-3 px-3 py-2.5 hover:bg-[var(--muted-bg)] transition-colors group">
              {/* Thumbnail */}
              <div className="shrink-0 w-12 h-12 rounded-lg overflow-hidden bg-[var(--muted-bg)] flex items-center justify-center border border-[var(--card-border)]">
                {item.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.image} alt="" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                ) : (
                  <svg className="w-5 h-5 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9" />
                  </svg>
                )}
              </div>
              {/* Text */}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-[var(--foreground)] group-hover:text-emerald-600 dark:group-hover:text-emerald-400 line-clamp-2 leading-snug">
                  {item.title}
                </p>
                {item.summary && (
                  <p className="text-[10px] text-[var(--muted)] mt-0.5 line-clamp-1">{item.summary.replace(/<[^>]+>/g, "")}</p>
                )}
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1 font-medium">{item.pubDate || "—"}</p>
              </div>
              {/* Arrow */}
              <svg className="w-3 h-3 text-[var(--muted)] group-hover:text-emerald-500 shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Configurable graph preview ───────────────────────────────────────────────
interface GraphPreviewProps {
  data: unknown[];
  loading: boolean;
  color: string;
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (v: string) => void;
  onDateToChange: (v: string) => void;
}

function GraphPreview({ data, loading, color, dateFrom, dateTo, onDateFromChange, onDateToChange }: GraphPreviewProps) {
  const allKeys = useMemo(() => collectKeys(data), [data]);

  // X-axis: only date-like keys
  const dateKeys = useMemo(() =>
    allKeys.filter(k => {
      const samples = data.slice(0, 10).map(r => getPath(r, k)).filter(Boolean);
      return samples.length > 0 && samples.some(v => looksLikeDate(v));
    }),
    [allKeys, data]
  );

  const [xKey, setXKey] = useState<string>("");
  // Y-axis is always "count" — no other option needed
  const yKey = "count";

  // Reset when data keys change
  useEffect(() => { setXKey(""); }, [allKeys.join(",")]);

  const bothSet = xKey !== "";

  const chartData = useMemo(() => {
    if (!bothSet) return [];
    return buildChartData(data, xKey, yKey, dateFrom, dateTo);
  }, [data, xKey, dateFrom, dateTo, bothSet]);

  if (loading) return <div className="h-48 bg-[var(--muted-bg)] rounded-xl animate-pulse" />;

  // ── Shared axis picker panel ──────────────────────────────────────────────
  const AxisPanel = (
    <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-3 space-y-2">
      {!bothSet && <p className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wide">Configure Chart</p>}
      <div className="grid grid-cols-2 gap-2">
        {/* X-axis — date keys only */}
        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-[var(--muted)] uppercase tracking-wide">X-Axis (date field)</label>
          <div className="relative">
            <select value={xKey} onChange={e => setXKey(e.target.value)}
              className={`w-full appearance-none pl-2 pr-7 py-1.5 rounded-lg border bg-[var(--card-bg)] text-xs text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-emerald-500 ${xKey ? "border-emerald-500 font-semibold" : "border-[var(--card-border)]"}`}>
              <option value="">— select date field —</option>
              {dateKeys.map(k => <option key={k} value={k}>{labelFor(k)}</option>)}
            </select>
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[var(--muted)]">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </span>
          </div>
        </div>
        {/* Y-axis — always Count, shown as a readonly badge */}
        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-[var(--muted)] uppercase tracking-wide">Y-Axis (value)</label>
          <div className="flex items-center h-[30px] px-2 rounded-lg border border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20">
            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">Count (records per day)</span>
          </div>
        </div>
      </div>
      {/* Date range */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wide">Date range:</span>
        <div className="flex items-center gap-1">
          <label className="text-[10px] text-[var(--muted)]">From</label>
          <input type="date" value={dateFrom} max={dateTo} onChange={e => onDateFromChange(e.target.value)}
            className="text-[10px] px-1.5 py-0.5 rounded border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-emerald-500" />
        </div>
        <div className="flex items-center gap-1">
          <label className="text-[10px] text-[var(--muted)]">To</label>
          <input type="date" value={dateTo} min={dateFrom} onChange={e => onDateToChange(e.target.value)}
            className="text-[10px] px-1.5 py-0.5 rounded border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-emerald-500" />
        </div>
        {bothSet && (
          <span className="text-[10px] text-[var(--muted)] ml-auto">
            {chartData.length} {chartData.length === 1 ? "group" : "groups"} · {chartData.reduce((s, d) => s + d.y, 0)} records
          </span>
        )}
      </div>
      {!bothSet && (
        <p className="text-[9px] text-[var(--muted)] italic">
          Select a date field to render the chart. Leave empty to browse data in table format below.
        </p>
      )}
    </div>
  );

  // Neither axis set → show table below the axis panel
  if (!bothSet) {
    return (
      <div className="space-y-2">
        {AxisPanel}
        <TablePreview
          data={data} loading={false}
          dateFrom={dateFrom} dateTo={dateTo}
          onDateFromChange={onDateFromChange} onDateToChange={onDateToChange}
        />
      </div>
    );
  }

  // Both axes set → show chart
  return (
    <div className="space-y-2">
      {AxisPanel}
      <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-3">
        {chartData.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-28 gap-1">
            <span className="text-xs text-[var(--muted)]">No records match the selected date range.</span>
            <span className="text-[10px] text-[var(--muted)] italic">Try widening the date range or checking that data has been synced.</span>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={chartData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" vertical={false} />
              <XAxis
                dataKey="x"
                tick={{ fontSize: 9, fill: "var(--muted)" }}
                interval={0}
                tickFormatter={v => String(v).slice(0, 12)}
              />
              <YAxis tick={{ fontSize: 9, fill: "var(--muted)" }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid var(--card-border)", background: "var(--card-bg)" }}
                labelStyle={{ color: "var(--foreground)", fontWeight: 600 }}
                formatter={(v) => [v ?? 0, yKey === "count" ? "Count" : labelFor(yKey)]}
              />
              <Bar dataKey="y" fill={color} radius={[3, 3, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  selected: string[];
  onToggle: (id: string) => void;
  onAdd: (ids: string[]) => void;
  onCancel: () => void;
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function SentinelOneWidgetPicker({ selected, onToggle, onAdd, onCancel }: Props) {
  const today = toISODate(new Date());
  const defaultFrom = toISODate(subtractDays(new Date(), 30));

  const [activeId, setActiveId] = useState<string>(S1_WIDGETS[0].id);
  const [previewData, setPreviewData] = useState<unknown[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [dateFrom, setDateFrom] = useState(defaultFrom);
  const [dateTo, setDateTo] = useState(today);

  const activeWidget = S1_WIDGETS.find(w => w.id === activeId)!;
  const isSelected = selected.includes(activeId);

  useEffect(() => {
    const route = activeWidget.dbRoute;
    if (dataCache[route]) {
      const c = dataCache[route];
      setPreviewData(c.data); setLastSyncedAt(c.lastSyncedAt); setTotal(c.data.length); setPreviewLoading(false);
      return;
    }
    setPreviewLoading(true);
    fetch(route, { credentials: "include" })
      .then(r => r.json())
      .then(d => {
        const rows = Array.isArray(d.data) ? d.data : [];
        const synced = d.lastSyncedAt ?? null;
        dataCache[route] = { data: rows, lastSyncedAt: synced };
        setPreviewData(rows); setLastSyncedAt(synced); setTotal(rows.length); setPreviewLoading(false);
      })
      .catch(() => { setPreviewData([]); setTotal(0); setPreviewLoading(false); });
  }, [activeId]);

  return (
    <div className="flex flex-col">
      {/* ── Header: dropdown ── */}
      <div className="px-5 pt-4 pb-3 border-b border-[var(--card-border)]">
        <p className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider mb-2">Select SentinelOne Widget</p>
        <div className="relative">
          <select value={activeId} onChange={e => setActiveId(e.target.value)}
            className="w-full appearance-none pl-3 pr-9 py-2.5 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] text-sm font-semibold text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer">
            {S1_WIDGETS.map(w => <option key={w.id} value={w.id}>{w.label}</option>)}
          </select>
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)]">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </span>
        </div>
      </div>

      {/* ── Widget meta ── */}
      <div className="px-5 py-3 flex items-start justify-between gap-3 border-b border-[var(--card-border)]">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-[var(--foreground)]">{activeWidget.label}</span>
            <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${BADGE_COLOR[activeWidget.color]}`}>
              {activeWidget.dbRoute.split("/").pop()}
            </span>
            {isSelected && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">✓ Added</span>
            )}
          </div>
          <p className="text-xs text-[var(--muted)] mt-0.5">{activeWidget.description}</p>
        </div>
        <div className="text-right flex-shrink-0">
          {previewLoading
            ? <div className="h-5 w-16 bg-[var(--muted-bg)] rounded animate-pulse" />
            : <>
              <p className="text-base font-bold text-[var(--foreground)]">
                {total ?? 0} <span className="text-[10px] font-normal text-[var(--muted)]">records</span>
              </p>
              {lastSyncedAt && <p className="text-[10px] text-[var(--muted)]">Synced {new Date(lastSyncedAt).toLocaleDateString()}</p>}
              {total === 0 && <p className="text-[10px] text-amber-500 font-medium">Sync first</p>}
            </>}
        </div>
      </div>

      {/* ── Preview ── */}
      <div className="px-5 py-4 space-y-3">
        <p className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider">Preview</p>
        {activeWidget.statOnly
          ? activeId === "s1-mitigation"
            ? <MitigationBox data={previewData} loading={previewLoading} />
            : <SeverityBox data={previewData} loading={previewLoading} />
          : activeWidget.rssOnly
            ? <RssFeedPreview data={previewData} loading={previewLoading} />
            : <GraphPreview
              data={previewData} loading={previewLoading} color={ACCENT[activeWidget.color]}
              dateFrom={dateFrom} dateTo={dateTo}
              onDateFromChange={setDateFrom} onDateToChange={setDateTo}
            />}
      </div>

      {/* ── Footer ── */}
      <div className="px-5 py-4 border-t border-[var(--card-border)] bg-[var(--muted-bg)] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => S1_WIDGETS.forEach(w => { if (!selected.includes(w.id)) onToggle(w.id); })}
            className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">Select all</button>
          <span className="text-[var(--muted)] text-xs">·</span>
          <button type="button" onClick={() => selected.forEach(id => onToggle(id))}
            className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">Clear</button>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onCancel}
            className="px-4 py-2 rounded-lg text-xs font-semibold text-[var(--muted)] hover:bg-[var(--card-border)] transition-colors">
            Cancel
          </button>
          <button type="button" onClick={() => onToggle(activeId)}
            className={`px-4 py-2 rounded-lg text-xs font-semibold border transition-colors ${isSelected
                ? "border-emerald-500 text-emerald-600 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/20"
                : "border-[var(--card-border)] text-[var(--foreground)] hover:bg-[var(--muted-bg)]"
              }`}>
            {isSelected ? "✓ Selected" : "+ Select"}
          </button>
          <button onClick={() => onAdd(selected)} disabled={selected.length === 0}
            className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 dark:disabled:bg-emerald-900 text-white transition-colors shadow-sm disabled:cursor-not-allowed">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            Add {selected.length > 0 ? `${selected.length} Widget${selected.length > 1 ? "s" : ""}` : "Widget"}
          </button>
        </div>
      </div>
    </div>
  );
}
