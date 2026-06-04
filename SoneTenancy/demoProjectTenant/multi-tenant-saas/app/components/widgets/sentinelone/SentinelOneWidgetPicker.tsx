"use client";

import { useEffect, useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
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

// ─── Exported config types (passed to dashboard on Add) ───────────────────────
export type S1WidgetViewMode = "graph" | "table" | "stat" | "rss";

/** Full per-widget config that the dashboard uses to render exactly what was configured */
export interface S1WidgetConfig {
  id: string;
  viewMode: S1WidgetViewMode;
  // graph config
  xKey?: string;
  yKey?: string;
  dateFrom?: string;
  dateTo?: string;
  // table config
  dateKey?: string;
  visibleCols?: string[];
}



// ─── Helpers ──────────────────────────────────────────────────────────────────
const toISODate = (d: Date) => d.toISOString().split("T")[0];
const subtractDays = (d: Date, n: number) => { const r = new Date(d); r.setDate(r.getDate() - n); return r; };

function flattenKeys(obj: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === "object" && !Array.isArray(v))
      return flattenKeys(v as Record<string, unknown>, key);
    return [key];
  });
}

export function getPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>(
    (acc, k) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[k] : undefined), obj
  );
}

export function collectKeys(data: unknown[]): string[] {
  const set = new Set<string>();
  data.slice(0, 20).forEach(r => {
    if (r && typeof r === "object") flattenKeys(r as Record<string, unknown>).forEach(k => set.add(k));
  });
  return Array.from(set).sort();
}

function extractDate(record: unknown): string {
  const paths = [
    "synced_at",
    "createdAt",
    "created_at",
    "date",

    // ✅ SentinelOne CVE date fields
    "publishedDate",
    "detectionDate",
    "detectedDate",
    "markedDate",
    "lastScanDate",

    "threatInfo.createdAt",
    "threatInfo.createdDate",
    "createdDate",
    "updatedAt",
    "updated_at",
  ];

  for (const p of paths) {
    const val = getPath(record, p);
    if (val) return String(val);
  }

  return "";
}

export function looksLikeDate(val: unknown): boolean {
  if (typeof val !== "string" || val.length < 6) return false;
  if (/^\d{4}-\d{2}-\d{2}/.test(val)) return true;
  if (/^\w{3},?\s+\d{1,2}\s+\w{3}\s+\d{4}/.test(val)) return true;
  if (/^\d{4}\/\d{2}\/\d{2}/.test(val)) return true;
  if (!/^\d+$/.test(val.trim()) && !isNaN(Date.parse(val))) return true;
  return false;
}

export function toYMD(val: unknown): string {
  if (!val) return "";
  const s = String(val);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const ms = Date.parse(s);
  if (!isNaN(ms)) return new Date(ms).toISOString().slice(0, 10);
  return "";
}

function normaliseXVal(raw: unknown): string {
  const ymd = toYMD(raw);
  if (ymd) return ymd;
  return String(raw ?? "—").slice(0, 30);
}

export function buildChartData(
  data: unknown[],
  xKey: string,
  yKey: string,
  dateFrom: string,
  dateTo: string
): { x: string; y: number }[] {
  const filtered = data.filter((r) => {
    const dateStr = toYMD(extractDate(r));

    // ✅ If no date found, don't remove record
    if (!dateStr) return true;

    return (!dateFrom || dateStr >= dateFrom) && (!dateTo || dateStr <= dateTo);
  });

  const buckets: Record<string, number> = {};

  filtered.forEach((r) => {
    const xVal = String(getPath(r, xKey) ?? "—");

    if (yKey === "count") {
      buckets[xVal] = (buckets[xVal] ?? 0) + 1;
    } else {
      const yVal = String(getPath(r, yKey) ?? "—");

      // ✅ CVE + EndpointName group count
      const key = `${xVal} | ${yVal}`;
      buckets[key] = (buckets[key] ?? 0) + 1;
    }
  });

  return Object.entries(buckets)
    .map(([x, y]) => ({ x, y }))
    .sort((a, b) => b.y - a.y)
    .slice(0, 30);
}

