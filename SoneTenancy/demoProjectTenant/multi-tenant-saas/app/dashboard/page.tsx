"use client";


import { useEffect, useState, useRef, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import PCPLDashboard from "../components/PCPLDashboard";
import CheckpointCards from "../components/CheckpointCards";
import CheckpointWidgetPicker, { WIDGET_OPTIONS } from "../components/widgets/checkpoint/CheckpointWidgetPicker";
import SentinelOneWidgetPicker from "../components/widgets/sentinelone/SentinelOneWidgetPicker";
import type { S1WidgetConfig } from "../components/widgets/sentinelone/SentinelOneWidgetPicker";
import { getPath, collectKeys, buildChartData, labelFor, looksLikeDate, toYMD } from "../components/widgets/sentinelone/SentinelOneWidgetPicker";
import FirewallWidgetPicker from "../components/widgets/firewall/FirewallWidgetPicker";
import type { FirewallWidgetDraft } from "../components/widgets/firewall/FirewallWidgetPicker";
import { ResponsiveGridLayout, noCompactor } from "react-grid-layout";
import type { Layout, LayoutItem } from "react-grid-layout";
import {
  PieChart, Pie, Cell, BarChart, Bar, LineChart, Line, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
type SectionKey = "checkpoint" | "sentinelone" | "firewall";
// --- Constants ----------------------------------------------------------------
const FIREWALL_REPORTS = [
  "bandwidth-trend", "blocked-credential-post", "hruser-top-applications",
  "hruser-top-threats", "hruser-top-url-categories", "risk-trend", "risky-users",
  "spyware-infected-hosts", "threat-trend", "top-application-categories",
  "top-applications", "top-attacker-destinations", "top-attacker-sources",
  "top-attackers-by-destination-countries", "top-attacks", "top-blocked-url-categories",
  "top-blocked-url-user-behavior", "top-blocked-url-users", "top-blocked-websites",
  "top-connections", "top-denied-applications", "top-denied-destinations",
  "top-denied-sources", "top-destination-countries", "top-destinations",
  "top-http-applications", "top-source-countries", "top-sources", "top-spyware-threats",
  "top-technology-categories", "top-url-categories", "top-url-user-behavior",
  "top-url-users", "top-users", "top-victim-destinations", "top-victim-sources",
  "top-victims-by-destination-countries", "top-viruses", "top-vulnerabilities", "top-websites",
];

const COLORS = ["#3b82f6", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#6366f1"];

const S1_EXTRA_IDS = new Set(["s1-app-agent", "s1-app-cve", "s1-device-control", "s1-rss"]);

// --- Layout types -------------------------------------------------------------
interface BoxLayout { i: string; x: number; y: number; w: number; h: number; }

const DEFAULT_BOXES: BoxLayout[] = [
  // SentinelOne core widgets (always visible by default)
  { i: "s1-mitigation", x: 0, y: 0, w: 3, h: 33 },
  { i: "s1-severity", x: 3, y: 0, w: 3, h: 33 },
  { i: "s1-threats", x: 6, y: 0, w: 3, h: 33 },
  { i: "s1-agents", x: 9, y: 0, w: 3, h: 33 },
  // SentinelOne extra widgets (added via picker)
  { i: "s1-app-agent", x: 0, y: 33, w: 3, h: 33 },
  { i: "s1-app-cve", x: 3, y: 33, w: 3, h: 33 },
  { i: "s1-device-control", x: 6, y: 33, w: 3, h: 33 },
  { i: "s1-rss", x: 9, y: 33, w: 3, h: 33 },
  // Firewall widget
  { i: "fw-explorer", x: 0, y: 0, w: 7, h: 44 },
];

// --- Helper UI ----------------------------------------------------------------
function Spin() {
  return <div className="flex items-center justify-center h-full min-h-[100px]"><div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full" /></div>;
}
function Err({ msg }: { msg: string }) {
  return <div className="flex items-center justify-center h-full min-h-[80px] px-4 text-center"><p className="text-sm text-red-500 font-medium">{msg}</p></div>;
}
function Empty({ msg }: { msg: string }) {
  return <div className="flex items-center justify-center h-full min-h-[80px]"><p className="text-sm text-[var(--muted)]">{msg}</p></div>;
}

// --- Widget card wrapper ------------------------------------------------------
function WidgetCard({ label, title, children, right }: { label?: string; title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="bg-[var(--card-bg)] rounded-2xl border border-[var(--card-border)] shadow-sm flex flex-col overflow-hidden h-full">
      <div className="drag-handle cursor-grab active:cursor-grabbing bg-[var(--muted-bg)] border-b border-[var(--card-border)] px-4 py-3 flex items-center justify-between flex-shrink-0 select-none">
        <div>{label && <p className="text-xs text-[var(--muted)] font-medium">{label}</p>}<p className="text-sm font-bold text-[var(--foreground)]">{title}</p></div>
        {right}
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}

// --- S1 Configurable Widget � renders exactly what was set in the picker -------
function S1ConfigWidget({
  data, loading, config, onConfigChange,
  accentColor = "#10b981",
}: {
  data: unknown[];
  loading: boolean;
  config: S1WidgetConfig;
  onConfigChange: (patch: Partial<S1WidgetConfig>) => void;
  accentColor?: string;
}) {
  const tooltipStyle = { background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 8 };
  const COLORS_LOCAL = ["#3b82f6", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#6366f1"];

  if (loading) return <div className="flex items-center justify-center h-full"><div className="animate-spin w-6 h-6 border-4 border-emerald-500 border-t-transparent rounded-full" /></div>;
  if (data.length === 0) return <div className="flex items-center justify-center h-full"><p className="text-sm text-[var(--muted)]">No data � sync first</p></div>;

  // -- Graph mode --
  if (config.viewMode === "graph") {
    const xKey = config.xKey ?? "";
    const yKey = config.yKey ?? "";
    const dateFrom = config.dateFrom ?? "";
    const dateTo = config.dateTo ?? "";
    if (!xKey) return (
      <div className="flex flex-col items-center justify-center h-full gap-2 p-4">
        <p className="text-xs text-[var(--muted)] text-center">No date field configured.<br />Reopen Add Widget and select an X-axis field.</p>
      </div>
    );
    if (!xKey) return (
      <div className="flex flex-col items-center justify-center h-full gap-2 p-4">
        <p className="text-xs text-[var(--muted)] text-center">No date field configured.<br />Reopen Add Widget and select an X-axis field.</p>
      </div>
    );
    const chartData = buildChartData(data, xKey, yKey, dateFrom, dateTo);
    if (chartData.length === 0) return <div className="flex items-center justify-center h-full"><p className="text-sm text-[var(--muted)]">No records in date range</p></div>;
    return (
      <div className="p-3 h-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 8, right: 8, left: -10, bottom: 30 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
            <XAxis dataKey="x" tick={{ fontSize: 10, fill: "var(--muted)" }} angle={-20} textAnchor="end" tickFormatter={v => String(v).slice(0, 12)} />
            <YAxis tick={{ fontSize: 10, fill: "var(--muted)" }} allowDecimals={false} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v) => [v, "Count"]} />
            <Bar dataKey="y" fill={accentColor} radius={[4, 4, 0, 0]} maxBarSize={40} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // -- Table mode --
  const allKeys = collectKeys(data);
  const activeDateKey = config.dateKey ?? allKeys[0] ?? "";
  const visibleCols = config.visibleCols ?? allKeys.filter(k => k !== activeDateKey).slice(0, 4);
  const dateFrom = config.dateFrom ?? "";
  const dateTo = config.dateTo ?? "";

  const filtered = data.filter(r => {
    if (!activeDateKey) return true;
    const day = toYMD(getPath(r, activeDateKey));
    return (!dateFrom || day >= dateFrom) && (!dateTo || day <= dateTo);
  }).slice(0, 100);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Controls bar */}
      <div className="px-3 py-1.5 bg-[var(--muted-bg)] border-b border-[var(--card-border)] flex items-center gap-2 flex-wrap flex-shrink-0">
        <div className="flex items-center gap-1">
          <label className="text-[10px] text-[var(--muted)]">From</label>
          <input type="date" value={dateFrom} max={dateTo} onChange={e => onConfigChange({ dateFrom: e.target.value })}
            className="text-[10px] px-1.5 py-0.5 rounded border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-emerald-500" />
        </div>
        <div className="flex items-center gap-1">
          <label className="text-[10px] text-[var(--muted)]">To</label>
          <input type="date" value={dateTo} min={dateFrom} onChange={e => onConfigChange({ dateTo: e.target.value })}
            className="text-[10px] px-1.5 py-0.5 rounded border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-emerald-500" />
        </div>
        <span className="text-[10px] text-[var(--muted)] ml-auto">{filtered.length} rows</span>
      </div>
      {/* Scrollable table */}
      <div className="flex-1 min-h-0 overflow-auto">
        {filtered.length === 0
          ? <div className="flex items-center justify-center h-full"><p className="text-xs text-[var(--muted)]">No records in date range</p></div>
          : <table className="w-full text-[10px] border-separate border-spacing-0">
            <thead>
              <tr>
                <th className="sticky left-0 top-0 z-20 px-2 py-1.5 text-left font-bold text-[var(--muted)] uppercase tracking-wide whitespace-nowrap bg-[var(--muted-bg)] border-b border-r border-[var(--card-border)]">{labelFor(activeDateKey)}</th>
                {visibleCols.map(col => <th key={col} className="sticky top-0 z-10 px-2 py-1.5 text-left font-bold text-[var(--muted)] uppercase tracking-wide whitespace-nowrap bg-[var(--muted-bg)] border-b border-[var(--card-border)]">{labelFor(col)}</th>)}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, i) => {
                const rawDate = String(getPath(row, activeDateKey) ?? "�");
                const displayDate = toYMD(rawDate) || rawDate.slice(0, 20);
                return (
                  <tr key={i} className="hover:bg-[var(--muted-bg)]/50">
                    <td className="sticky left-0 z-10 px-2 py-1 font-medium text-[var(--foreground)] whitespace-nowrap bg-[var(--card-bg)] border-b border-r border-[var(--card-border)]">{displayDate}</td>
                    {visibleCols.map(col => {
                      const val = getPath(row, col);
                      const display = val == null ? "�" : typeof val === "object" ? JSON.stringify(val).slice(0, 60) : String(val).slice(0, 60);
                      return <td key={col} className="px-2 py-1 text-[var(--foreground)] whitespace-nowrap border-b border-[var(--card-border)]">{display}</td>;
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>}
      </div>
    </div>
  );
}

// --- Main Page ----------------------------------------------------------------
export default function DashboardPage() {
  const { activeOrgSlug } = useAuth();

  // -- SentinelOne -------------------------------------------------------------
  const [s1Data, setS1Data] = useState<any[]>([]);
  const [s1Loading, setS1Loading] = useState(false);
  const [s1Error, setS1Error] = useState("");
  const [agentData, setAgentData] = useState<any[]>([]);
  const [agentLoading, setAgentLoading] = useState(false);
  const [agentError, setAgentError] = useState("");
  const [mitigationChart, setMitigationChart] = useState<"donut" | "probability" | "bar">("donut");
  // -- Extra S1 tables --------------------------------------------------------
  const [appAgentData, setAppAgentData] = useState<any[]>([]);
  const [appAgentLoading, setAppAgentLoading] = useState(false);
  const [appCveData, setAppCveData] = useState<any[]>([]);
  const [appCveLoading, setAppCveLoading] = useState(false);
  const [deviceControlData, setDeviceControlData] = useState<any[]>([]);
  const [deviceControlLoading, setDeviceControlLoading] = useState(false);
  const [rssData, setRssData] = useState<any[]>([]);
  const [rssLoading, setRssLoading] = useState(false);

  // -- Checkpoint Harmony events ----------------------------------------------
  const [cpEvents, setCpEvents] = useState<any[]>([]);
  const [cpEventsLoading, setCpEventsLoading] = useState(false);

  // -- Firewall -----------------------------------------------------------------
  const [fwReport, setFwReport] = useState("bandwidth-trend");
  const [fwRaw, setFwRaw] = useState<any>(null);
  const [fwUpdated, setFwUpdated] = useState<string | null>(null);
  const [fwLoading, setFwLoading] = useState(false);
  const [fwError, setFwError] = useState("");
  const [collecting, setCollecting] = useState(false);
  const [collectMsg, setCollectMsg] = useState<{ text: string; ok: boolean } | null>(null);

  // -- Firewall axis selectors --------------------------------------------------
  const [fwXAxis, setFwXAxis] = useState<string[]>([]);
  const [fwYAxis, setFwYAxis] = useState<string[]>([]);
  const [fwChartType, setFwChartType] = useState<"bar" | "line" | "mixed">("bar");
  const [showFwX, setShowFwX] = useState(false);
  const [showFwY, setShowFwY] = useState(false);

  // -- Saved firewall widgets ---------------------------------------------------
  const [fwWidgets, setFwWidgets] = useState<any[]>([]);

  // -- SentinelOne sync ---------------------------------------------------------
  const [s1Syncing, setS1Syncing] = useState(false);
  const [s1SyncMsg, setS1SyncMsg] = useState<{ text: string; ok: boolean } | null>(null);

  // -- Grid layout --------------------------------------------------------------
  const [boxes, setBoxes] = useState<BoxLayout[]>(DEFAULT_BOXES);
  const [layoutLoaded, setLayoutLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // -- Edit mode & Add Widget modal ---------------------------------------------
  const [isEditMode, setIsEditMode] = useState(false);
  const [showAddWidget, setShowAddWidget] = useState(false);
  // Modal source tab: which product the user is adding a widget for
  type WidgetSource = "checkpoint" | "sentinelone" | "firewall";
  const [widgetSource, setWidgetSource] = useState<WidgetSource>("firewall");
  // Checkpoint: which widget cards are selected
  const [cpSelected, setCpSelected] = useState<string[]>([]);
  // SentinelOne: which widget cards are selected
  const [s1Selected, setS1Selected] = useState<string[]>([]);
  // Firewall: draft config for the chart widget
  const [fwDraft, setFwDraft] = useState<FirewallWidgetDraft>({
    reportName: "bandwidth-trend",
    xAxis: [],
    yAxis: [],
    chartType: "bar",
  });

  const [sectionOrder, setSectionOrder] = useState<SectionKey[]>([
    "checkpoint",
    "sentinelone",
    "firewall",
  ]);

  // -- Visible widget sets (driven by picker selections) -------------------------
  // Start with all S1 widgets visible (matches DEFAULT_BOXES)
  const [visibleS1Widgets, setVisibleS1Widgets] = useState<string[]>([
    "s1-mitigation", "s1-severity", "s1-threats", "s1-agents",
  ]);
  // Full per-widget config (viewMode + axis/column settings) captured from picker
  const [s1WidgetConfigs, setS1WidgetConfigs] = useState<Record<string, S1WidgetConfig>>({
    "s1-mitigation": { id: "s1-mitigation", viewMode: "stat" },
    "s1-severity": { id: "s1-severity", viewMode: "stat" },
    "s1-threats": { id: "s1-threats", viewMode: "table" },
    "s1-agents": { id: "s1-agents", viewMode: "table" },
  });
  // Checkpoint: start empty � user adds via picker
  const [visibleCpWidgets, setVisibleCpWidgets] = useState<string[]>([]);
  const [selectedS1Widget, setSelectedS1Widget] = useState<string>("s1-mitigation");

  const dragSectionRef = useRef<SectionKey | null>(null);
  // Always holds the latest sectionOrder so persistLayout can read it without stale closure
  const sectionOrderRef = useRef<SectionKey[]>(["checkpoint", "sentinelone", "firewall"]);
  // Refs for widget visibility & configs so persistLayout always reads latest values
  const visibleS1WidgetsRef = useRef<string[]>(["s1-mitigation", "s1-severity", "s1-threats", "s1-agents"]);
  const s1WidgetConfigsRef = useRef<Record<string, S1WidgetConfig>>({
    "s1-mitigation": { id: "s1-mitigation", viewMode: "stat" },
    "s1-severity": { id: "s1-severity", viewMode: "stat" },
    "s1-threats": { id: "s1-threats", viewMode: "table" },
    "s1-agents": { id: "s1-agents", viewMode: "table" },
  });
  const visibleCpWidgetsRef = useRef<string[]>([]);

  const moveSection = (target: SectionKey) => {
    const dragged = dragSectionRef.current;
    if (!dragged || dragged === target) return;

    setSectionOrder((prev) => {
      const next = [...prev];
      const from = next.indexOf(dragged);
      const to = next.indexOf(target);

      next.splice(from, 1);
      next.splice(to, 0, dragged);

      // Keep ref in sync and persist the new order
      sectionOrderRef.current = next as SectionKey[];
      persistLayout(boxes, next as SectionKey[]);

      return next;
    });
  };

  const SectionWrapper = ({
    id,
    children,
  }: {
    id: SectionKey;
    children: React.ReactNode;
  }) => (
    <div
      draggable
      onDragStart={() => {
        dragSectionRef.current = id;
      }}
      onDragOver={(e) => {
        e.preventDefault();
        moveSection(id);
      }}
      onDragEnd={() => {
        dragSectionRef.current = null;
      }}
      className=""
    >
      {children}
    </div>
  );

  // -- Container width -----------------------------------------------------------
  const [containerWidth, setContainerWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth - 240 : 1200
  );
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const update = () => {
      const el = containerRef.current;
      if (el) {
        const w = el.getBoundingClientRect().width;
        if (w > 0) setContainerWidth(w);
      } else {
        // fallback: window minus sidebar
        setContainerWidth(window.innerWidth - 240);
      }
    };

    update();
    window.addEventListener("resize", update);

    const ro = new ResizeObserver(update);
    if (containerRef.current) ro.observe(containerRef.current);

    return () => {
      window.removeEventListener("resize", update);
      ro.disconnect();
    };
  }, []);

  // -- ALL HOOKS BEFORE EARLY RETURNS ------------------------------------------

  // Keep refs in sync with state so persistLayout always writes the latest values
  useEffect(() => { visibleS1WidgetsRef.current = visibleS1Widgets; }, [visibleS1Widgets]);
  useEffect(() => { s1WidgetConfigsRef.current = s1WidgetConfigs; }, [s1WidgetConfigs]);
  useEffect(() => { visibleCpWidgetsRef.current = visibleCpWidgets; }, [visibleCpWidgets]);

  // Load persisted layout
  useEffect(() => {
    if (!activeOrgSlug) { setLayoutLoaded(true); return; }
    fetch("/api/dashboard/layout", { credentials: "include" })
      .then(r => r.json())
      .then(d => {
        const saved = Array.isArray(d.layout?.pgboxes) ? d.layout.pgboxes : [];
        const merged = DEFAULT_BOXES.map(def => saved.find((b: BoxLayout) => b.i === def.i) ?? def);
        setBoxes(merged);
        // Restore saved section order if valid
        const savedOrder = d.layout?.sectionOrder;
        if (
          Array.isArray(savedOrder) &&
          savedOrder.length === 3 &&
          ["checkpoint", "sentinelone", "firewall"].every(k => savedOrder.includes(k))
        ) {
          setSectionOrder(savedOrder as SectionKey[]);
          sectionOrderRef.current = savedOrder as SectionKey[];
        }
        // Restore visible widget sets
        if (Array.isArray(d.layout?.visibleS1Widgets) && d.layout.visibleS1Widgets.length > 0) {
          setVisibleS1Widgets(d.layout.visibleS1Widgets);
          visibleS1WidgetsRef.current = d.layout.visibleS1Widgets;
        }
        if (d.layout?.s1WidgetConfigs && typeof d.layout.s1WidgetConfigs === "object") {
          setS1WidgetConfigs(prev => ({ ...prev, ...d.layout.s1WidgetConfigs }));
          s1WidgetConfigsRef.current = { ...s1WidgetConfigsRef.current, ...d.layout.s1WidgetConfigs };
        }
        if (Array.isArray(d.layout?.visibleCpWidgets)) {
          setVisibleCpWidgets(d.layout.visibleCpWidgets);
          visibleCpWidgetsRef.current = d.layout.visibleCpWidgets;
        }
      })
      .catch(() => { })
      .finally(() => setLayoutLoaded(true));
  }, [activeOrgSlug]);

  // Load saved firewall widgets
  useEffect(() => {
    if (!activeOrgSlug) return;
    fetch("/api/firewall/widgets", { credentials: "include" })
      .then(r => r.json())
      .then(d => setFwWidgets(Array.isArray(d.widgets) ? d.widgets : []))
      .catch(() => setFwWidgets([]));
  }, [activeOrgSlug]);

  // Load SentinelOne threats � if DB empty, auto-sync first
  useEffect(() => {
    if (!activeOrgSlug) return;
    setS1Loading(true); setS1Error("");
    fetch("/api/sentinelone/threats", { credentials: "include" })
      .then(async r => {
        const j = await r.json();
        if (!r.ok) { setS1Error(j.message || "Fetch failed"); return; }
        if (Array.isArray(j.data) && j.data.length > 0) {
          setS1Data(j.data);
        } else {
          // DB empty � trigger sync then reload
          fetch("/api/sentinelone/sync", { method: "POST", credentials: "include" })
            .then(() => fetch("/api/sentinelone/threats", { credentials: "include" }))
            .then(r2 => r2.json())
            .then(j2 => { if (Array.isArray(j2.data)) setS1Data(j2.data); })
            .catch(() => { });
        }
      })
      .catch(e => setS1Error(e.message || "Fetch failed"))
      .finally(() => setS1Loading(false));
  }, [activeOrgSlug]);

  // Load agent info � if DB empty, auto-sync first
  useEffect(() => {
    if (!activeOrgSlug) return;
    setAgentLoading(true); setAgentError("");
    fetch("/api/sentinelone/sentinalone_agentinfo", { credentials: "include" })
      .then(async r => {
        const j = await r.json();
        if (!r.ok) { setAgentError(j.message || "Fetch failed"); return; }
        if (Array.isArray(j.data) && j.data.length > 0) {
          setAgentData(j.data);
        } else {
          // DB empty � sync already triggered by threats hook, just reload after delay
          setTimeout(() => {
            fetch("/api/sentinelone/sentinalone_agentinfo", { credentials: "include" })
              .then(r2 => r2.json())
              .then(j2 => { if (Array.isArray(j2.data)) setAgentData(Array.isArray(j2.data) ? j2.data : []); })
              .catch(() => { });
          }, 5000);
        }
      })
      .catch(e => setAgentError(e.message || "Fetch failed"))
      .finally(() => setAgentLoading(false));
  }, [activeOrgSlug]);

  // Load extra S1 DB tables (app-agent, app-cve, device-control, rss)
  useEffect(() => {
    if (!activeOrgSlug) return;
    setAppAgentLoading(true);
    fetch("/api/sentinelone/db/application-agent", { credentials: "include" })
      .then(r => r.json())
      .then(d => { if (Array.isArray(d.data)) setAppAgentData(d.data); })
      .catch(() => { })
      .finally(() => setAppAgentLoading(false));
  }, [activeOrgSlug]);

  useEffect(() => {
    if (!activeOrgSlug) return;
    setAppCveLoading(true);
    fetch("/api/sentinelone/db/application-cve", { credentials: "include" })
      .then(r => r.json())
      .then(d => { if (Array.isArray(d.data)) setAppCveData(d.data); })
      .catch(() => { })
      .finally(() => setAppCveLoading(false));
  }, [activeOrgSlug]);

  useEffect(() => {
    if (!activeOrgSlug) return;
    setDeviceControlLoading(true);
    fetch("/api/sentinelone/db/device-control", { credentials: "include" })
      .then(r => r.json())
      .then(d => { if (Array.isArray(d.data)) setDeviceControlData(d.data); })
      .catch(() => { })
      .finally(() => setDeviceControlLoading(false));
  }, [activeOrgSlug]);

  useEffect(() => {
    if (!activeOrgSlug) return;
    setRssLoading(true);
    fetch("/api/sentinelone/db/rss", { credentials: "include" })
      .then(r => r.json())
      .then(d => { if (Array.isArray(d.data)) setRssData(d.data); })
      .catch(() => { })
      .finally(() => setRssLoading(false));
  }, [activeOrgSlug]);

  // Load Checkpoint Harmony events for widget cards
  useEffect(() => {
    if (!activeOrgSlug) return;
    setCpEventsLoading(true);
    fetch("/api/harmony/events-db", { credentials: "include" })
      .then(r => r.json())
      .then(d => { if (Array.isArray(d.responseData)) setCpEvents(d.responseData); })
      .catch(() => { })
      .finally(() => setCpEventsLoading(false));
  }, [activeOrgSlug]);

  // Load firewall report
  useEffect(() => {
    if (!activeOrgSlug || !fwReport) return;
    setFwLoading(true); setFwError(""); setFwRaw(null);
    fetch(`/api/firewall/reports/${fwReport}`, { credentials: "include" })
      .then(r => r.json())
      .then(d => { if (d.message && d.data === undefined) setFwError(d.message); else { setFwRaw(d.data ?? null); setFwUpdated(d.updatedAt ?? null); } })
      .catch(() => setFwError("Network error"))
      .finally(() => setFwLoading(false));
  }, [activeOrgSlug, fwReport]);

  // Auto-select axes when data loads
  useEffect(() => {
    const table = fwRaw ? extractTable(fwRaw) : null;
    if (!table?.columns?.length) return;
    const cols = table.columns;
    const numCol = cols.find(c => table.rows.some(r => getNum(r[c]) > 0)) || cols[1] || cols[0];
    setFwXAxis(prev => prev.length ? prev : [cols[0]]);
    setFwYAxis(prev => prev.length ? prev : [numCol]);
  }, [fwRaw]);

  // Debounced layout save � persists widget positions, section order, and visible widget sets
  const persistLayout = useCallback((nextBoxes: BoxLayout[], nextSectionOrder?: SectionKey[]) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSaving(true);
    saveTimerRef.current = setTimeout(() => {
      const orderToSave = nextSectionOrder ?? sectionOrderRef.current;
      fetch("/api/dashboard/layout", {
        method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({
          layout: {
            pgboxes: nextBoxes,
            sectionOrder: orderToSave,
            visibleS1Widgets: visibleS1WidgetsRef.current,
            s1WidgetConfigs: s1WidgetConfigsRef.current,
            visibleCpWidgets: visibleCpWidgetsRef.current,
          },
        }),
      })
        .then(() => { setSaved(true); setTimeout(() => setSaved(false), 2500); })
        .finally(() => setSaving(false));
    }, 800);
  }, []);

  // -- EARLY RETURNS (after all hooks) -----------------------------------------
  if (!activeOrgSlug) return (
    <div className="p-8">
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-6">
        <h3 className="font-semibold text-amber-800 dark:text-amber-300">No Organization Selected</h3>
        <p className="text-amber-700 dark:text-amber-400 mt-1 text-sm">Select an organization from the top bar to view the dashboard.</p>
      </div>
    </div>
  );

  if (activeOrgSlug === "pcpl") return <PCPLDashboard />;

  // -- Derived data -------------------------------------------------------------
  const fwTable = fwRaw ? extractTable(fwRaw) : null;
  const fwColumns = fwTable?.columns ?? [];
  const fwTrendData = fwReport === "risk-trend" && fwTable?.rows?.length ? buildRiskTrendData(fwTable.rows) : [];

  const mitigationCounts: Record<string, number> = {};
  s1Data.forEach(t => { const s = t.threatInfo?.mitigationStatus || "unknown"; mitigationCounts[s] = (mitigationCounts[s] || 0) + 1; });
  const mitigationData = Object.entries(mitigationCounts).map(([name, value], i) => ({ name, value, fill: COLORS[i % COLORS.length] }));
  const mitigationTotal = mitigationData.reduce((s, d) => s + d.value, 0);

  const severityCounts: Record<string, number> = {};
  s1Data.forEach(t => { const s = t.threatInfo?.confidenceLevel || "unknown"; severityCounts[s] = (severityCounts[s] || 0) + 1; });
  const severityData = Object.entries(severityCounts).map(([name, value], i) => ({ name, value, fill: COLORS[i % COLORS.length] }));

  const recentThreats = [...s1Data]
    .sort((a, b) => new Date(b.threatInfo?.createdAt || 0).getTime() - new Date(a.threatInfo?.createdAt || 0).getTime())
    .slice(0, 15);

  const activeAgents = agentData.filter(a => a.isActive).length;
  const inactiveAgents = agentData.filter(a => !a.isActive).length;

  const getBottomY = () => Math.max(0, ...[...boxes, ...fwWidgets.map(w => ({ y: Number(w.y ?? 0), h: Number(w.h ?? 6) }))].map(i => i.y + i.h));

  const tooltipStyle = { background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 8 };

  // -- Grid layout items � all breakpoints --------------------------------------
  const staticItems = boxes.map((b) => ({
    i: b.i,
    x: b.x,
    y: b.y,
    w: b.w,
    h: b.h,
    minW: 2,
    minH: 20,
    static: false,
  }));
  const widgetItems = fwWidgets.map((w) => ({
    i: w.id,
    x: Number(w.x ?? 0),
    y: Number(w.y ?? 45),
    w: Number(w.w ?? 7),
    h: Number(w.h ?? 99),
    minW: 3,
    minH: 20,
    moved: false,
  }));

  // -- Grid layout items � only include visible S1 widgets so hidden ones don't inflate grid height --
  // Hidden widgets are excluded from the layout entirely; their saved positions stay in `boxes`.
  const s1AllItems = staticItems
    .filter((item) => item.i.startsWith("s1-") && visibleS1Widgets.includes(item.i));

  const fwItems = [
    ...staticItems.filter((item) => item.i.startsWith("fw-")),
    ...widgetItems,
  ];

  const s1Layouts = {
    lg: s1AllItems,
    md: s1AllItems,
    sm: s1AllItems,
    xs: s1AllItems,
    xxs: s1AllItems,
  };

  const fwLayouts = {
    lg: fwItems,
    md: fwItems,
    sm: fwItems,
    xs: fwItems,
    xxs: fwItems,
  };

  // -- Handlers ------------------------------------------------------------------
  const handleLayoutChange = (newLayout: Layout, _allLayouts: Partial<Record<string, Layout>>) => {
    // Update static S1/FW-explorer boxes
    const nextBoxes = boxes.map(box => {
      const l = newLayout.find(n => n.i === box.i);
      if (!l) return box;
      // Never overwrite the stored size of a hidden S1 widget
      if (box.i.startsWith("s1-") && !visibleS1Widgets.includes(box.i)) return box;
      return { ...box, x: l.x, y: l.y, w: l.w, h: l.h };
    });
    // Update dynamic firewall widgets and persist each to DB
    setFwWidgets(prev => prev.map(widget => {
      const l = newLayout.find(n => n.i === widget.id);
      if (!l) return widget;
      // Persist resize/move to DB immediately
      fetch(`/api/firewall/widgets/${widget.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ x: l.x, y: l.y, w: l.w, h: l.h }),
      }).catch(console.error);
      return { ...widget, x: l.x, y: l.y, w: l.w, h: l.h };
    }));
    setBoxes(nextBoxes);
    persistLayout(nextBoxes);
  };

  // Save layout immediately when exiting edit mode
  const handleDoneEditing = () => {
    setIsEditMode(false);
    persistLayout(boxes);
  };

  const handleCollect = async () => {
    setCollecting(true); setCollectMsg(null);
    try {
      const res = await fetch("/api/firewall/collect", { method: "POST", credentials: "include" });
      const d = await res.json();
      setCollectMsg({ text: d.message || "Done", ok: res.ok });
      if (res.ok) {
        setFwLoading(true);
        fetch(`/api/firewall/reports/${fwReport}`, { credentials: "include" })
          .then(r => r.json()).then(d => { setFwRaw(d.data ?? null); setFwUpdated(d.updatedAt ?? null); }).finally(() => setFwLoading(false));
      }
    } catch { setCollectMsg({ text: "Collection failed", ok: false }); }
    finally { setCollecting(false); }
  };

  const handleS1Sync = async () => {
    setS1Syncing(true); setS1SyncMsg(null);
    try {
      const res = await fetch("/api/sentinelone/sync", { method: "POST", credentials: "include" });
      const d = await res.json();
      setS1SyncMsg({ text: d.message || "Done", ok: res.ok });
      if (res.ok) {
        // Reload threats and agents from DB
        setS1Loading(true);
        fetch("/api/sentinelone/threats", { credentials: "include" })
          .then(async r => { const j = await r.json(); setS1Data(j.data || []); })
          .catch(() => { })
          .finally(() => setS1Loading(false));
        setAgentLoading(true);
        fetch("/api/sentinelone/sentinalone_agentinfo", { credentials: "include" })
          .then(async r => { const j = await r.json(); setAgentData(Array.isArray(j.data) ? j.data : []); })
          .catch(() => { })
          .finally(() => setAgentLoading(false));
        // Reload extra tables
        setAppAgentLoading(true);
        fetch("/api/sentinelone/db/application-agent", { credentials: "include" })
          .then(r => r.json()).then(d => { if (Array.isArray(d.data)) setAppAgentData(d.data); })
          .catch(() => { }).finally(() => setAppAgentLoading(false));
        setAppCveLoading(true);
        fetch("/api/sentinelone/db/application-cve", { credentials: "include" })
          .then(r => r.json()).then(d => { if (Array.isArray(d.data)) setAppCveData(d.data); })
          .catch(() => { }).finally(() => setAppCveLoading(false));
        setDeviceControlLoading(true);
        fetch("/api/sentinelone/db/device-control", { credentials: "include" })
          .then(r => r.json()).then(d => { if (Array.isArray(d.data)) setDeviceControlData(d.data); })
          .catch(() => { }).finally(() => setDeviceControlLoading(false));
        setRssLoading(true);
        fetch("/api/sentinelone/db/rss", { credentials: "include" })
          .then(r => r.json()).then(d => { if (Array.isArray(d.data)) setRssData(d.data); })
          .catch(() => { }).finally(() => setRssLoading(false));
      }
    } catch { setS1SyncMsg({ text: "Sync failed", ok: false }); }
    finally { setS1Syncing(false); }
  };

  const handleAddWidget = async () => {
    if (!fwXAxis.length || !fwYAxis.length) return;
    const nextY = Math.max(
      46,
      ...fwWidgets.map((w) => Number(w.y ?? 0) + Number(w.h ?? 44))
    );
    const payload = {
      reportName: fwReport,
      xAxis: fwXAxis,
      yAxis: fwYAxis,
      chartType: fwYAxis.length > 1 ? "mixed" : fwChartType,
      x: 0,
      y: nextY,
      w: 7,
      h: 44,
    };
    const res = await fetch("/api/firewall/widgets", {
      method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify(payload),
    });
    const d = await res.json();
    if (res.ok && d.widget) {
      setFwWidgets(prev => [
        ...prev,
        {
          ...d.widget,
          x: Number(d.widget.x ?? payload.x),
          y: Number(d.widget.y ?? payload.y),
          w: Number(d.widget.w ?? payload.w),
          h: Number(d.widget.h ?? payload.h),
        },
      ]);
    }
  };

  const handleDeleteWidget = async (id: string) => {
    const res = await fetch(`/api/firewall/widgets/${id}`, { method: "DELETE", credentials: "include" });
    if (res.ok) setFwWidgets(prev => prev.filter(w => w.id !== id));
  };

  const toggleAxis = (
    col: string,
    list: string[],
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    max = 2
  ) => {
    setter(prev => {
      if (prev.includes(col)) return prev.filter(v => v !== col);
      if (prev.length >= max) return prev;
      return [...prev, col];
    });
  };

  // -- Widget remove helpers -----------------------------------------------------
  const removeS1Widget = (id: string) => {
    const next = visibleS1Widgets.filter(w => w !== id);
    visibleS1WidgetsRef.current = next;
    setVisibleS1Widgets(next);
    persistLayout(boxes);
  };

  const removeCpWidget = (id: string) => {
    const next = visibleCpWidgets.filter(w => w !== id);
    visibleCpWidgetsRef.current = next;
    setVisibleCpWidgets(next);
    persistLayout(boxes);
  };

  return (
    <div className="p-3 sm:p-5 lg:p-6">
      {/* -- Header ----------------------------------------------------------- */}
      <div className="flex items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--foreground)]">Dashboard</h1>
          {isEditMode && (
            <p className="text-xs text-indigo-500 mt-0.5">Edit mode � drag sections &amp; resize widgets</p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Save indicator */}
          {saving && <span className="text-xs text-[var(--muted)] flex items-center gap-1.5"><div className="animate-spin w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full" />Saving�</span>}
          {saved && <span className="text-xs text-green-600 flex items-center gap-1"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Saved</span>}

          {/* Edit Layout toggle */}
          <button
            onClick={() => isEditMode ? handleDoneEditing() : setIsEditMode(true)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${isEditMode
              ? "bg-indigo-600 text-white border-indigo-600 shadow-md"
              : "bg-[var(--card-bg)] text-[var(--foreground)] border-[var(--card-border)] hover:border-indigo-400 hover:text-indigo-600"
              }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            {isEditMode ? "Done Editing" : "Edit Layout"}
          </button>

          {/* Add Widget button */}
          <button
            onClick={() => setShowAddWidget(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white border border-indigo-600 transition-all shadow-sm"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            Add Widget
          </button>
        </div>
      </div>

      {/* -- Edit mode banner -------------------------------------------------- */}
      {isEditMode && (
        <div className="mb-4 px-4 py-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700 flex items-center gap-2.5">
          <svg className="w-4 h-4 text-indigo-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-xs text-indigo-700 dark:text-indigo-300 font-medium">
            Drag section headers to reorder � Drag widget title bars to move � Pull widget edges to resize
          </p>
          <button onClick={handleDoneEditing} className="ml-auto text-indigo-500 hover:text-indigo-700 text-xs font-semibold">Done</button>
        </div>
      )}

      {/* -- Add Widget Modal --------------------------------------------------- */}
      {showAddWidget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={() => setShowAddWidget(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative z-10 w-full max-w-2xl bg-[var(--card-bg)] rounded-2xl border border-[var(--card-border)] shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--card-border)] bg-[var(--muted-bg)]">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
                  <svg className="w-4 h-4 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-indigo-500 uppercase tracking-widest">Dashboard</p>
                  <p className="text-sm font-bold text-[var(--foreground)]">Add Widget</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddWidget(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--muted)] hover:bg-[var(--card-border)] hover:text-[var(--foreground)] transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Source tab bar */}
            <div className="flex border-b border-[var(--card-border)] bg-[var(--muted-bg)]">
              {(
                [
                  {
                    key: "checkpoint" as WidgetSource,
                    label: "Checkpoint",
                    color: "indigo",
                    icon: (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    ),
                  },
                  {
                    key: "sentinelone" as WidgetSource,
                    label: "SentinelOne",
                    color: "emerald",
                    icon: (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    ),
                  },
                  {
                    key: "firewall" as WidgetSource,
                    label: "Palo Alto Firewall",
                    color: "orange",
                    icon: (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                    ),
                  },
                ] as const
              ).map(tab => {
                const isActive = widgetSource === tab.key;
                const colorMap: Record<string, string> = {
                  indigo: isActive
                    ? "border-b-2 border-indigo-500 text-indigo-600 dark:text-indigo-400 bg-[var(--card-bg)]"
                    : "text-[var(--muted)] hover:text-indigo-500 hover:bg-[var(--card-bg)]",
                  emerald: isActive
                    ? "border-b-2 border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-[var(--card-bg)]"
                    : "text-[var(--muted)] hover:text-emerald-500 hover:bg-[var(--card-bg)]",
                  orange: isActive
                    ? "border-b-2 border-orange-500 text-orange-600 dark:text-orange-400 bg-[var(--card-bg)]"
                    : "text-[var(--muted)] hover:text-orange-500 hover:bg-[var(--card-bg)]",
                };
                return (
                  <button
                    key={tab.key}
                    onClick={() => setWidgetSource(tab.key)}
                    className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold transition-all flex-1 justify-center ${colorMap[tab.color]}`}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {tab.icon}
                    </svg>
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Tab body */}
            <div className="max-h-[65vh] overflow-y-auto">

              {/* -- CHECKPOINT -- */}
              {widgetSource === "checkpoint" && (
                <CheckpointWidgetPicker
                  selected={cpSelected}
                  onToggle={(id) =>
                    setCpSelected(prev =>
                      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
                    )
                  }
                  onAdd={(ids) => {
                    setVisibleCpWidgets(prev => {
                      const next = Array.from(new Set([...prev, ...ids]));
                      visibleCpWidgetsRef.current = next;
                      return next;
                    });
                    setCpSelected([]);
                    setShowAddWidget(false);
                    // Persist the new visible set immediately
                    persistLayout(boxes);
                  }}
                  onCancel={() => setShowAddWidget(false)}
                />
              )}

              {/* -- SENTINELONE -- */}
              {widgetSource === "sentinelone" && (
                <SentinelOneWidgetPicker
                  selected={s1Selected}
                  onToggle={(id) =>
                    setS1Selected(prev =>
                      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
                    )
                  }
                  onAdd={(configs: S1WidgetConfig[]) => {
                    const ids = configs.map(c => c.id);
                    // Add to visible list (de-duped) and sync ref immediately
                    const nextVisible = Array.from(new Set([...visibleS1WidgetsRef.current, ...ids]));
                    visibleS1WidgetsRef.current = nextVisible;
                    setVisibleS1Widgets(nextVisible);
                    // Store full widget config and sync ref immediately
                    const nextConfigs = { ...s1WidgetConfigsRef.current };
                    configs.forEach(c => { nextConfigs[c.id] = c; });
                    s1WidgetConfigsRef.current = nextConfigs;
                    setS1WidgetConfigs(nextConfigs);
                    // Ensure every added widget has a layout box in `boxes`
                    setBoxes(prev => {
                      const existingIds = new Set(prev.map(b => b.i));
                      const newBoxes = ids
                        .filter(id => !existingIds.has(id))
                        .map((id, idx) => {
                          // Place new widgets below the lowest existing S1 widget
                          const s1Boxes = prev.filter(b => b.i.startsWith("s1-"));
                          const maxY = s1Boxes.length > 0
                            ? Math.max(...s1Boxes.map(b => b.y + b.h))
                            : 0;
                          return { i: id, x: (idx % 4) * 3, y: maxY + (Math.floor(idx / 4) * 33), w: 3, h: 33 };
                        });
                      const finalBoxes = newBoxes.length > 0 ? [...prev, ...newBoxes] : prev;
                      // Persist with the updated boxes and the fresh refs
                      persistLayout(finalBoxes);
                      return finalBoxes;
                    });
                    setS1Selected([]);
                    setShowAddWidget(false);
                  }}
                  onCancel={() => setShowAddWidget(false)}
                />
              )}

              {/* -- FIREWALL -- */}
              {widgetSource === "firewall" && (
                <div>
                  <div className="px-5 py-4 space-y-4">
                    {/* Report selector */}
                    <div>
                      <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider block mb-1.5">Report</label>
                      <select
                        value={fwReport}
                        onChange={e => { setFwReport(e.target.value); setFwXAxis([]); setFwYAxis([]); }}
                        className="w-full h-9 border border-[var(--input-border)] rounded-lg px-3 text-sm font-medium text-[var(--foreground)] bg-[var(--card-bg)] focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      >
                        {FIREWALL_REPORTS.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>

                    {/* Axis row */}
                    <div className="grid grid-cols-2 gap-3">
                      {/* X-Axis */}
                      <div className="relative">
                        <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider block mb-1.5">X-Axis</label>
                        <button
                          type="button"
                          onClick={() => { setShowFwX(p => !p); setShowFwY(false); }}
                          className={`w-full h-9 border rounded-lg px-3 text-sm font-medium flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-colors ${fwXAxis.length ? "border-blue-400 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" : "border-[var(--input-border)] bg-[var(--card-bg)] text-[var(--muted)]"}`}
                        >
                          <span className="truncate flex-1 text-left text-xs">{fwXAxis.length === 0 ? "Select column�" : fwXAxis.length === 1 ? fwXAxis[0] : `${fwXAxis.length} selected`}</span>
                          <svg className="w-3 h-3 flex-shrink-0 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </button>
                        {showFwX && (
                          <div className="absolute z-50 top-full mt-1 left-0 right-0 border border-[var(--card-border)] rounded-xl bg-[var(--card-bg)] shadow-2xl overflow-hidden">
                            <div className="px-3 py-2 bg-[var(--muted-bg)] border-b border-[var(--card-border)] flex items-center justify-between">
                              <span className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider">X-Axis Columns</span>
                              {fwXAxis.length > 0 && <button onClick={() => setFwXAxis([])} className="text-[10px] text-red-500 hover:text-red-700 font-medium">Clear</button>}
                            </div>
                            {fwXAxis.length >= 2 && (
                              <div className="px-3 py-1.5 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-700 flex items-center gap-1.5">
                                <svg className="w-3 h-3 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
                                <span className="text-[10px] text-amber-700 dark:text-amber-300 font-medium">Max 2 columns. Deselect to change.</span>
                              </div>
                            )}
                            <div className="max-h-44 overflow-auto p-1.5">
                              {fwColumns.length === 0
                                ? <p className="text-xs text-[var(--muted)] px-3 py-2">No columns � select a report first</p>
                                : fwColumns.map(col => {
                                  const isChecked = fwXAxis.includes(col);
                                  const isDisabled = !isChecked && fwXAxis.length >= 2;
                                  return (
                                    <label key={col} className={`flex items-center gap-2.5 px-2.5 py-2 text-xs rounded-lg transition-colors ${isDisabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer hover:bg-[var(--muted-bg)]"} ${isChecked ? "text-blue-700 dark:text-blue-300 font-semibold" : "text-[var(--foreground)]"}`}>
                                      <input type="checkbox" checked={isChecked} disabled={isDisabled} onChange={() => toggleAxis(col, fwXAxis, setFwXAxis)} className="w-3.5 h-3.5 accent-indigo-500" />
                                      <span className="truncate">{col}</span>
                                    </label>
                                  );
                                })}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Y-Axis */}
                      <div className="relative">
                        <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider block mb-1.5">Y-Axis</label>
                        <button
                          type="button"
                          onClick={() => { setShowFwY(p => !p); setShowFwX(false); }}
                          className={`w-full h-9 border rounded-lg px-3 text-sm font-medium flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-colors ${fwYAxis.length ? "border-emerald-400 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" : "border-[var(--input-border)] bg-[var(--card-bg)] text-[var(--muted)]"}`}
                        >
                          <span className="truncate flex-1 text-left text-xs">{fwYAxis.length === 0 ? "Select column�" : fwYAxis.length === 1 ? fwYAxis[0] : `${fwYAxis.length} selected`}</span>
                          <svg className="w-3 h-3 flex-shrink-0 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </button>
                        {showFwY && (
                          <div className="absolute z-50 top-full mt-1 left-0 right-0 border border-[var(--card-border)] rounded-xl bg-[var(--card-bg)] shadow-2xl overflow-hidden">
                            <div className="px-3 py-2 bg-[var(--muted-bg)] border-b border-[var(--card-border)] flex items-center justify-between">
                              <span className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider">Y-Axis Columns</span>
                              {fwYAxis.length > 0 && <button onClick={() => setFwYAxis([])} className="text-[10px] text-red-500 hover:text-red-700 font-medium">Clear</button>}
                            </div>
                            {fwYAxis.length >= 2 && (
                              <div className="px-3 py-1.5 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-700 flex items-center gap-1.5">
                                <svg className="w-3 h-3 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
                                <span className="text-[10px] text-amber-700 dark:text-amber-300 font-medium">Max 2 columns. Deselect to change.</span>
                              </div>
                            )}
                            <div className="max-h-44 overflow-auto p-1.5">
                              {fwColumns.length === 0
                                ? <p className="text-xs text-[var(--muted)] px-3 py-2">No columns � select a report first</p>
                                : fwColumns.map(col => {
                                  const isChecked = fwYAxis.includes(col);
                                  const isDisabled = !isChecked && fwYAxis.length >= 2;
                                  return (
                                    <label key={col} className={`flex items-center gap-2.5 px-2.5 py-2 text-xs rounded-lg transition-colors ${isDisabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer hover:bg-[var(--muted-bg)]"} ${isChecked ? "text-emerald-700 dark:text-emerald-300 font-semibold" : "text-[var(--foreground)]"}`}>
                                      <input type="checkbox" checked={isChecked} disabled={isDisabled} onChange={() => toggleAxis(col, fwYAxis, setFwYAxis)} className="w-3.5 h-3.5 accent-indigo-500" />
                                      <span className="truncate">{col}</span>
                                    </label>
                                  );
                                })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Chart type */}
                    <div>
                      <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider block mb-1.5">Chart Type</label>
                      <div className="flex rounded-lg border border-[var(--input-border)] overflow-hidden bg-[var(--card-bg)] w-fit">
                        {(["bar", "line", "mixed"] as const).map(ct => (
                          <button
                            key={ct}
                            type="button"
                            onClick={() => setFwChartType(ct)}
                            disabled={fwYAxis.length > 1}
                            className={`px-4 py-2 text-xs font-semibold transition-colors border-r last:border-r-0 border-[var(--input-border)] disabled:opacity-40 ${(fwYAxis.length > 1 ? "mixed" : fwChartType) === ct ? "bg-indigo-600 text-white" : "text-[var(--muted)] hover:bg-[var(--muted-bg)]"}`}
                          >
                            {ct === "bar" ? "Bar" : ct === "line" ? "Line" : "Mixed"}
                          </button>
                        ))}
                      </div>
                      {fwYAxis.length > 1 && <p className="text-[10px] text-[var(--muted)] mt-1">Mixed chart auto-selected for multiple Y columns</p>}
                    </div>

                    {/* Selected pills */}
                    {(fwXAxis.length > 0 || fwYAxis.length > 0) && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {fwXAxis.map(x => (
                          <span key={x} className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-700">
                            <span className="opacity-60 mr-0.5">X</span>{x}
                            <button onClick={() => setFwXAxis(p => p.filter(v => v !== x))} className="w-3.5 h-3.5 rounded-full hover:bg-blue-200 flex items-center justify-center ml-0.5">�</button>
                          </span>
                        ))}
                        {fwYAxis.map(y => (
                          <span key={y} className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700">
                            <span className="opacity-60 mr-0.5">Y</span>{y}
                            <button onClick={() => setFwYAxis(p => p.filter(v => v !== y))} className="w-3.5 h-3.5 rounded-full hover:bg-emerald-200 flex items-center justify-center ml-0.5">�</button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Firewall footer */}
                  <div className="px-5 py-4 border-t border-[var(--card-border)] bg-[var(--muted-bg)] flex items-center justify-end gap-2">
                    <button
                      onClick={() => setShowAddWidget(false)}
                      className="px-4 py-2 rounded-lg text-xs font-semibold text-[var(--muted)] hover:bg-[var(--card-border)] transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={async () => { await handleAddWidget(); setShowAddWidget(false); }}
                      disabled={!fwXAxis.length || !fwYAxis.length}
                      className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 dark:disabled:bg-indigo-900 text-white transition-colors shadow-sm disabled:cursor-not-allowed"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                      </svg>
                      Add Widget
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ----------------- SECTION MAPPING ----------------- */}
      <div className="flex flex-col divide-y divide-[var(--card-border)]">
        {sectionOrder.map((section) => {

          if (section === "checkpoint") {
            return (
              <div
                key="checkpoint"
                onDragOver={(e) => { e.preventDefault(); moveSection("checkpoint"); }}
                className="group/sec"
              >
                {/* -- CHECKPOINT HARMONY ------------------------------------------------ */}
                <div className="pt-4 pb-5">
                  {/* Section header */}
                  <div
                    draggable={isEditMode}
                    onDragStart={(e) => { if (!isEditMode) return; e.stopPropagation(); dragSectionRef.current = "checkpoint"; }}
                    onDragEnd={(e) => { e.stopPropagation(); dragSectionRef.current = null; }}
                    className={`flex items-center gap-3 mb-4 select-none rounded-xl px-3 py-2 transition-all duration-200 ${isEditMode ? "cursor-move bg-indigo-50/50 dark:bg-indigo-900/10 border border-dashed border-indigo-300 dark:border-indigo-700" : "cursor-default"}`}
                  >
                    <div className="w-1.5 h-7 rounded-full bg-gradient-to-b from-indigo-400 to-indigo-600 flex-shrink-0 shadow-sm" />
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest leading-none">Security</p>
                        <h2 className="text-sm font-bold text-[var(--foreground)] leading-tight">Checkpoint Harmony</h2>
                      </div>
                    </div>
                    <div className="flex-1 h-px bg-gradient-to-r from-indigo-200 via-[var(--card-border)] to-transparent dark:from-indigo-800" />
                    {isEditMode && <span className="text-[10px] text-indigo-400 font-medium flex items-center gap-1 flex-shrink-0"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>drag</span>}
                  </div>

                  {/* -- Individual Checkpoint Widget Cards -- */}
                  {visibleCpWidgets.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center border border-dashed border-indigo-200 dark:border-indigo-800 rounded-2xl bg-indigo-50/30 dark:bg-indigo-900/10">
                      <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center mb-3">
                        <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                        </svg>
                      </div>
                      <p className="text-sm font-semibold text-[var(--foreground)] mb-1">No widgets added yet</p>
                      <p className="text-xs text-[var(--muted)]">Click "Add Widget" ? Checkpoint to add cards here</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {visibleCpWidgets.map((id, idx) => {
                        const opt = WIDGET_OPTIONS.find(w => w.id === id);
                        if (!opt) return null;
                        const filtered = cpEvents.filter((e: any) => opt.eventTypes.includes(e.type));
                        const total = filtered.length;
                        const pending = filtered.filter((e: any) => e.state === "new" || e.state === "pending").length;
                        const remediated = filtered.filter((e: any) => ["remediated", "closed", "done"].includes(e.state)).length;
                        const remediatedPct = total > 0 ? Math.round((remediated / total) * 100) : 0;
                        const pendingPct = total > 0 ? Math.round((pending / total) * 100) : 0;
                        return (
                          <div
                            key={id}
                            className="bg-[var(--card-bg)] rounded-2xl border border-[var(--card-border)] shadow-sm overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
                            style={{ animationDelay: `${idx * 60}ms` }}
                          >
                            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-50 to-transparent dark:from-indigo-900/20 dark:to-transparent border-b border-[var(--card-border)]">
                              <div>
                                <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">Checkpoint</p>
                                <p className="text-sm font-bold text-[var(--foreground)]">{opt.label}</p>
                              </div>
                              <button
                                onClick={() => removeCpWidget(id)}
                                className={`w-6 h-6 flex items-center justify-center rounded-lg text-[var(--muted)] hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400 transition-colors ${isEditMode ? "opacity-100" : "opacity-0 pointer-events-none"}`}
                                title="Remove widget"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                            <div className="p-4">
                              {cpEventsLoading ? (
                                <div className="flex items-center justify-center py-4">
                                  <div className="animate-spin w-5 h-5 border-4 border-indigo-500 border-t-transparent rounded-full" />
                                </div>
                              ) : total === 0 ? (
                                <p className="text-xs text-[var(--muted)] text-center py-3">No events</p>
                              ) : (
                                <>
                                  <div className="flex items-end justify-between mb-3">
                                    <span className="text-3xl font-bold text-[var(--foreground)]">{total}</span>
                                    <span className="text-[10px] text-[var(--muted)] font-medium uppercase tracking-wide pb-1">Total Events</span>
                                  </div>
                                  <div className="space-y-2">
                                    <div>
                                      <div className="flex justify-between text-xs mb-1">
                                        <span className="text-green-600 dark:text-green-400 font-medium">Remediated</span>
                                        <span className="font-semibold text-[var(--foreground)]">{remediatedPct}%</span>
                                      </div>
                                      <div className="w-full bg-[var(--muted-bg)] rounded-full h-1.5 overflow-hidden">
                                        <div className="h-1.5 rounded-full bg-gradient-to-r from-green-400 to-green-600 transition-all duration-700" style={{ width: `${remediatedPct}%` }} />
                                      </div>
                                    </div>
                                    <div>
                                      <div className="flex justify-between text-xs mb-1">
                                        <span className="text-red-500 font-medium">Pending</span>
                                        <span className="font-semibold text-[var(--foreground)]">{pendingPct}%</span>
                                      </div>
                                      <div className="w-full bg-[var(--muted-bg)] rounded-full h-1.5 overflow-hidden">
                                        <div className="h-1.5 rounded-full bg-gradient-to-r from-red-400 to-red-600 transition-all duration-700" style={{ width: `${pendingPct}%` }} />
                                      </div>
                                    </div>
                                  </div>
                                  <div className="mt-3 flex flex-wrap gap-1">
                                    {opt.eventTypes.map(t => (
                                      <span key={t} className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 capitalize">
                                        {t.replace(/_/g, " ")}
                                      </span>
                                    ))}
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          }

          if (section === "sentinelone") {
            return (
              <div
                key="sentinelone"
                onDragOver={(e) => { e.preventDefault(); moveSection("sentinelone"); }}
                className="group/sec"
              >
                {/* -- SENTINELONE ------------------------------------------------------- */}
                <div className="pt-4 pb-2">
                  {/* Section header � ONLY this bar is draggable */}
                  <div
                    draggable
                    onDragStart={(e) => { e.stopPropagation(); dragSectionRef.current = "sentinelone"; }}
                    onDragEnd={(e) => { e.stopPropagation(); dragSectionRef.current = null; }}
                    className="flex items-center gap-3 mb-3 cursor-move select-none rounded-xl px-3 py-2 transition-all duration-200 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10"
                  >
                    <div className="w-1.5 h-7 rounded-full bg-gradient-to-b from-emerald-400 to-emerald-600 flex-shrink-0 shadow-sm" />
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest leading-none">Endpoint</p>
                        <h2 className="text-sm font-bold text-[var(--foreground)] leading-tight">SentinelOne</h2>
                      </div>
                    </div>
                    <div className="flex-1 h-px bg-gradient-to-r from-emerald-200 via-[var(--card-border)] to-transparent dark:from-emerald-800" />
                    <button
                      onClick={(e) => { e.stopPropagation(); handleS1Sync(); }}
                      disabled={s1Syncing}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 disabled:opacity-50 transition-all duration-150 flex-shrink-0 border border-emerald-200 dark:border-emerald-700"
                    >
                      {s1Syncing ? (
                        <><div className="animate-spin w-3 h-3 border-2 border-emerald-500 border-t-transparent rounded-full" />Syncing�</>
                      ) : (
                        <><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>Sync</>
                      )}
                    </button>
                  </div>

                  {s1SyncMsg && (
                    <div
                      className={`mb-3 px-3 py-2 rounded-lg text-xs border flex items-center gap-2 ${s1SyncMsg.ok
                        ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300"
                        : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300"
                        }`}
                    >
                      <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={s1SyncMsg.ok ? "M5 13l4 4L19 7" : "M12 9v2m0 4h.01"} /></svg>
                      {s1SyncMsg.text}
                    </div>
                  )}
                </div>

                {/* GRID */}
                <div
                  ref={containerRef}
                  className="w-full min-w-0"
                  onDragStart={(e) => e.stopPropagation()}
                >
                  <ResponsiveGridLayout
                    className="layout"
                    layouts={s1Layouts}
                    breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
                    cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
                    rowHeight={10}
                    width={containerWidth}
                    onLayoutChange={handleLayoutChange}
                    compactor={noCompactor}
                    dragConfig={{ enabled: isEditMode, handle: ".drag-handle" }}
                    resizeConfig={{ enabled: isEditMode, handles: ["s", "w", "e", "n", "sw", "nw", "se", "ne"] }}
                    margin={[10, 10]}
                  >
                    {/* -- Mitigation Status � always rendered, hidden via style when not visible -- */}
                    <div key="s1-mitigation" className="bg-[var(--card-bg)] rounded-2xl border border-[var(--card-border)] shadow-sm flex flex-col overflow-hidden" style={visibleS1Widgets.includes("s1-mitigation") ? {} : { visibility: "hidden", pointerEvents: "none" }}>
                      <div className="drag-handle cursor-grab active:cursor-grabbing bg-[var(--muted-bg)] border-b border-[var(--card-border)] px-4 py-3 flex items-center justify-between flex-shrink-0 select-none">
                        <div><p className="text-xs text-[var(--muted)] font-medium">SentinelOne</p><p className="text-sm font-bold text-[var(--foreground)]">Mitigation Status</p></div>
                        <div className="flex gap-1 items-center">
                          {(["donut", "probability", "bar"] as const).map(ct => (
                            <button key={ct} onClick={e => { e.stopPropagation(); setMitigationChart(ct); }}
                              className={`px-2 py-1 rounded-lg text-xs font-medium transition-colors ${mitigationChart === ct ? "bg-indigo-600 text-white" : "bg-[var(--card-bg)] border border-[var(--card-border)] text-[var(--muted)] hover:bg-[var(--muted-bg)]"}`}>
                              {ct === "donut" ? "Donut" : ct === "probability" ? "%" : "Bar"}
                            </button>
                          ))}
                          <button
                            onClick={e => { e.stopPropagation(); removeS1Widget("s1-mitigation"); }}
                            className={`w-5 h-5 flex items-center justify-center rounded text-[var(--muted)] hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400 transition-colors ml-1 flex-shrink-0 ${isEditMode ? "opacity-100" : "opacity-0 pointer-events-none"}`}
                            title="Remove widget"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                      <div className="flex-1 min-h-0 p-3 relative">
                        {s1Loading ? <Spin /> : s1Error ? <Err msg={s1Error} /> : mitigationData.length === 0 ? <Empty msg="No mitigation data" /> :
                          mitigationChart === "bar" ? (
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={mitigationData} margin={{ top: 8, right: 8, left: -10, bottom: 30 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
                                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--muted)" }} angle={-20} textAnchor="end" />
                                <YAxis tick={{ fontSize: 10, fill: "var(--muted)" }} allowDecimals={false} />
                                <Tooltip contentStyle={tooltipStyle} />
                                <Bar dataKey="value" radius={[4, 4, 0, 0]}>{mitigationData.map((d, i) => <Cell key={i} fill={d.fill} />)}</Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          ) : mitigationChart === "probability" ? (
                            <div className="h-full overflow-auto space-y-3 pt-2 px-1">
                              {mitigationData.map(d => (
                                <div key={d.name}>
                                  <div className="flex justify-between text-xs text-[var(--muted)] mb-1"><span className="font-medium capitalize">{d.name}</span><span>{mitigationTotal > 0 ? ((d.value / mitigationTotal) * 100).toFixed(1) : 0}%</span></div>
                                  <div className="w-full bg-[var(--muted-bg)] rounded-full h-2.5"><div className="h-2.5 rounded-full" style={{ width: mitigationTotal > 0 ? `${(d.value / mitigationTotal) * 100}%` : "0%", backgroundColor: d.fill }} /></div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="relative h-full flex items-center justify-center">
                              <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                  <Pie data={mitigationData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius="50%" outerRadius="70%" paddingAngle={2}>
                                    {mitigationData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                                  </Pie>
                                  <Tooltip contentStyle={tooltipStyle} />
                                  <Legend iconSize={9} wrapperStyle={{ fontSize: 11, color: "var(--muted)" }} />
                                </PieChart>
                              </ResponsiveContainer>
                              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                <p className="text-xs text-[var(--muted)]">Total</p>
                                <p className="text-2xl font-bold text-[var(--foreground)]">{mitigationTotal}</p>
                              </div>
                            </div>
                          )
                        }
                      </div>
                    </div>

                    {/* -- Threat Severity � always rendered, hidden via style when not visible -- */}
                    <div key="s1-severity" className="bg-[var(--card-bg)] rounded-2xl border border-[var(--card-border)] shadow-sm flex flex-col overflow-hidden" style={visibleS1Widgets.includes("s1-severity") ? {} : { visibility: "hidden", pointerEvents: "none" }}>
                      <div className="drag-handle cursor-grab active:cursor-grabbing bg-[var(--muted-bg)] border-b border-[var(--card-border)] px-4 py-3 flex items-center justify-between flex-shrink-0 select-none">
                        <div><p className="text-xs text-[var(--muted)] font-medium">SentinelOne</p><p className="text-sm font-bold text-[var(--foreground)]">Threat Severity</p></div>
                        <button
                          onClick={e => { e.stopPropagation(); removeS1Widget("s1-severity"); }}
                          className={`w-5 h-5 flex items-center justify-center rounded text-[var(--muted)] hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400 transition-colors ml-1 flex-shrink-0 ${isEditMode ? "opacity-100" : "opacity-0 pointer-events-none"}`}
                          title="Remove widget"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      <div className="flex-1 min-h-0 p-3">
                        {s1Loading ? <Spin /> : s1Error ? <Err msg={s1Error} /> : severityData.length === 0 ? <Empty msg="No severity data" /> : (
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={severityData} layout="vertical" margin={{ top: 5, right: 20, left: 5, bottom: 5 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" horizontal={false} />
                              <XAxis type="number" tick={{ fontSize: 10, fill: "var(--muted)" }} allowDecimals={false} />
                              <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "var(--muted)" }} width={65} />
                              <Tooltip contentStyle={tooltipStyle} />
                              <Bar dataKey="value" radius={[0, 4, 4, 0]}>{severityData.map((d, i) => <Cell key={i} fill={d.fill} />)}</Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        )}
                      </div>
                    </div>

                    {/* -- Recent Threats � always rendered, hidden via style when not visible -- */}
                    <div key="s1-threats" className="bg-[var(--card-bg)] rounded-2xl border border-[var(--card-border)] shadow-sm flex flex-col overflow-hidden" style={visibleS1Widgets.includes("s1-threats") ? {} : { visibility: "hidden", pointerEvents: "none" }}>
                      <div className="drag-handle cursor-grab active:cursor-grabbing bg-[var(--muted-bg)] border-b border-[var(--card-border)] px-4 py-3 flex items-center justify-between flex-shrink-0 select-none">
                        <div><p className="text-xs text-[var(--muted)] font-medium">SentinelOne</p><p className="text-sm font-bold text-[var(--foreground)]">Recent Threats</p></div>
                        <button
                          onClick={e => { e.stopPropagation(); removeS1Widget("s1-threats"); }}
                          className={`w-5 h-5 flex items-center justify-center rounded text-[var(--muted)] hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400 transition-colors ml-1 flex-shrink-0 ${isEditMode ? "opacity-100" : "opacity-0 pointer-events-none"}`}
                          title="Remove widget"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      <div className="flex-1 min-h-0 overflow-auto">
                        {s1Loading ? <Spin /> : s1Error ? <Err msg={s1Error} /> : recentThreats.length === 0 ? <Empty msg="No threats found" /> : (
                          <table className="w-full text-xs">
                            <thead className="sticky top-0 z-10 bg-[var(--muted-bg)]">
                              <tr><th className="text-left px-3 py-2 font-semibold text-[var(--muted)] border-b border-[var(--card-border)]">Threat</th><th className="text-left px-3 py-2 font-semibold text-[var(--muted)] border-b border-[var(--card-border)]">Status</th></tr>
                            </thead>
                            <tbody>
                              {recentThreats.map((t, i) => {
                                const status = t.threatInfo?.mitigationStatus || "unknown";
                                const cls = status === "mitigated" ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" : status === "active" ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" : status === "not_mitigated" ? "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300" : "bg-[var(--muted-bg)] text-[var(--muted)]";
                                return (
                                  <tr key={i} className={i % 2 === 0 ? "bg-[var(--card-bg)]" : "bg-[var(--muted-bg)]"}>
                                    <td className="px-3 py-2 border-b border-[var(--card-border)]">
                                      <p className="font-medium text-[var(--foreground)] truncate max-w-[110px]">{t.threatInfo?.threatName || "Unknown"}</p>
                                      <p className="text-[var(--muted)] truncate max-w-[110px]">{t.agentRealtimeInfo?.agentComputerName || "�"}</p>
                                    </td>
                                    <td className="px-3 py-2 border-b border-[var(--card-border)]">
                                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${cls}`}>{status.replace(/_/g, " ")}</span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </div>

                    {/* -- Agent Status � always rendered, hidden via style when not visible -- */}
                    <div key="s1-agents" className="bg-[var(--card-bg)] rounded-2xl border border-[var(--card-border)] shadow-sm flex flex-col overflow-hidden" style={visibleS1Widgets.includes("s1-agents") ? {} : { visibility: "hidden", pointerEvents: "none" }}>
                      <div className="drag-handle cursor-grab active:cursor-grabbing bg-[var(--muted-bg)] border-b border-[var(--card-border)] px-4 py-3 flex items-center justify-between flex-shrink-0 select-none">
                        <div><p className="text-xs text-[var(--muted)] font-medium">SentinelOne</p><p className="text-sm font-bold text-[var(--foreground)]">Agent Status</p></div>
                        <div className="flex gap-1 items-center">
                          <span className="px-2 py-0.5 rounded-lg text-xs font-semibold bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">{activeAgents} Active</span>
                          <span className="px-2 py-0.5 rounded-lg text-xs font-semibold bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">{inactiveAgents} Inactive</span>
                          <button
                            onClick={e => { e.stopPropagation(); removeS1Widget("s1-agents"); }}
                            className={`w-5 h-5 flex items-center justify-center rounded text-[var(--muted)] hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400 transition-colors ml-1 flex-shrink-0 ${isEditMode ? "opacity-100" : "opacity-0 pointer-events-none"}`}
                            title="Remove widget"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                      <div className="flex-1 min-h-0 overflow-auto">
                        {agentLoading ? <Spin /> : agentError ? <Err msg={agentError} /> : agentData.length === 0 ? <Empty msg="No agent info found" /> : (
                          <table className="w-full text-xs">
                            <thead className="sticky top-0 z-10 bg-[var(--muted-bg)]">
                              <tr><th className="text-left px-3 py-2 font-semibold text-[var(--muted)] border-b border-[var(--card-border)]">Computer</th><th className="text-left px-3 py-2 font-semibold text-[var(--muted)] border-b border-[var(--card-border)]">Active</th></tr>
                            </thead>
                            <tbody>
                              {agentData.map((a, i) => (
                                <tr key={i} className={i % 2 === 0 ? "bg-[var(--card-bg)]" : "bg-[var(--muted-bg)]"}>
                                  <td className="px-3 py-2 border-b border-[var(--card-border)] text-[var(--muted)] whitespace-nowrap">{a.computerName || "�"}</td>
                                  <td className="px-3 py-2 border-b border-[var(--card-border)]">
                                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${a.isActive ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"}`}>{a.isActive ? "Active" : "Inactive"}</span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </div>

                    {/* -- Application Agents � always present in RGL, hidden until added -- */}
                    <div key="s1-app-agent" className="bg-[var(--card-bg)] rounded-2xl border border-[var(--card-border)] shadow-sm flex flex-col overflow-hidden" style={visibleS1Widgets.includes("s1-app-agent") ? {} : { visibility: "hidden", pointerEvents: "none" }}>
                      <div className="drag-handle cursor-grab active:cursor-grabbing bg-[var(--muted-bg)] border-b border-[var(--card-border)] px-4 py-3 flex items-center justify-between flex-shrink-0 select-none">
                        <div><p className="text-xs text-[var(--muted)] font-medium">SentinelOne</p><p className="text-sm font-bold text-[var(--foreground)]">Application Agents</p></div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-lg text-xs font-semibold bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">{appAgentData.length} records</span>
                          <div className="flex items-center gap-0.5 bg-[var(--card-bg)] rounded-lg p-0.5 border border-[var(--card-border)]">
                            <button onClick={e => { e.stopPropagation(); setS1WidgetConfigs(p => ({ ...p, "s1-app-agent": { ...(p["s1-app-agent"] ?? { id: "s1-app-agent", viewMode: "table" }), viewMode: "graph" } })); }}
                              className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${s1WidgetConfigs["s1-app-agent"]?.viewMode === "graph" ? "bg-emerald-500 text-white" : "text-[var(--muted)] hover:text-[var(--foreground)]"}`}>Graph</button>
                            <button onClick={e => { e.stopPropagation(); setS1WidgetConfigs(p => ({ ...p, "s1-app-agent": { ...(p["s1-app-agent"] ?? { id: "s1-app-agent", viewMode: "table" }), viewMode: "table" } })); }}
                              className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${(s1WidgetConfigs["s1-app-agent"]?.viewMode ?? "table") === "table" ? "bg-blue-500 text-white" : "text-[var(--muted)] hover:text-[var(--foreground)]"}`}>Table</button>
                          </div>
                          <button
                            onClick={e => { e.stopPropagation(); removeS1Widget("s1-app-agent"); }}
                            className={`w-5 h-5 flex items-center justify-center rounded text-[var(--muted)] hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400 transition-colors ml-1 flex-shrink-0 ${isEditMode ? "opacity-100" : "opacity-0 pointer-events-none"}`}
                            title="Remove widget"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                      <div className="flex-1 min-h-0 overflow-hidden">
                        <S1ConfigWidget data={appAgentData} loading={appAgentLoading}
                          config={s1WidgetConfigs["s1-app-agent"] ?? { id: "s1-app-agent", viewMode: "table" }}
                          onConfigChange={patch => setS1WidgetConfigs(p => ({ ...p, "s1-app-agent": { ...(p["s1-app-agent"] ?? { id: "s1-app-agent", viewMode: "table" }), ...patch } }))}
                          accentColor="#a855f7" />
                      </div>
                    </div>

                    {/* -- Application CVEs � always present in RGL, hidden until added -- */}
                    <div key="s1-app-cve" className="bg-[var(--card-bg)] rounded-2xl border border-[var(--card-border)] shadow-sm flex flex-col overflow-hidden" style={visibleS1Widgets.includes("s1-app-cve") ? {} : { visibility: "hidden", pointerEvents: "none" }}>
                      <div className="drag-handle cursor-grab active:cursor-grabbing bg-[var(--muted-bg)] border-b border-[var(--card-border)] px-4 py-3 flex items-center justify-between flex-shrink-0 select-none">
                        <div><p className="text-xs text-[var(--muted)] font-medium">SentinelOne</p><p className="text-sm font-bold text-[var(--foreground)]">Application CVEs</p></div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-lg text-xs font-semibold bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">{appCveData.length} CVEs</span>
                          <div className="flex items-center gap-0.5 bg-[var(--card-bg)] rounded-lg p-0.5 border border-[var(--card-border)]">
                            <button onClick={e => { e.stopPropagation(); setS1WidgetConfigs(p => ({ ...p, "s1-app-cve": { ...(p["s1-app-cve"] ?? { id: "s1-app-cve", viewMode: "table" }), viewMode: "graph" } })); }}
                              className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${s1WidgetConfigs["s1-app-cve"]?.viewMode === "graph" ? "bg-emerald-500 text-white" : "text-[var(--muted)] hover:text-[var(--foreground)]"}`}>Graph</button>
                            <button onClick={e => { e.stopPropagation(); setS1WidgetConfigs(p => ({ ...p, "s1-app-cve": { ...(p["s1-app-cve"] ?? { id: "s1-app-cve", viewMode: "table" }), viewMode: "table" } })); }}
                              className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${(s1WidgetConfigs["s1-app-cve"]?.viewMode ?? "table") === "table" ? "bg-blue-500 text-white" : "text-[var(--muted)] hover:text-[var(--foreground)]"}`}>Table</button>
                          </div>
                          <button
                            onClick={e => { e.stopPropagation(); removeS1Widget("s1-app-cve"); }}
                            className={`w-5 h-5 flex items-center justify-center rounded text-[var(--muted)] hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400 transition-colors ml-1 flex-shrink-0 ${isEditMode ? "opacity-100" : "opacity-0 pointer-events-none"}`}
                            title="Remove widget"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                      <div className="flex-1 min-h-0 overflow-hidden">
                        <S1ConfigWidget data={appCveData} loading={appCveLoading}
                          config={s1WidgetConfigs["s1-app-cve"] ?? { id: "s1-app-cve", viewMode: "table" }}
                          onConfigChange={patch => setS1WidgetConfigs(p => ({ ...p, "s1-app-cve": { ...(p["s1-app-cve"] ?? { id: "s1-app-cve", viewMode: "table" }), ...patch } }))}
                          accentColor="#ef4444" />
                      </div>
                    </div>

                    {/* -- Device Control � always present in RGL, hidden until added -- */}
                    <div key="s1-device-control" className="bg-[var(--card-bg)] rounded-2xl border border-[var(--card-border)] shadow-sm flex flex-col overflow-hidden" style={visibleS1Widgets.includes("s1-device-control") ? {} : { visibility: "hidden", pointerEvents: "none" }}>
                      <div className="drag-handle cursor-grab active:cursor-grabbing bg-[var(--muted-bg)] border-b border-[var(--card-border)] px-4 py-3 flex items-center justify-between flex-shrink-0 select-none">
                        <div><p className="text-xs text-[var(--muted)] font-medium">SentinelOne</p><p className="text-sm font-bold text-[var(--foreground)]">Device Control</p></div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-lg text-xs font-semibold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">{deviceControlData.length} events</span>
                          <div className="flex items-center gap-0.5 bg-[var(--card-bg)] rounded-lg p-0.5 border border-[var(--card-border)]">
                            <button onClick={e => { e.stopPropagation(); setS1WidgetConfigs(p => ({ ...p, "s1-device-control": { ...(p["s1-device-control"] ?? { id: "s1-device-control", viewMode: "table" }), viewMode: "graph" } })); }}
                              className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${s1WidgetConfigs["s1-device-control"]?.viewMode === "graph" ? "bg-emerald-500 text-white" : "text-[var(--muted)] hover:text-[var(--foreground)]"}`}>Graph</button>
                            <button onClick={e => { e.stopPropagation(); setS1WidgetConfigs(p => ({ ...p, "s1-device-control": { ...(p["s1-device-control"] ?? { id: "s1-device-control", viewMode: "table" }), viewMode: "table" } })); }}
                              className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${(s1WidgetConfigs["s1-device-control"]?.viewMode ?? "table") === "table" ? "bg-blue-500 text-white" : "text-[var(--muted)] hover:text-[var(--foreground)]"}`}>Table</button>
                          </div>
                          <button
                            onClick={e => { e.stopPropagation(); removeS1Widget("s1-device-control"); }}
                            className={`w-5 h-5 flex items-center justify-center rounded text-[var(--muted)] hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400 transition-colors ml-1 flex-shrink-0 ${isEditMode ? "opacity-100" : "opacity-0 pointer-events-none"}`}
                            title="Remove widget"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                      <div className="flex-1 min-h-0 overflow-hidden">
                        <S1ConfigWidget data={deviceControlData} loading={deviceControlLoading}
                          config={s1WidgetConfigs["s1-device-control"] ?? { id: "s1-device-control", viewMode: "table" }}
                          onConfigChange={patch => setS1WidgetConfigs(p => ({ ...p, "s1-device-control": { ...(p["s1-device-control"] ?? { id: "s1-device-control", viewMode: "table" }), ...patch } }))}
                          accentColor="#6366f1" />
                      </div>
                    </div>

                    {/* -- RSS Feed � always present in RGL, hidden until added -- */}
                    <div key="s1-rss" className="bg-[var(--card-bg)] rounded-2xl border border-[var(--card-border)] shadow-sm flex flex-col overflow-hidden" style={visibleS1Widgets.includes("s1-rss") ? {} : { visibility: "hidden", pointerEvents: "none" }}>
                      <div className="drag-handle cursor-grab active:cursor-grabbing bg-[var(--muted-bg)] border-b border-[var(--card-border)] px-4 py-3 flex items-center justify-between flex-shrink-0 select-none">
                        <div><p className="text-xs text-[var(--muted)] font-medium">SentinelOne</p><p className="text-sm font-bold text-[var(--foreground)]">RSS Feed</p></div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-lg text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">{rssData.length} items</span>
                          <button
                            onClick={e => { e.stopPropagation(); removeS1Widget("s1-rss"); }}
                            className={`w-5 h-5 flex items-center justify-center rounded text-[var(--muted)] hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400 transition-colors ml-1 flex-shrink-0 ${isEditMode ? "opacity-100" : "opacity-0 pointer-events-none"}`}
                            title="Remove widget"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                      <div className="flex-1 min-h-0 overflow-auto">
                        {rssLoading ? <Spin /> : rssData.length === 0 ? <Empty msg="No RSS data � sync first" /> : (
                          <div className="divide-y divide-[var(--card-border)]">
                            {rssData.slice(0, 20).map((item: any, i: number) => {
                              const title = item.title || item.name || "Untitled";
                              const desc = item.summary || item.description || item.content || "";
                              const link = item.link || item.url || item.guid || null;
                              const date = item.published || item.pubDate || item.date || "";
                              // Extract thumbnail � match same logic as RssFeedPreview in picker
                              const enclosureLink = Array.isArray(item?.links)
                                ? item.links.find((l: any) => l?.rel === "enclosure")?.href ?? null
                                : null;
                              const image =
                                enclosureLink ??
                                item?.media_thumbnail ?? item?.enclosure?.url ?? item?.image?.url ??
                                item?.["media:thumbnail"]?.url ?? item?.thumbnail ?? null;
                              const displayDate = date
                                ? new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                                : "";
                              return (
                                <div key={i} className="flex items-start gap-3 px-3 py-2.5 hover:bg-[var(--muted-bg)] transition-colors group">
                                  {/* Thumbnail */}
                                  <div className="shrink-0 w-12 h-12 rounded-lg overflow-hidden bg-[var(--muted-bg)] flex items-center justify-center border border-[var(--card-border)]">
                                    {image ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img src={image} alt="" className="w-full h-full object-cover"
                                        onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                                    ) : (
                                      <svg className="w-5 h-5 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9" />
                                      </svg>
                                    )}
                                  </div>
                                  {/* Text */}
                                  <div className="flex-1 min-w-0">
                                    {link ? (
                                      <a href={link} target="_blank" rel="noopener noreferrer"
                                        className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline line-clamp-2 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 block leading-snug">
                                        {title}
                                      </a>
                                    ) : (
                                      <p className="text-xs font-semibold text-[var(--foreground)] line-clamp-2 leading-snug">{title}</p>
                                    )}
                                    {desc && <p className="text-[10px] text-[var(--muted)] mt-0.5 line-clamp-1">{String(desc).replace(/<[^>]+>/g, "")}</p>}
                                    {displayDate && <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1 font-medium">{displayDate}</p>}
                                  </div>
                                  {link && (
                                    <svg className="w-3 h-3 text-[var(--muted)] group-hover:text-emerald-500 shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                    </svg>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                  </ResponsiveGridLayout>
                </div>
              </div>
            );
          }

          /* --------- FIREWALL --------- */
          return (
            <div
              key="firewall"
              onDragOver={(e) => { e.preventDefault(); moveSection("firewall"); }}
              className="group/sec"
            >
              {/* -- FIREWALL ---------------------------------------------------------- */}
              <div className="pt-4 pb-5 relative z-10">
                {/* Section header � ONLY this bar is draggable */}
                <div
                  draggable
                  onDragStart={(e) => { e.stopPropagation(); dragSectionRef.current = "firewall"; }}
                  onDragEnd={(e) => { e.stopPropagation(); dragSectionRef.current = null; }}
                  className="flex items-center gap-3 mb-3 cursor-move select-none rounded-xl px-3 py-2 transition-all duration-200 hover:bg-orange-50/50 dark:hover:bg-orange-900/10"
                >
                  <div className="w-1.5 h-7 rounded-full bg-gradient-to-b from-orange-400 to-orange-600 flex-shrink-0 shadow-sm" />
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-orange-500 uppercase tracking-widest leading-none">Network</p>
                      <h2 className="text-sm font-bold text-[var(--foreground)] leading-tight">Palo Alto Firewall</h2>
                    </div>
                  </div>
                  <div className="flex-1 h-px bg-gradient-to-r from-orange-200 via-[var(--card-border)] to-transparent dark:from-orange-800" />
                  <button
                    onClick={(e) => { e.stopPropagation(); handleCollect(); }}
                    disabled={collecting}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-orange-600 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-900/30 disabled:opacity-50 transition-all duration-150 flex-shrink-0 border border-orange-200 dark:border-orange-700"
                  >
                    {collecting ? (
                      <><div className="animate-spin w-3 h-3 border-2 border-orange-500 border-t-transparent rounded-full" />Collecting�</>
                    ) : (
                      <><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>Collect</>
                    )}
                  </button>
                </div>
                {collectMsg && (
                  <div
                    className={`mb-3 px-3 py-2 rounded-lg text-xs border flex items-center gap-2 ${collectMsg.ok
                      ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300"
                      : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300"
                      }`}
                  >
                    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={collectMsg.ok ? "M5 13l4 4L19 7" : "M12 9v2m0 4h.01"} /></svg>
                    {collectMsg.text}
                  </div>
                )}
              </div>

              {/* GRID */}
              <div
                className="w-full min-w-0"
                onDragStart={(e) => e.stopPropagation()}
              >
                <ResponsiveGridLayout
                  className="layout"
                  layouts={fwLayouts}
                  breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
                  cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
                  rowHeight={10}
                  width={containerWidth}
                  onLayoutChange={handleLayoutChange}
                  compactor={noCompactor}
                  dragConfig={{ enabled: isEditMode, handle: ".drag-handle" }}
                  resizeConfig={{ enabled: isEditMode, handles: ["s", "w", "e", "n", "sw", "nw", "se", "ne"] }}
                  margin={[10, 10]}
                >
                  {/* Saved dynamic widgets */}
                  {fwWidgets.map(widget => (
                    <div key={widget.id}
                      className="bg-[var(--card-bg)] rounded-2xl border border-[var(--card-border)] shadow-sm overflow-hidden">
                      <FwGraphWidget widget={widget} onDelete={handleDeleteWidget} isEditMode={isEditMode} />
                    </div>
                  ))}
                </ResponsiveGridLayout>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- Inline FirewallGraphWidget (avoids import issues) -----------------------
function FwGraphWidget({ widget, onDelete, isEditMode }: { widget: any; onDelete: (id: string) => void; isEditMode: boolean }) {
  const [raw, setRaw] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!widget?.report_name) return;
    setLoading(true); setError(""); setRaw(null);
    fetch(`/api/firewall/reports/${widget.report_name}`, { credentials: "include" })
      .then(r => r.json())
      .then(d => { if (d.message && d.data === undefined) setError(d.message); else setRaw(d.data ?? null); })
      .catch(() => setError("Network error"))
      .finally(() => setLoading(false));
  }, [widget?.report_name]);

  const table = raw ? extractTable(raw) : null;
  const rows = table?.rows ?? [];
  const xList = parseAxis(widget.x_axis);
  const yList = parseAxis(widget.y_axis);
  const chartType = widget.chart_type || "bar";
  const xColName = xList[0] ?? "";

  const data = rows.slice(0, 50).map((row, i) => {
    const rawLabel = xList.length ? xList.map(x => row[x]).filter(v => v != null && v !== "").join(" | ") : `Item ${i + 1}`;
    const item: Record<string, any> = { label: fmtLbl(rawLabel, xColName) };
    yList.forEach(y => { item[y] = parseN(row[y]); });
    return item;
  }).filter(item => yList.some(y => Number(item[y]) > 0));

  const ts = { background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 8 };

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[var(--card-bg)]">
      <div className="drag-handle cursor-grab active:cursor-grabbing bg-[var(--muted-bg)] border-b border-[var(--card-border)] px-4 py-3 flex items-start justify-between flex-shrink-0">
        <div className="min-w-0">
          <p className="text-xs text-[var(--muted)] font-medium">Palo Alto Firewall</p>
          <p className="text-sm font-bold text-[var(--foreground)] truncate">{widget.report_name}</p>
          <p className="text-[10px] text-[var(--muted)] mt-0.5 truncate">X: {xList.join(", ") || "�"} � Y: {yList.join(", ") || "�"}</p>
        </div>
        <button onClick={e => { e.stopPropagation(); onDelete(widget.id); }} className={`rounded-lg px-2 py-1 text-sm transition-all ${isEditMode ? "text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-100" : "opacity-0 pointer-events-none"}`} title="Delete widget">??</button>
      </div>
      <div className="flex-1 min-h-0 p-3">
        {loading ? <div className="h-full flex items-center justify-center"><div className="animate-spin w-6 h-6 border-4 border-indigo-500 border-t-transparent rounded-full" /></div>
          : error ? <div className="h-full flex items-center justify-center"><p className="text-sm text-red-500">{error}</p></div>
            : !xList.length || !yList.length ? <div className="h-full flex items-center justify-center"><p className="text-sm text-[var(--muted)]">X or Y axis not configured</p></div>
              : data.length === 0 ? <div className="h-full flex items-center justify-center"><p className="text-sm text-[var(--muted)]">No numeric data</p></div>
                : <DynChart rows={rows} xList={xList} yList={yList} chartType={yList.length > 1 ? "mixed" : chartType as any} />
        }
      </div>
    </div>
  );
}

function parseAxis(v: any): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  try { const p = JSON.parse(v); return Array.isArray(p) ? p : [String(v)]; } catch { return String(v).split(",").map(s => s.trim()).filter(Boolean); }
}

// --- Dynamic chart component --------------------------------------------------
const PCOLS = ["#6366f1", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6", "#06b6d4"];

// --- Column type detection ----------------------------------------------------
function isTimeCol(col: string): boolean {
  return /time|date|timestamp/i.test(col);
}
function isBytesCol(col: string): boolean {
  return /byte|bps|bandwidth/i.test(col);
}

function parseN(v: any): number {
  if (v == null || v === "") return 0;
  const s = String(v).replace(/,/g, "").trim().toLowerCase();
  const n = parseFloat(s);
  if (isNaN(n)) return 0;
  if (s.includes("tb")) return n * 1e12; if (s.includes("gb")) return n * 1e9;
  if (s.includes("mb")) return n * 1e6; if (s.includes("kb")) return n * 1e3;
  return n;
}

/** Format a raw value for X-axis label � detects timestamps and date strings */
function fmtLbl(v: any, colName?: string): string {
  const s = String(v ?? "");
  if (!s || s === "undefined" || s === "null") return "�";

  // Unix timestamp (seconds or ms) � covers slabbed-receive_time
  const num = Number(s.replace(/,/g, ""));
  if (!isNaN(num) && num > 1_000_000_000) {
    const ms = num > 9_999_999_999 ? num : num * 1000;
    return new Date(ms).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: true });
  }

  // PA date format: DD/MM/YYYY HH:MM:SS
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4}),?\s+(\d{2}):(\d{2}):(\d{2})$/);
  if (m) {
    const [, dd, mm, yyyy, hh, min] = m;
    return new Date(+yyyy, +mm - 1, +dd, +hh, +min).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: true });
  }

  // ISO / other parseable date when column name hints at time
  if (colName && isTimeCol(colName)) {
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: true });
  }

  return s.length > 20 ? s.slice(0, 20) + "�" : s;
}

function DynChart({ rows, xList, yList, chartType }: { rows: Record<string, any>[]; xList: string[]; yList: string[]; chartType: "bar" | "line" | "mixed" }) {
  const ts = { background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 8 };

  // Detect column types for smart formatting
  const xColName = xList[0] ?? "";
  const xIsTime = isTimeCol(xColName);

  // Build data � pass colName to fmtLbl so timestamps are formatted
  const data = rows.slice(0, 50).map((row, i) => {
    const rawLabel = xList.length ? xList.map(x => row[x]).filter(v => v != null && v !== "").join(" | ") : `Item ${i + 1}`;
    const item: Record<string, any> = {
      label: fmtLbl(rawLabel, xColName),
      _rawLabel: rawLabel, // keep raw for tooltip
    };
    yList.forEach(y => { item[y] = parseN(row[y]); });
    return item;
  }).filter(item => yList.some(y => Number(item[y]) > 0));

  if (data.length === 0) return (
    <div className="h-full flex items-center justify-center text-center px-4 py-12">
      <p className="text-sm text-[var(--muted)]">No numeric data for selected Y-Axis columns</p>
    </div>
  );

  // Per-Y-column byte detection
  const yIsBytesMap: Record<string, boolean> = {};
  yList.forEach(y => { yIsBytesMap[y] = isBytesCol(y); });

  // Tick formatter for a Y axis
  const anyBytes = yList.some(y => yIsBytesMap[y]);
  const yTickFmt = (v: number) => anyBytes ? fmtBytesShort(v) : v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1_000 ? `${(v / 1_000).toFixed(1)}K` : String(v);

  // Tooltip formatters � cast to any to satisfy Recharts strict generics
  const tooltipFmt: any = (value: any, name: any) => {
    const n = Number(value);
    const k = String(name);
    if (yIsBytesMap[k]) return [fmtBytes(n), k];
    if (n >= 1_000_000) return [`${(n / 1_000_000).toFixed(2)}M`, k];
    if (n >= 1_000) return [n.toLocaleString(), k];
    return [String(value), k];
  };
  const tooltipLabelFmt: any = (label: any, payload: any[]) => {
    if (xIsTime && payload?.[0]?.payload?._rawLabel) {
      return fmtLbl(payload[0].payload._rawLabel, xColName);
    }
    return String(label ?? "");
  };

  const isMixed = chartType === "mixed" || yList.length > 1;

  if (isMixed) return (
    <div className="w-full h-full min-h-[200px] p-2">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 55, left: 10, bottom: 55 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--muted)" }} angle={-25} textAnchor="end" height={65} interval="preserveStartEnd" />
          <YAxis yAxisId="left" orientation="left" tick={{ fontSize: 10, fill: "var(--muted)" }} tickFormatter={yTickFmt} width={55} />
          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: "var(--muted)" }} tickFormatter={yTickFmt} width={55} />
          <Tooltip contentStyle={ts} formatter={tooltipFmt} labelFormatter={tooltipLabelFmt} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {yList.map((y, i) => i === 0
            ? <Bar key={y} yAxisId="left" dataKey={y} name={y} fill={PCOLS[i % PCOLS.length]} barSize={24} radius={[4, 4, 0, 0]} />
            : <Line key={y} yAxisId="right" type="monotone" dataKey={y} name={y} stroke={PCOLS[i % PCOLS.length]} strokeWidth={2} dot={{ r: 3 }} />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );

  if (chartType === "line") return (
    <div className="w-full h-full min-h-[200px] p-2">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 55 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--muted)" }} angle={-25} textAnchor="end" height={65} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 10, fill: "var(--muted)" }} tickFormatter={yTickFmt} width={55} />
          <Tooltip contentStyle={ts} formatter={tooltipFmt} labelFormatter={tooltipLabelFmt} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {yList.map((y, i) => <Line key={y} type="monotone" dataKey={y} name={y} stroke={PCOLS[i % PCOLS.length]} strokeWidth={2} dot={{ r: 3 }} />)}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );

  return (
    <div className="w-full h-full min-h-[200px] p-2">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 55 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--muted)" }} angle={-25} textAnchor="end" height={65} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 10, fill: "var(--muted)" }} tickFormatter={yTickFmt} width={55} />
          <Tooltip contentStyle={ts} formatter={tooltipFmt} labelFormatter={tooltipLabelFmt} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {yList.map((y, i) => <Bar key={y} dataKey={y} name={y} fill={PCOLS[i % PCOLS.length]} radius={[4, 4, 0, 0]} />)}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// --- Utility functions --------------------------------------------------------
function getNum(v: any): number {
  if (v == null || v === "") return 0;
  const n = Number(String(v).replace(/,/g, "").replace(/[^\d.]/g, ""));
  return isNaN(n) ? 0 : n;
}

function fmtBytes(b: number): string {
  if (!b || isNaN(b)) return "0";
  if (b >= 1e12) return (b / 1e12).toFixed(2) + " TB"; if (b >= 1e9) return (b / 1e9).toFixed(2) + " GB";
  if (b >= 1e6) return (b / 1e6).toFixed(2) + " MB"; if (b >= 1e3) return (b / 1e3).toFixed(2) + " KB";
  return b + " B";
}

function fmtBytesShort(b: number): string {
  if (!b || isNaN(b)) return "0";
  if (b >= 1e12) return `${(b / 1e12).toFixed(1)}T`; if (b >= 1e9) return `${(b / 1e9).toFixed(1)}G`;
  if (b >= 1e6) return `${(b / 1e6).toFixed(1)}M`; if (b >= 1e3) return `${(b / 1e3).toFixed(1)}K`;
  return String(b);
}

function fmtCell(col: string, val: any): string {
  if (val == null || val === "") return "�";
  const s = String(val);
  if (col.includes("time") || col.includes("date")) { const ts = Number(val); if (!isNaN(ts) && ts > 1_000_000_000) return new Date(ts * 1000).toLocaleString(); const d = new Date(s); if (!isNaN(d.getTime())) return d.toLocaleString(); return s; }
  if (col === "nbytes" || col.includes("byte")) { const n = Number(val); if (!isNaN(n)) return fmtBytes(n); }
  const n = Number(val); if (!isNaN(n) && s === String(n) && n > 999) return n.toLocaleString();
  return s;
}

function parsePADate(v: any): Date | null {
  if (!v) return null;
  const s = String(v).trim();
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4}),?\s+(\d{2}):(\d{2}):(\d{2})$/);
  if (m) { const [, dd, mm, yyyy, hh, min, ss] = m; return new Date(+yyyy, +mm - 1, +dd, +hh, +min, +ss); }
  const n = Number(s); if (!isNaN(n)) return new Date(n > 9999999999 ? n : n * 1000);
  const d = new Date(s); return isNaN(d.getTime()) ? null : d;
}

function fmtDateTime(v: any): string {
  const d = parsePADate(v); if (!d) return String(v ?? "");
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: true });
}

function parseBytesToBytes(v: any): number {
  if (v == null || v === "") return 0;
  const s = String(v).replace(/,/g, "").trim().toLowerCase(); const n = parseFloat(s); if (isNaN(n)) return 0;
  if (s.includes("tb")) return n * 1e12; if (s.includes("gb")) return n * 1e9;
  if (s.includes("mb")) return n * 1e6; if (s.includes("kb")) return n * 1e3;
  return n;
}

function buildRiskTrendData(rows: Record<string, any>[]) {
  return rows.map((row, i) => {
    const rawTime = row["slabbed-receive_time"] || row["slabbed-receive-time"] || row["receive_time"] || row["receive-time"] || row["time"];
    const date = parsePADate(rawTime);
    const nbytesBytes = parseBytesToBytes(row["nbytes"]);
    return { time: date ? date.getTime() : i, nbytesBytes, nbytesText: fmtBytes(nbytesBytes), nsessValue: getNum(row["nsess"]), nsessText: String(row["nsess"] ?? "") };
  }).sort((a, b) => Number(a.time) - Number(b.time));
}

interface TableData { columns: string[]; rows: Record<string, any>[]; }

function extractTable(raw: any): TableData | null {
  if (!raw) return null;
  try {
    const entry: any[] | undefined =
      toArr(raw?.report?.result?.entry) ?? toArr(raw?.report?.result?.report?.entry) ??
      toArr(raw?.response?.result?.report?.entry) ?? toArr(raw?.response?.result?.entry) ??
      toArr(raw?.result?.report?.entry) ?? toArr(raw?.result?.entry) ?? toArr(raw?.entry);
    if (entry && entry.length > 0) {
      const colSet = new Set<string>();
      entry.forEach(e => { if (typeof e === "object" && e !== null) Object.keys(e).forEach(k => { if (k === "@name") colSet.add("name"); else if (!k.startsWith("@")) colSet.add(k); }); });
      if (colSet.size === 0) return null;
      const columns = Array.from(colSet);
      const rows = entry.map(e => { const row: Record<string, any> = {}; columns.forEach(col => { const rk = col === "name" ? "@name" : col; const v = e?.[rk] ?? e?.[col]; row[col] = typeof v === "object" && v !== null && "#text" in v ? v["#text"] : v ?? ""; }); return row; });
      return { columns, rows };
    }
    const result = raw?.report?.result ?? raw?.response?.result ?? raw?.result;
    if (result && typeof result === "object") { const keys = Object.keys(result).filter(k => !k.startsWith("@") && typeof result[k] !== "object"); if (keys.length > 0) return { columns: keys, rows: [Object.fromEntries(keys.map(k => [k, result[k]]))] }; }
  } catch { }
  return null;
}

function toArr(v: any): any[] | undefined {
  if (Array.isArray(v) && v.length > 0) return v;
  if (v && typeof v === "object" && !Array.isArray(v)) return [v];
  return undefined;
}