export function labelFor(key: string): string {
  const seg = key.split(".").pop() ?? key;
  return seg.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
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
      {counts.length === 0 ? <p className="text-sm text-[var(--muted)]">No data — sync first.</p>
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
      {counts.length === 0 ? <p className="text-sm text-[var(--muted)]">No data — sync first.</p>
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

// ─── RSS Feed preview (read-only in picker) ───────────────────────────────────
function RssFeedPreview({ data, loading }: { data: unknown[]; loading: boolean }) {
  const today = toISODate(new Date());
  const defaultFrom = toISODate(subtractDays(new Date(), 365));
  const [dateFrom, setDateFrom] = useState(defaultFrom);
  const [dateTo, setDateTo] = useState(today);
  const items = useMemo(() => {
    return data.map((r: any) => {
      const pubDate = toYMD(r?.published ?? r?.pubDate ?? r?.publishedDate ?? r?.date ?? "") ?? "";
      const title = String(r?.title ?? r?.name ?? r?.summary ?? "Untitled");
      const link = String(r?.link ?? r?.guidislink ?? r?.links?.[0]?.href ?? r?.links?.[0] ?? "#");
      const enclosureLink = Array.isArray(r?.links) ? r.links.find((l: any) => l?.rel === "enclosure")?.href ?? null : null;
      const image = enclosureLink ?? r?.media_thumbnail ?? r?.enclosure?.url ?? r?.image?.url ?? r?.["media:thumbnail"]?.url ?? r?.thumbnail ?? null;
      const summary = String(r?.summary ?? r?.content ?? r?.description ?? "");
      return { pubDate, title, link, image: image ? String(image) : null, summary };
    })
      .filter(item => !item.pubDate || ((!dateFrom || item.pubDate >= dateFrom) && (!dateTo || item.pubDate <= dateTo)))
      .sort((a, b) => b.pubDate.localeCompare(a.pubDate));
  }, [data, dateFrom, dateTo]);
  if (loading) return <div className="h-48 bg-[var(--muted-bg)] rounded-xl animate-pulse" />;
  return (
    <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] overflow-hidden">
      <div className="px-3 py-2 border-b border-[var(--card-border)] bg-[var(--muted-bg)] flex items-center gap-2 flex-wrap">
        <span className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wide">Published:</span>
        <div className="flex items-center gap-1"><label className="text-[10px] text-[var(--muted)]">From</label>
          <input type="date" value={dateFrom} max={dateTo} onChange={e => setDateFrom(e.target.value)} className="text-[10px] px-1.5 py-0.5 rounded border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-emerald-500" /></div>
        <div className="flex items-center gap-1"><label className="text-[10px] text-[var(--muted)]">To</label>
          <input type="date" value={dateTo} min={dateFrom} onChange={e => setDateTo(e.target.value)} className="text-[10px] px-1.5 py-0.5 rounded border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-emerald-500" /></div>
        <span className="text-[10px] text-[var(--muted)] ml-auto">{items.length} articles</span>
      </div>
      {items.length === 0 ? <div className="flex items-center justify-center h-20 text-xs text-[var(--muted)]">No articles in selected date range.</div>
        : <div className="overflow-y-auto max-h-64 divide-y divide-[var(--card-border)]">
          {items.map((item, i) => (
            <a key={i} href={item.link} target="_blank" rel="noopener noreferrer" className="flex items-start gap-3 px-3 py-2.5 hover:bg-[var(--muted-bg)] transition-colors group">
              <div className="shrink-0 w-12 h-12 rounded-lg overflow-hidden bg-[var(--muted-bg)] flex items-center justify-center border border-[var(--card-border)]">
                {item.image
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={item.image} alt="" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  : <svg className="w-5 h-5 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9" /></svg>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-[var(--foreground)] group-hover:text-emerald-600 dark:group-hover:text-emerald-400 line-clamp-2 leading-snug">{item.title}</p>
                {item.summary && <p className="text-[10px] text-[var(--muted)] mt-0.5 line-clamp-1">{item.summary.replace(/<[^>]+>/g, "")}</p>}
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1 font-medium">{item.pubDate || "—"}</p>
              </div>
              <svg className="w-3 h-3 text-[var(--muted)] group-hover:text-emerald-500 shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
            </a>
          ))}
        </div>}
    </div>
  );
}

// ─── Graph preview (controlled — all config lifted to parent) ─────────────────
interface GraphPreviewProps {
  data: unknown[];
  loading: boolean;
  color: string;
  xKey: string;
  yKey: string;
  onXKeyChange: (k: string) => void;
  onYKeyChange: (k: string) => void;
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (v: string) => void;
  onDateToChange: (v: string) => void;
}

function CustomTooltip({
  active,
  payload,
  label,
  data,
  xKey,
  yKey,
  dateFrom,
  dateTo,
}: any) {
  if (!active || !payload?.length) return null;

  const mainX = String(label).includes(" | ")
    ? String(label).split(" | ")[0]
    : String(label);

  const breakdown: Record<string, number> = {};

  data.forEach((r: any) => {
    const dateStr = toYMD(extractDate(r));

    if (dateStr && dateFrom && dateStr < dateFrom) return;
    if (dateStr && dateTo && dateStr > dateTo) return;

    const rowX = String(getPath(r, xKey) ?? "—");
    if (rowX !== mainX) return;

    const key =
      yKey === "count" ? "Records" : String(getPath(r, yKey) ?? "—");

    breakdown[key] = (breakdown[key] ?? 0) + 1;
  });

  const total = Object.values(breakdown).reduce(
    (sum, count) => sum + count,
    0
  );

  return (
    <div className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-2 shadow-lg min-w-[220px]">
      <p className="text-xs font-bold text-[var(--foreground)] mb-1">
        {mainX}
      </p>

      <div className="flex justify-between text-xs">
        <span className="text-[var(--muted)]">Total Count</span>
        <span className="font-bold text-[var(--foreground)]">{total}</span>
      </div>

      <div className="mt-2 pt-2 border-t border-[var(--card-border)] space-y-1 max-h-36 overflow-auto">
        {Object.entries(breakdown).map(([name, count]) => (
          <div key={name} className="flex justify-between gap-4 text-xs">
            <span className="text-[var(--foreground)] truncate">{name}</span>
            <span className="font-bold text-emerald-600">{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function getSeverityColor(severity: string) {
  const s = severity?.toLowerCase();

  if (s === "low") return "#D1F25E";      // light blue
  if (s === "medium") return "#FFAC1C";   // light yellow
  if (s === "high") return "#EE4B2B";     // light red
  if (s === "critical") return "#eee123"


  return "#d1d5db"; // default gray
}

function GraphPreview({
  data,
  loading,
  color,
  xKey,
  yKey,
  onXKeyChange,
  onYKeyChange,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
}: GraphPreviewProps) {
  const allKeys = useMemo(() => collectKeys(data), [data]);
  console.log("allKeys", allKeys);
  const yAxisOptions = useMemo(() => {
    return ["count", "endpointName"].filter(
      (k) => k === "count" || allKeys.includes(k)
    );
  }, [allKeys]);
  const dateKeys = useMemo(
    () =>
      allKeys.filter((k) => {
        // Always include cveId
        if (k === "cveId") return true;

        const samples = data
          .slice(0, 10)
          .map((r) => getPath(r, k))
          .filter(Boolean);

        return (
          samples.length > 0 &&
          samples.some((v) => looksLikeDate(v))
        );
      }),
    [allKeys, data]
  );

  const bothSet = xKey !== "" && yKey !== "";

  const chartData = useMemo(() => {
    if (!bothSet) return [];
    return buildChartData(data, xKey, yKey, dateFrom, dateTo);
  }, [data, xKey, yKey, dateFrom, dateTo, bothSet]);

  const severityByCve = useMemo(() => {
    const map: Record<string, string> = {};

    data.forEach((r: any) => {
      const cve = String(getPath(r, "cveId") ?? "");
      const severity = String(getPath(r, "severity") ?? "");

      if (cve && severity && !map[cve]) {
        map[cve] = severity;
      }
    });

    return map;
  }, [data]);
  if (loading) return <div className="h-48 bg-[var(--muted-bg)] rounded-xl animate-pulse" />;

  return (
    <div className="space-y-2">
      <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-3 space-y-2">
        {!bothSet && <p className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wide">Configure Chart</p>}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-[var(--muted)] uppercase tracking-wide">X-Axis (date field)</label>
            <div className="relative">
              <select value={xKey} onChange={e => onXKeyChange(e.target.value)}
                className={`w-full appearance-none pl-2 pr-7 py-1.5 rounded-lg border bg-[var(--card-bg)] text-xs text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-emerald-500 ${xKey ? "border-emerald-500 font-semibold" : "border-[var(--card-border)]"}`}>
                <option value="">— select date field —</option>
                {dateKeys.map(k => <option key={k} value={k}>{labelFor(k)}</option>)}
              </select>
              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[var(--muted)]">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </span>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-[var(--muted)] uppercase tracking-wide">Y-Axis (value)</label>
            {/* <div className="flex items-center h-[30px] px-2 rounded-lg border border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20">
              
            </div> */}
            <select
              value={yKey}
              onChange={(e) => onYKeyChange(e.target.value)}
              className={`w-full appearance-none pl-2 pr-7 py-1.5 rounded-lg border bg-[var(--card-bg)] text-xs text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-emerald-500 ${yKey ? "border-emerald-500 font-semibold" : "border-[var(--card-border)]"
                }`}
            >
              <option value="">— select value —</option>
              {yAxisOptions.map((k) => (
                <option key={k} value={k}>
                  {k === "count" ? "Count" : labelFor(k)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wide">Date range:</span>
          <div className="flex items-center gap-1"><label className="text-[10px] text-[var(--muted)]">From</label>
            <input type="date" value={dateFrom} max={dateTo} onChange={e => onDateFromChange(e.target.value)} className="text-[10px] px-1.5 py-0.5 rounded border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-emerald-500" /></div>
          <div className="flex items-center gap-1"><label className="text-[10px] text-[var(--muted)]">To</label>
            <input type="date" value={dateTo} min={dateFrom} onChange={e => onDateToChange(e.target.value)} className="text-[10px] px-1.5 py-0.5 rounded border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-emerald-500" /></div>
          {bothSet && <span className="text-[10px] text-[var(--muted)] ml-auto">{chartData.length} groups · {chartData.reduce((s, d) => s + d.y, 0)} records</span>}
        </div>
        {!bothSet && <p className="text-[9px] text-[var(--muted)] italic">Select a date field to render the chart.</p>}
      </div>
      {bothSet && (
        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-3">
          {chartData.length === 0
            ? <div className="flex flex-col items-center justify-center h-28 gap-1"><span className="text-xs text-[var(--muted)]">No records match the selected date range.</span></div>
            : <ResponsiveContainer width="100%" height={160}>
              <BarChart data={chartData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" vertical={false} />
                <XAxis dataKey="x" tick={{ fontSize: 9, fill: "var(--muted)" }} interval={0} tickFormatter={v => String(v).slice(0, 12)} />
                <YAxis tick={{ fontSize: 9, fill: "var(--muted)" }} allowDecimals={false} />
                {/* <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid var(--card-border)", background: "var(--card-bg)" }} labelStyle={{ color: "var(--foreground)", fontWeight: 600 }} formatter={(v) => [v ?? 0, "Count"]} /> */}
                <Tooltip
                  content={
                    <CustomTooltip
                      data={data}
                      xKey={xKey}
                      yKey={yKey}
                      dateFrom={dateFrom}
                      dateTo={dateTo}
                    />
                  }
                />
                <Bar dataKey="y" radius={[3, 3, 0, 0]} maxBarSize={40}>
                  {chartData.map((entry: any, index) => {
                    const cve = String(entry.x).includes(" | ")
                      ? String(entry.x).split(" | ")[0]
                      : String(entry.x);

                    const severity = severityByCve[cve] ?? "";
                    const fillColor = getSeverityColor(severity);

                    return <Cell key={`cell-${index}`} fill={fillColor} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>}
        </div>
      )}
    </div>
  );
}

// ─── Table preview (controlled — all config lifted to parent) ─────────────────
interface TablePreviewProps {
  data: unknown[];
  loading: boolean;
  dateKey: string;
  onDateKeyChange: (k: string) => void;
  visibleCols: string[];
  onVisibleColsChange: (cols: string[]) => void;
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (v: string) => void;
  onDateToChange: (v: string) => void;
}

function TablePreview({ data, loading, dateKey, onDateKeyChange, visibleCols, onVisibleColsChange, dateFrom, dateTo, onDateFromChange, onDateToChange }: TablePreviewProps) {
  const allKeys = useMemo(() => collectKeys(data), [data]);
  const dateKeys = useMemo(() =>
    allKeys.filter(k => { const s = data.slice(0, 10).map(r => getPath(r, k)).filter(Boolean); return s.length > 0 && s.some(v => looksLikeDate(v)); }),
    [allKeys, data]);
  const defaultDateKey = useMemo(() => {
    const preferred = ["synced_at", "createdAt", "created_at", "date", "published", "pubDate", "publishedDate", "threatInfo.createdAt", "threatInfo.createdDate", "createdDate", "detectionDate", "markedDate", "lastScanDate"];
    return preferred.find(k => dateKeys.includes(k)) ?? dateKeys[0] ?? allKeys[0] ?? "";
  }, [dateKeys, allKeys]);

  // Auto-initialise dateKey and visibleCols when data loads
  useEffect(() => {
    if (!dateKey && defaultDateKey) onDateKeyChange(defaultDateKey);
  }, [defaultDateKey]); // eslint-disable-line
  const activeDateKey = dateKey || defaultDateKey;
  const nonDateKeys = useMemo(() => allKeys.filter(k => k !== activeDateKey), [allKeys, activeDateKey]);
  useEffect(() => {
    if (visibleCols.length === 0 && nonDateKeys.length > 0) onVisibleColsChange(nonDateKeys.slice(0, 4));
  }, [nonDateKeys.join(",")]); // eslint-disable-line

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
      <div className="px-3 py-2.5 border-b border-[var(--card-border)] space-y-2 bg-[var(--muted-bg)]">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wide shrink-0">Date column:</span>
            <div className="relative">
              <select value={activeDateKey} onChange={e => onDateKeyChange(e.target.value)} className="appearance-none pl-2 pr-6 py-0.5 rounded border border-[var(--card-border)] bg-[var(--card-bg)] text-[10px] font-semibold text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-emerald-500">
                {(dateKeys.length > 0 ? dateKeys : allKeys).map(k => <option key={k} value={k}>{labelFor(k)}</option>)}
              </select>
              <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[var(--muted)]"><svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg></span>
            </div>
          </div>
          <div className="flex items-center gap-1"><label className="text-[10px] text-[var(--muted)]">From</label>
            <input type="date" value={dateFrom} max={dateTo} onChange={e => onDateFromChange(e.target.value)} className="text-[10px] px-1.5 py-0.5 rounded border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-emerald-500" /></div>
          <div className="flex items-center gap-1"><label className="text-[10px] text-[var(--muted)]">To</label>
            <input type="date" value={dateTo} min={dateFrom} onChange={e => onDateToChange(e.target.value)} className="text-[10px] px-1.5 py-0.5 rounded border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-emerald-500" /></div>
          <span className="text-[10px] text-[var(--muted)] ml-auto">{filtered.length} rows</span>
        </div>
        {nonDateKeys.length > 0 && (
          <div className="flex items-start gap-1.5 flex-wrap">
            <span className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wide mt-0.5 shrink-0">Columns:</span>
            {nonDateKeys.slice(0, 24).map(k => {
              const on = visibleCols.includes(k);
              return (
                <button key={k} type="button" onClick={() => onVisibleColsChange(on ? visibleCols.filter(c => c !== k) : [...visibleCols, k])} title={k}
                  className={`px-1.5 py-0.5 rounded text-[9px] font-medium border transition-colors ${on ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" : "border-[var(--card-border)] text-[var(--muted)] hover:border-emerald-400 hover:text-[var(--foreground)]"}`}>
                  {labelFor(k)}
                </button>
              );
            })}
          </div>
        )}
      </div>
      {filtered.length === 0
        ? <div className="flex flex-col items-center justify-center h-20 gap-1"><span className="text-xs text-[var(--muted)]">No records in selected date range.</span></div>
        : <div className="overflow-auto max-h-52">
          <table className="w-full text-[10px] border-separate border-spacing-0">
            <thead>
              <tr>
                <th className="sticky left-0 top-0 z-20 px-2 py-1.5 text-left font-bold text-[var(--muted)] uppercase tracking-wide whitespace-nowrap bg-[var(--muted-bg)] border-b border-r border-[var(--card-border)]">{labelFor(activeDateKey)}</th>
                {visibleCols.map(col => <th key={col} className="sticky top-0 z-10 px-2 py-1.5 text-left font-bold text-[var(--muted)] uppercase tracking-wide whitespace-nowrap bg-[var(--muted-bg)] border-b border-[var(--card-border)]">{labelFor(col)}</th>)}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, i) => {
                const rawDate = String(getPath(row, activeDateKey) ?? "—");
                const displayDate = toYMD(rawDate) || rawDate.slice(0, 20);
                return (
                  <tr key={i} className="hover:bg-[var(--muted-bg)]/50">
                    <td className="sticky left-0 z-10 px-2 py-1 font-medium text-[var(--foreground)] whitespace-nowrap bg-[var(--card-bg)] border-b border-r border-[var(--card-border)]">{displayDate}</td>
                    {visibleCols.map(col => {
                      const val = getPath(row, col);
                      const display = val == null ? "—" : typeof val === "object" ? JSON.stringify(val).slice(0, 60) : String(val).slice(0, 60);
                      return <td key={col} className="px-2 py-1 text-[var(--foreground)] whitespace-nowrap border-b border-[var(--card-border)]">{display}</td>;
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>}
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  selected: string[];
  onToggle: (id: string) => void;
  onAdd: (configs: S1WidgetConfig[]) => void;
  onCancel: () => void;
}

// ─── Main picker component ────────────────────────────────────────────────────
export default function SentinelOneWidgetPicker({ selected, onToggle, onAdd, onCancel }: Props) {
  const today = toISODate(new Date());
  const defaultFrom = toISODate(subtractDays(new Date(), 30));

  const [activeId, setActiveId] = useState<string>(S1_WIDGETS[0].id);
  const [previewData, setPreviewData] = useState<unknown[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [total, setTotal] = useState<number | null>(null);

  // ── Per-widget config — all lifted here so Add Widget captures everything ──
  const [widgetViewModes, setWidgetViewModes] = useState<Record<string, S1WidgetViewMode>>({});
  // graph config per widget
  const [widgetXKey, setWidgetXKey] = useState<Record<string, string>>({});
  const [widgetDateFrom, setWidgetDateFrom] = useState<Record<string, string>>({});
  const [widgetDateTo, setWidgetDateTo] = useState<Record<string, string>>({});
  // table config per widget
  const [widgetDateKey, setWidgetDateKey] = useState<Record<string, string>>({});
  const [widgetVisibleCols, setWidgetVisibleCols] = useState<Record<string, string[]>>({});
  const [widgetYKey, setWidgetYKey] = useState<Record<string, string>>({});
  const activeWidget = S1_WIDGETS.find(w => w.id === activeId)!;
  const isSelected = selected.includes(activeId);
  const yKey = widgetYKey[activeId] ?? "count";

  const setYKey = (v: string) =>
    setWidgetYKey((p) => ({ ...p, [activeId]: v }));
  function defaultViewMode(w: S1WidgetDef): S1WidgetViewMode {
    if (w.statOnly) return "stat";
    if (w.rssOnly) return "rss";
    return "table";
  }
  function getViewMode(id: string): S1WidgetViewMode {
    return widgetViewModes[id] ?? defaultViewMode(S1_WIDGETS.find(w => w.id === id)!);
  }
  function setViewMode(id: string, mode: S1WidgetViewMode) {
    setWidgetViewModes(prev => ({ ...prev, [id]: mode }));
  }

  // Helpers to get/set per-active-widget config
  const xKey = widgetXKey[activeId] ?? "";

  const dateFrom = widgetDateFrom[activeId] ?? defaultFrom;
  const dateTo = widgetDateTo[activeId] ?? today;
  const dateKey = widgetDateKey[activeId] ?? "";
  const visCols = widgetVisibleCols[activeId] ?? [];

  const setXKey = (v: string) => setWidgetXKey(p => ({ ...p, [activeId]: v }));
  const setDateFrom = (v: string) => setWidgetDateFrom(p => ({ ...p, [activeId]: v }));
  const setDateTo = (v: string) => setWidgetDateTo(p => ({ ...p, [activeId]: v }));
  const setDateKey = (v: string) => setWidgetDateKey(p => ({ ...p, [activeId]: v }));
  const setVisCols = (v: string[]) => setWidgetVisibleCols(p => ({ ...p, [activeId]: v }));

  // Build full config for every selected widget to pass to dashboard
  function buildConfigs(ids: string[]): S1WidgetConfig[] {
    return ids.map(id => ({
      id,
      viewMode: getViewMode(id),
      xKey: widgetXKey[id],
      yKey: widgetYKey[id] ?? "count",
      dateFrom: widgetDateFrom[id] ?? defaultFrom,
      dateTo: widgetDateTo[id] ?? today,
      dateKey: widgetDateKey[id],
      visibleCols: widgetVisibleCols[id],
    }));
  }

  // Load preview data when active widget changes
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
  }, [activeId]); // eslint-disable-line

  const viewMode = getViewMode(activeId);

  return (
    <div className="flex flex-col">
      {/* ── Header: widget dropdown ── */}
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

      {/* ── Widget meta row ── */}
      <div className="px-5 py-3 flex items-start justify-between gap-3 border-b border-[var(--card-border)]">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-[var(--foreground)]">{activeWidget.label}</span>
            <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${BADGE_COLOR[activeWidget.color]}`}>{activeWidget.dbRoute.split("/").pop()}</span>
            {isSelected && <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">✓ Added</span>}
          </div>
          <p className="text-xs text-[var(--muted)] mt-0.5">{activeWidget.description}</p>
        </div>
        <div className="text-right flex-shrink-0">
          {previewLoading
            ? <div className="h-5 w-16 bg-[var(--muted-bg)] rounded animate-pulse" />
            : <>
              <p className="text-base font-bold text-[var(--foreground)]">{total ?? 0} <span className="text-[10px] font-normal text-[var(--muted)]">records</span></p>
              {lastSyncedAt && <p className="text-[10px] text-[var(--muted)]">Synced {new Date(lastSyncedAt).toLocaleDateString()}</p>}
              {total === 0 && <p className="text-[10px] text-amber-500 font-medium">Sync first</p>}
            </>}
        </div>
      </div>

      {/* ── Preview section ── */}
      <div className="px-5 py-4 space-y-3">
        {/* Header row with Graph/Table toggle for configurable widgets */}
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider">Preview</p>
          {!activeWidget.statOnly && !activeWidget.rssOnly && (
            <div className="flex items-center gap-1 bg-[var(--muted-bg)] rounded-lg p-0.5 border border-[var(--card-border)]">
              <button type="button" onClick={() => setViewMode(activeId, "graph")}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-semibold transition-colors ${viewMode === "graph" ? "bg-[var(--card-bg)] text-emerald-600 shadow-sm" : "text-[var(--muted)] hover:text-[var(--foreground)]"}`}>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                Graph
              </button>
              <button type="button" onClick={() => setViewMode(activeId, "table")}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-semibold transition-colors ${viewMode === "table" ? "bg-[var(--card-bg)] text-blue-600 shadow-sm" : "text-[var(--muted)] hover:text-[var(--foreground)]"}`}>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18M10 4v16M3 4h18a1 1 0 011 1v14a1 1 0 01-1 1H3a1 1 0 01-1-1V5a1 1 0 011-1z" /></svg>
                Table
              </button>
            </div>
          )}
        </div>

        {/* Render correct preview based on widget type and chosen view mode */}
        {activeWidget.statOnly
          ? (activeId === "s1-mitigation"
            ? <MitigationBox data={previewData} loading={previewLoading} />
            : <SeverityBox data={previewData} loading={previewLoading} />)
          : activeWidget.rssOnly
            ? <RssFeedPreview data={previewData} loading={previewLoading} />
            : viewMode === "graph"
              ? <GraphPreview
                data={previewData}
                loading={previewLoading}
                color={ACCENT[activeWidget.color]}
                xKey={xKey}
                yKey={yKey}
                onXKeyChange={setXKey}
                onYKeyChange={setYKey}
                dateFrom={dateFrom}
                dateTo={dateTo}
                onDateFromChange={setDateFrom}
                onDateToChange={setDateTo}
              />
              : <TablePreview
                data={previewData} loading={previewLoading}
                dateKey={dateKey} onDateKeyChange={setDateKey}
                visibleCols={visCols} onVisibleColsChange={setVisCols}
                dateFrom={dateFrom} dateTo={dateTo}
                onDateFromChange={setDateFrom} onDateToChange={setDateTo}
              />
        }
      </div>

      {/* ── Footer ── */}
      <div className="px-5 py-4 border-t border-[var(--card-border)] bg-[var(--muted-bg)] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => {
            // Single batch call — avoids stale closure from forEach
            const allIds = S1_WIDGETS.map(w => w.id);
            const missing = allIds.filter(id => !selected.includes(id));
            missing.forEach(id => onToggle(id));
          }}
            className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">Select all</button>
          <span className="text-[var(--muted)] text-xs">·</span>
          <button type="button" onClick={() => {
            // Clear all by toggling off each currently-selected id
            [...selected].forEach(id => onToggle(id));
          }}
            className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">Clear</button>
          {selected.length > 0 && <span className="ml-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">{selected.length} selected</span>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg text-xs font-semibold text-[var(--muted)] hover:bg-[var(--card-border)] transition-colors">Cancel</button>
          <button type="button" onClick={() => onToggle(activeId)}
            className={`px-4 py-2 rounded-lg text-xs font-semibold border transition-colors ${isSelected ? "border-emerald-500 text-emerald-600 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/20" : "border-[var(--card-border)] text-[var(--foreground)] hover:bg-[var(--muted-bg)]"}`}>
            {isSelected ? "✓ Selected" : "+ Select"}
          </button>
          <button onClick={() => onAdd(buildConfigs(selected))} disabled={selected.length === 0}
            className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 dark:disabled:bg-emerald-900 text-white transition-colors shadow-sm disabled:cursor-not-allowed">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
            Add {selected.length > 0 ? `${selected.length} Widget${selected.length > 1 ? "s" : ""}` : "Widget"}
          </button>
        </div>
      </div>
    </div>
  );
}
