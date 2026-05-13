"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { ResponsiveGridLayout } from "react-grid-layout";
import type { Layout, LayoutItem } from "react-grid-layout";
import {
  PieChart, Pie, Cell, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ComposedChart,
  ResponsiveContainer,
} from "recharts";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";


// ─── All 40 Palo Alto report names ───────────────────────────────────────────
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
  "top-victims-by-destination-countries", "top-viruses", "top-vulnerabilities",
  "top-websites",
];

const CHART_COLORS = ["#3b82f6", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#6366f1"];

interface BoxLayout { i: string; x: number; y: number; w: number; h: number; }
interface PageState {
  mitigationChart: "donut" | "probability" | "bar";
  firewallReport: string;
  boxes: BoxLayout[];
}

const DEFAULT_STATE: PageState = {
  mitigationChart: "donut",
  firewallReport: "bandwidth-trend",
  boxes: [
    { i: "sentinelone-section", x: 0, y: 0, w: 12, h: 1 },

    { i: "mitigation", x: 0, y: 1, w: 3, h: 6 },
    { i: "severity", x: 3, y: 1, w: 3, h: 6 },
    { i: "threats", x: 6, y: 1, w: 3, h: 6 },
    { i: "agents", x: 9, y: 1, w: 3, h: 6 },

    { i: "firewall-section", x: 0, y: 7, w: 12, h: 1 },

    { i: "firewall", x: 0, y: 8, w: 7, h: 7 },
    { i: "fwthreat", x: 7, y: 8, w: 5, h: 7 },
  ],
};



// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SentinelOneDashboard() {
  const { activeOrgSlug, activeOrgName } = useAuth();

  const [state, setState] = useState<PageState>(DEFAULT_STATE);
  const [stateLoaded, setStateLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // SentinelOne
  const [s1Data, setS1Data] = useState<any[]>([]);
  const [s1Loading, setS1Loading] = useState(true);
  const [s1Error, setS1Error] = useState("");

  // Firewall
  const [fwRaw, setFwRaw] = useState<any>(null);
  const [fwUpdated, setFwUpdated] = useState<string | null>(null);
  const [fwLoading, setFwLoading] = useState(false);
  const [fwError, setFwError] = useState("");

  // Collect
  const [collecting, setCollecting] = useState(false);
  const [collectMsg, setCollectMsg] = useState<{ text: string; ok: boolean } | null>(null);

  // Container width
  const [containerWidth, setContainerWidth] = useState(2000);
  const containerRef = useRef<HTMLDivElement>(null);

  const [agentInfoData, setAgentInfoData] = useState<any[]>([]);
  const [agentInfoLoading, setAgentInfoLoading] = useState(false);
  const [agentInfoError, setAgentInfoError] = useState("");


  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setContainerWidth(e.contentRect.width || 1200));
    ro.observe(el);
    setContainerWidth(el.offsetWidth || 1200);
    return () => ro.disconnect();
  }, []);

  // Load persisted state
  useEffect(() => {
    if (!activeOrgSlug) {
      setStateLoaded(true);
      return;
    }

    fetch("/api/dashboard/layout", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        const savedBoxes = Array.isArray(d.layout?.secboxes)
          ? d.layout.secboxes
          : [];

        const mergedBoxes = normalizeBoxes(savedBoxes);

        setState((prev) => ({
          ...prev,
          ...(d.layout?.secopts || {}),
          boxes: mergedBoxes,
        }));
      })
      .catch(() => { })
      .finally(() => setStateLoaded(true));
  }, [activeOrgSlug]);
  // Debounced save
  const persistState = useCallback((next: PageState) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSaving(true);
    saveTimerRef.current = setTimeout(() => {
      fetch("/api/dashboard/layout", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          layout: {
            secboxes: next.boxes,
            secopts: { mitigationChart: next.mitigationChart, firewallReport: next.firewallReport },
          },
        }),
      })
        .then(() => { setSaved(true); setTimeout(() => setSaved(false), 2500); })
        .finally(() => setSaving(false));
    }, 800);
  }, []);

  const updateState = useCallback((patch: Partial<PageState>) => {
    setState(prev => {
      const next = { ...prev, ...patch };
      persistState(next);
      return next;
    });
  }, [persistState]);

  // Load S1 threats from API
  useEffect(() => {
    if (!activeOrgSlug) return;
    setS1Loading(true);
    fetch("/api/sentinelone/threats", { credentials: "include" })
      .then(async r => {
        const j = await r.json();
        if (!r.ok || (j.message && !j.data)) setS1Error(j.message || "Failed");
        else setS1Data(j.data || []);
      })
      .catch(e => setS1Error(e.message))
      .finally(() => setS1Loading(false));
  }, [activeOrgSlug]);

  // Load agents from API
  useEffect(() => {
    if (!activeOrgSlug) return;

    setAgentInfoLoading(true);
    setAgentInfoError("");

    fetch("/api/sentinelone/sentinalone_agentinfo", { credentials: "include" })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) { setAgentInfoError(j.message || "Failed to load agent info"); return; }
        setAgentInfoData(Array.isArray(j.data) ? j.data : []);
      })
      .catch((e) => setAgentInfoError(e.message || "Network error"))
      .finally(() => setAgentInfoLoading(false));
  }, [activeOrgSlug]);
  // useEffect(() => {
  //   // if (!activeOrgSlug) return;
  //   // setS1Loading(true);
  //   fetch("/api/sentinelone/sentinalone_applicationagent", { credentials: "include" })
  //     .then(async r => {
  //       const j = await r.json();
  //       // if (!r.ok || (j.message && !j.data)) setS1Error(j.message || "Failed");
  //       // else setS1Data(j.data || []);
  //       console.log("j", j)
  //     })
  //     .catch(e => setS1Error(e.message))
  //     .finally(() => setS1Loading(false));
  // }, []);

  // useEffect(() => {
  //   // if (!activeOrgSlug) return;
  //   // setS1Loading(true);
  //   fetch("/api/sentinelone/sentinalone_applicationCVE", { credentials: "include" })
  //     .then(async r => {
  //       const j = await r.json();
  //       // if (!r.ok || (j.message && !j.data)) setS1Error(j.message || "Failed");
  //       // else setS1Data(j.data || []);
  //       console.log("j", j)
  //     })
  //     .catch(e => setS1Error(e.message))
  //     .finally(() => setS1Loading(false));
  // }, []);

  // useEffect(() => {
  //   // if (!activeOrgSlug) return;
  //   // setS1Loading(true);
  //   fetch("/api/sentinelone/sentinalone_rss", { credentials: "include" })
  //     .then(async r => {
  //       const j = await r.json();
  //       // if (!r.ok || (j.message && !j.data)) setS1Error(j.message || "Failed");
  //       // else setS1Data(j.data || []);
  //       console.log("j", j)
  //     })
  //     .catch(e => setS1Error(e.message))
  //     .finally(() => setS1Loading(false));
  // }, []);

  // useEffect(() => {
  //   // if (!activeOrgSlug) return;
  //   // setS1Loading(true);
  //   fetch("/api/sentinelone/sentinalone_devicecontrol", { credentials: "include" })
  //     .then(async r => {
  //       const j = await r.json();
  //       // if (!r.ok || (j.message && !j.data)) setS1Error(j.message || "Failed");
  //       // else setS1Data(j.data || []);
  //       console.log("j", j)
  //     })
  //     .catch(e => setS1Error(e.message))
  //     .finally(() => setS1Loading(false));
  // }, []);

  // useEffect(() => {
  //   // if (!activeOrgSlug) return;
  //   // setS1Loading(true);
  //   fetch("/api/sentinelone/sentinalone_threats", { credentials: "include" })
  //     .then(async r => {
  //       const j = await r.json();
  //       // if (!r.ok || (j.message && !j.data)) setS1Error(j.message || "Failed");
  //       // else setS1Data(j.data || []);
  //       console.log("j", j)
  //     })
  //     .catch(e => setS1Error(e.message))
  //     .finally(() => setS1Loading(false));
  // }, []);

  // Load firewall report
  useEffect(() => {
    if (!activeOrgSlug || !state.firewallReport) return;
    setFwLoading(true); setFwError(""); setFwRaw(null);
    fetch(`/api/firewall/reports/${state.firewallReport}`, { credentials: "include" })
      .then(r => r.json())
      .then(d => {
        if (d.message && d.data === undefined) setFwError(d.message);
        else { setFwRaw(d.data ?? null); setFwUpdated(d.updatedAt ?? null); }
      })
      .catch(() => setFwError("Network error"))
      .finally(() => setFwLoading(false));
  }, [activeOrgSlug, state.firewallReport]);

  // Collect firewall data
  const handleCollect = async () => {
    setCollecting(true); setCollectMsg(null);
    try {
      const res = await fetch("/api/firewall/collect", { method: "POST", credentials: "include" });
      const d = await res.json();
      setCollectMsg({ text: d.message || "Done", ok: res.ok });
      if (res.ok) {
        setFwLoading(true);
        fetch(`/api/firewall/reports/${state.firewallReport}`, { credentials: "include" })
          .then(r => r.json())
          .then(d => { setFwRaw(d.data ?? null); setFwUpdated(d.updatedAt ?? null); })
          .finally(() => setFwLoading(false));
      }
    } catch { setCollectMsg({ text: "Collection failed", ok: false }); }
    finally { setCollecting(false); }
  };

  const handleLayoutChange = (newLayout: Layout) => {
    const boxes = DEFAULT_STATE.boxes.map((defaultBox) => {
      const currentBox = state.boxes.find((b) => b.i === defaultBox.i);
      const layoutBox = newLayout.find((n: LayoutItem) => n.i === defaultBox.i);

      return {
        ...defaultBox,
        ...(currentBox || {}),
        ...(layoutBox
          ? {
            x: layoutBox.x,
            y: layoutBox.y,
            w: layoutBox.w,
            h: layoutBox.h,
          }
          : {}),
      };
    });

    updateState({ boxes });
  };

  if (!activeOrgSlug) return (
    <div className="p-8">
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-6">
        <h3 className="font-semibold text-amber-800 dark:text-amber-300">No Organization Selected</h3>
        <p className="text-amber-700 dark:text-amber-400 mt-1 text-sm">Select an organization to view the security dashboard.</p>
      </div>
    </div>
  );

  if (!stateLoaded) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
    </div>
  );

  const gridLayout: LayoutItem[] = state.boxes.map((b) => {
    const isSection = b.i.includes("section");

    return {
      i: b.i,
      x: b.x,
      y: b.y,
      w: b.w,
      h: b.h,
      minW: isSection ? 12 : 3,
      maxW: isSection ? 12 : undefined,
      minH: isSection ? 1 : 4,
      maxH: isSection ? 1 : undefined,
      static: isSection,
      isDraggable: !isSection,
      isResizable: !isSection,
    };
  });

  const fwTable = fwRaw ? extractTable(fwRaw) : null;

  // Build mitigation chart data
  const mitigationCounts: Record<string, number> = {};
  s1Data.forEach(t => {
    const s = t.threatInfo?.mitigationStatus || "unknown";
    mitigationCounts[s] = (mitigationCounts[s] || 0) + 1;
  });
  const mitigationData = Object.entries(mitigationCounts).map(([name, value], i) => ({
    name, value, fill: CHART_COLORS[i % CHART_COLORS.length],
  }));
  const mitigationTotal = mitigationData.reduce((s, d) => s + d.value, 0);

  // Severity breakdown
  const severityCounts: Record<string, number> = {};
  s1Data.forEach(t => {
    const s = t.threatInfo?.confidenceLevel || "unknown";
    severityCounts[s] = (severityCounts[s] || 0) + 1;
  });
  const severityData = Object.entries(severityCounts).map(([name, value], i) => ({
    name, value, fill: CHART_COLORS[i % CHART_COLORS.length],
  }));

  // Recent threats (last 10)
  const recentThreats = [...s1Data]
    .sort((a, b) => new Date(b.threatInfo?.createdAt || 0).getTime() - new Date(a.threatInfo?.createdAt || 0).getTime())
    .slice(0, 10);

  // Firewall threat trend (line chart)
  const fwTrendData =
    state.firewallReport === "risk-trend" && fwTable?.rows?.length
      ? buildRiskTrendData(fwTable.rows)
      : [];

  const activeCount = agentInfoData.filter(a => a.isActive).length;
  const inactiveCount = agentInfoData.filter(a => !a.isActive).length;
  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Security Dashboard</h1>
          <p className="text-[var(--muted)] text-sm mt-0.5">{activeOrgName} · Drag to move · Resize from corners</p>
        </div>
        <div className="flex items-center gap-3">
          {saving && (
            <span className="text-xs text-[var(--muted)] flex items-center gap-1.5">
              <div className="animate-spin w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full" />
              Saving…
            </span>
          )}
          {saved && (
            <span className="text-xs text-green-600 flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Saved
            </span>
          )}
          <button
            onClick={handleCollect}
            disabled={collecting}
            className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {collecting ? (
              <><div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />Collecting…</>
            ) : (
              <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>Collect Firewall Data</>
            )}
          </button>
        </div>
      </div>

      {collectMsg && (
        <div className={`mb-4 px-4 py-3 rounded-xl text-sm border ${collectMsg.ok ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300" : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300"}`}>
          {collectMsg.text}
        </div>
      )}

      {/* Grid */}
      <div ref={containerRef}>
        <ResponsiveGridLayout
          className="layout"
          layouts={{ lg: gridLayout }}
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
          cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
          rowHeight={60}
          width={containerWidth}
          onLayoutChange={handleLayoutChange}
          dragConfig={{ handle: ".drag-handle" }}
          resizeConfig={{ handles: ["s", "w", "e", "n", "sw", "nw", "se", "ne"] }}
          margin={[12, 12]}
        >
          <div
            key="sentinelone-section"
            className="flex items-center gap-4 px-2 py-1 bg-transparent"
          >
            <h2 className="text-lg font-bold text-[var(--foreground)] whitespace-nowrap">
              SentinelOne
            </h2>
            <div className="h-px flex-1 bg-[var(--card-border)]" />
          </div>
          {/* ── Widget 1: Mitigation Status ── */}
          <div key="mitigation" className="bg-[var(--card-bg)] rounded-2xl border border-[var(--card-border)] shadow-sm flex flex-col overflow-hidden">
            <div className="drag-handle cursor-grab active:cursor-grabbing bg-[var(--muted-bg)] border-b border-[var(--card-border)] px-4 py-3 flex items-center justify-between flex-shrink-0 select-none" aria-label="Mitigation Status widget">
              <div>
                <p className="text-xs text-[var(--muted)] font-medium">SentinelOne</p>
                <p className="text-sm font-bold text-[var(--foreground)]">Mitigation Status</p>
              </div>
              <div className="flex gap-1">
                {(["donut", "probability", "bar"] as const).map(ct => (
                  <button key={ct} onClick={e => { e.stopPropagation(); updateState({ mitigationChart: ct }); }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${state.mitigationChart === ct ? "bg-blue-500 text-white" : "bg-[var(--card-bg)] border border-[var(--card-border)] text-[var(--muted)] hover:bg-[var(--muted-bg)]"}`}>
                    {ct === "donut" ? "Donut" : ct === "probability" ? "%" : "Bar"}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 min-h-0 p-4 relative">
              {s1Loading ? <LoadingSpinner /> : s1Error ? <ErrorMsg msg={s1Error} /> : mitigationData.length === 0 ? <EmptyMsg msg="No mitigation data" /> :
                state.mitigationChart === "bar" ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={mitigationData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--muted)" }} angle={-20} textAnchor="end" />
                      <YAxis tick={{ fontSize: 11, fill: "var(--muted)" }} allowDecimals={false} />
                      <Tooltip contentStyle={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 8 }} />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {mitigationData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : state.mitigationChart === "probability" ? (
                  <div className="h-full overflow-auto space-y-3 pt-2">
                    {mitigationData.map(d => (
                      <div key={d.name}>
                        <div className="flex justify-between text-xs text-[var(--muted)] mb-1">
                          <span className="font-medium capitalize">{d.name}</span>
                          <span>{mitigationTotal > 0 ? ((d.value / mitigationTotal) * 100).toFixed(1) : 0}%</span>
                        </div>
                        <div className="w-full bg-[var(--muted-bg)] rounded-full h-3">
                          <div className="h-3 rounded-full transition-all" style={{ width: mitigationTotal > 0 ? `${(d.value / mitigationTotal) * 100}%` : "0%", backgroundColor: d.fill }} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="relative h-full flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={mitigationData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius="52%" outerRadius="72%" paddingAngle={2}>
                          {mitigationData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                        </Pie>
                        <Tooltip contentStyle={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 8 }} />
                        <Legend iconSize={10} wrapperStyle={{ fontSize: 12, color: "var(--muted)" }} />
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

          {/* ── Widget 2: Severity Breakdown ── */}
          <div key="severity" className="bg-[var(--card-bg)] rounded-2xl border border-[var(--card-border)] shadow-sm flex flex-col overflow-hidden">
            <div className="drag-handle cursor-grab active:cursor-grabbing bg-[var(--muted-bg)] border-b border-[var(--card-border)] px-4 py-3 flex-shrink-0 select-none" aria-label="Severity Breakdown widget">
              <p className="text-xs text-[var(--muted)] font-medium">SentinelOne</p>
              <p className="text-sm font-bold text-[var(--foreground)]">Threat Severity</p>
            </div>
            <div className="flex-1 min-h-0 p-4">
              {s1Loading ? <LoadingSpinner /> : s1Error ? <ErrorMsg msg={s1Error} /> : severityData.length === 0 ? <EmptyMsg msg="No threat data" /> : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={severityData} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: "var(--muted)" }} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "var(--muted)" }} width={70} />
                    <Tooltip contentStyle={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 8 }} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {severityData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* ── Widget 3: Recent Threats List ── */}
          <div key="threats" className="bg-[var(--card-bg)] rounded-2xl border border-[var(--card-border)] shadow-sm flex flex-col overflow-hidden">
            <div className="drag-handle cursor-grab active:cursor-grabbing bg-[var(--muted-bg)] border-b border-[var(--card-border)] px-4 py-3 flex-shrink-0 select-none" aria-label="Recent Threats widget">
              <p className="text-xs text-[var(--muted)] font-medium">SentinelOne</p>
              <p className="text-sm font-bold text-[var(--foreground)]">Recent Threats</p>
            </div>
            <div className="flex-1 min-h-0 overflow-auto">
              {s1Loading ? <LoadingSpinner /> : s1Error ? <ErrorMsg msg={s1Error} /> : recentThreats.length === 0 ? <EmptyMsg msg="No threats found" /> : (
                <table className="w-full text-xs">
                  <thead className="sticky top-0 z-10 bg-[var(--muted-bg)]">
                    <tr>
                      <th scope="col" className="text-left px-3 py-2 font-semibold text-[var(--muted)] border-b border-[var(--card-border)]">Threat</th>
                      <th scope="col" className="text-left px-3 py-2 font-semibold text-[var(--muted)] border-b border-[var(--card-border)]">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentThreats.map((t, i) => {
                      const status = t.threatInfo?.mitigationStatus || "unknown";
                      const isGreen = status === "mitigated";
                      const isRed = status === "active";
                      return (
                        <tr key={i} className={i % 2 === 0 ? "bg-[var(--card-bg)]" : "bg-[var(--muted-bg)]"}>
                          <td className="px-3 py-2 border-b border-[var(--card-border)]">
                            <p className="font-medium text-[var(--foreground)] truncate max-w-[120px]">{t.threatInfo?.threatName || "Unknown"}</p>
                            <p className="text-[var(--muted)] truncate max-w-[120px]">{t.agentRealtimeInfo?.agentComputerName || "—"}</p>
                          </td>
                          <td className="px-3 py-2 border-b border-[var(--card-border)]">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${isGreen ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" : isRed ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" : "bg-[var(--muted-bg)] text-[var(--muted)]"}`}>
                              {status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div key="agents" className="bg-[var(--card-bg)] rounded-2xl border border-[var(--card-border)] shadow-sm flex flex-col overflow-hidden">
            <div className="drag-handle cursor-grab active:cursor-grabbing bg-[var(--muted-bg)] border-b border-[var(--card-border)] px-4 py-3 flex items-center justify-between flex-shrink-0 select-none">

              {/* LEFT SIDE */}
              <div>
                <p className="text-xs text-[var(--muted)] font-medium">SentinelOne</p>
                <p className="text-sm font-bold text-[var(--foreground)]">Agent Status</p>
              </div>

              {/* RIGHT SIDE (COUNTS) */}
              <div className="flex gap-2">
                <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">
                  {activeCount} Active
                </span>

                <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
                  {inactiveCount} Inactive
                </span>
              </div>

            </div>

            <div className="flex-1 min-h-0 overflow-auto">
              {agentInfoLoading ? (
                <LoadingSpinner />
              ) : agentInfoError ? (
                <ErrorMsg msg={agentInfoError} />
              ) : agentInfoData.length === 0 ? (
                <EmptyMsg msg="No agent info found" />
              ) : (
                <table className="w-full text-sm border-collapse">
                  <thead className="sticky top-0 z-10 bg-[var(--muted-bg)]">
                    <tr>
                      <th className="text-left px-4 py-3 font-semibold text-[var(--muted)] border border-[var(--card-border)]">
                        Computer Name
                      </th>
                      <th className="text-left px-4 py-3 font-semibold text-[var(--muted)] border border-[var(--card-border)]">
                        Active
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {agentInfoData.map((agent, index) => (
                      <tr key={agent.id || index} className={index % 2 === 0 ? "bg-[var(--card-bg)]" : "bg-[var(--muted-bg)]"}>
                        <td className="px-4 py-3 text-[var(--muted)] border border-[var(--card-border)] whitespace-nowrap">
                          {agent.computerName || "—"}
                        </td>

                        <td className="px-4 py-3 border border-[var(--card-border)] whitespace-nowrap">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${agent.isActive
                              ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                              : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                              }`}
                          >
                            {agent.isActive ? "true" : "false"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>


          <div
            key="firewall-section"
            className="flex items-center gap-4 px-2 py-1 bg-transparent"
          >
            <h2 className="text-lg font-bold text-[var(--foreground)] whitespace-nowrap">
              Firewall
            </h2>
            <div className="h-px flex-1 bg-[var(--card-border)]" />
          </div>
          {/* ── Widget 4: Firewall Report Table ── */}
          <div key="firewall" className="bg-[var(--card-bg)] rounded-2xl border border-[var(--card-border)] shadow-sm flex flex-col overflow-hidden">
            <div className="drag-handle cursor-grab active:cursor-grabbing bg-[var(--muted-bg)] border-b border-[var(--card-border)] px-4 py-3 flex-shrink-0 select-none" aria-label="Firewall Report widget">
              <p className="text-xs text-[var(--muted)] font-medium mb-1">Palo Alto Firewall</p>
              <select
                value={state.firewallReport}
                onChange={e => { e.stopPropagation(); updateState({ firewallReport: e.target.value }); }}
                onClick={e => e.stopPropagation()}
                className="w-full border border-[var(--input-border)] rounded-lg px-3 py-2 text-sm text-[var(--foreground)] bg-[var(--input-bg)] focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {FIREWALL_REPORTS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              {fwUpdated && <p className="text-xs text-[var(--muted)] mt-1">Updated: {new Date(fwUpdated).toLocaleString()}</p>}
            </div>
            <div className="flex-1 min-h-0 overflow-auto">
              {fwLoading ? <LoadingSpinner /> : fwError ? (
                <div className="flex flex-col items-center justify-center h-full py-12 text-center px-4">
                  <p className="text-sm text-red-500 font-medium">{fwError}</p>
                  <p className="text-xs text-[var(--muted)] mt-1">Click &quot;Collect Firewall Data&quot; first</p>
                </div>
              ) : !fwRaw ? (
                <div className="flex flex-col items-center justify-center h-full py-12 text-center px-4">
                  <p className="text-sm text-[var(--muted)]">No data yet</p>
                  <p className="text-xs text-[var(--muted)] mt-1">Click &quot;Collect Firewall Data&quot; to fetch</p>
                </div>
              ) : fwTable && fwTable.rows.length > 0 ? (
                <table className="w-full text-sm border-collapse">
                  <thead className="sticky top-0 z-10">
                    <tr>
                      {fwTable.columns.map(col => (
                        <th key={col} scope="col" className="text-left px-4 py-3 font-semibold text-[var(--muted)] border border-[var(--card-border)] bg-[var(--muted-bg)] whitespace-nowrap">{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {fwTable.rows.map((row, ri) => (
                      <tr key={ri} className={ri % 2 === 0 ? "bg-[var(--card-bg)]" : "bg-[var(--muted-bg)]"}>
                        {fwTable.columns.map(col => (
                          <td key={col} className="px-4 py-3 text-[var(--muted)] border border-[var(--card-border)] whitespace-nowrap">{formatCell(col, row[col])}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-4">
                  <p className="text-xs text-amber-600 mb-2 font-medium">⚠ Could not parse table — showing raw data</p>
                  <pre className="text-xs text-[var(--muted)] bg-[var(--muted-bg)] rounded-xl p-3 overflow-auto whitespace-pre-wrap max-h-80">{JSON.stringify(fwRaw, null, 2)}</pre>
                </div>
              )}
            </div>
          </div>

          {/* ── Widget 5: Firewall Threat Trend ── */}
          {/* ── Widget 5: Firewall Threat Trend ── */}
          <div key="fwthreat" className="bg-[var(--card-bg)] rounded-2xl border border-[var(--card-border)] shadow-sm flex flex-col overflow-hidden">
            <div className="drag-handle cursor-grab active:cursor-grabbing bg-[var(--muted-bg)] border-b border-[var(--card-border)] px-4 py-3 flex-shrink-0 select-none" aria-label="Firewall Threat Trend widget">
              <p className="text-xs text-[var(--muted)] font-medium">Palo Alto Firewall</p>
              <p className="text-sm font-bold text-[var(--foreground)]">Risk Trend</p>
            </div>

            <div className="w-full h-full flex flex-col">
              {/* TOP: Nsess line chart */}
              <div className="flex-[3] min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={fwTrendData} margin={{ top: 10, right: 25, left: 5, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />

                    <XAxis dataKey="time" hide />

                    <YAxis
                      yAxisId="nbytes"
                      orientation="right"
                      tick={{ fontSize: 11, fill: "var(--muted)" }}
                      tickFormatter={(v) => Number(v).toLocaleString()}
                      allowDecimals={false}
                    />

                    <Tooltip
                      contentStyle={{
                        background: "var(--card-bg)",
                        border: "1px solid var(--card-border)",
                        borderRadius: 8,
                      }}
                      labelFormatter={(label) => `Time: ${formatChartDateTime(label)}`}
                      formatter={(value, name, item: any) => {
                        const payload = item?.payload;

                        if (name === "Nbytes") {
                          return [payload?.nbytesText ?? formatBytes(Number(value)), "Nbytes"];
                        }

                        return [String(value ?? ""), String(name ?? "")];
                      }}
                    />

                    <Line
                      yAxisId="nbytes"
                      type="monotone"
                      dataKey="nbytesBytes"
                      name="Nbytes"
                      stroke="#ef4444"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* BOTTOM: Nbytes histogram */}
              <div className="flex-[1.4] min-h-0 border-t border-[var(--card-border)] pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={fwTrendData} margin={{ top: 5, right: 25, left: 5, bottom: 35 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />

                    <XAxis
                      dataKey="time"
                      tick={{ fontSize: 11, fill: "var(--muted)" }}
                      tickFormatter={(value) => formatChartDateTime(value)}
                      angle={-20}
                      textAnchor="end"
                      height={45}
                    />

                    <YAxis
                      yAxisId="nsess"
                      orientation="right"
                      tick={{ fontSize: 11, fill: "var(--muted)" }}
                      tickFormatter={(v) => formatBytesShort(Number(v))}
                    />

                    <Tooltip
                      contentStyle={{
                        background: "var(--card-bg)",
                        border: "1px solid var(--card-border)",
                        borderRadius: 8,
                      }}
                      labelFormatter={(label) => `Time: ${formatChartDateTime(label)}`}
                      formatter={(value, name, item: any) => {
                        const payload = item?.payload;

                        if (name === "Nsess") {
                          return [payload?.nsessText ?? String(value), "Nsess"];
                        }

                        return [String(value ?? ""), String(name ?? "")];
                      }}
                    />

                    <Bar
                      yAxisId="nsess"
                      dataKey="nsessValue"
                      name="Nsess"
                      barSize={35}
                      fill="#6366f1"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </ResponsiveGridLayout>
      </div>
    </div>
  );
}

// ─── Helper components ────────────────────────────────────────────────────────
function formatBytes(bytes: number): string {
  if (!bytes || isNaN(bytes)) return "0";

  if (bytes >= 1e12) return (bytes / 1e12).toFixed(2) + " TB";
  if (bytes >= 1e9) return (bytes / 1e9).toFixed(2) + " GB";
  if (bytes >= 1e6) return (bytes / 1e6).toFixed(2) + " MB";
  if (bytes >= 1e3) return (bytes / 1e3).toFixed(2) + " KB";

  return bytes + " B";
}
function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center h-full py-12">
      <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
    </div>
  );
}
function ErrorMsg({ msg }: { msg: string }) {
  return (
    <div className="flex items-center justify-center h-full py-12 text-center px-4">
      <p className="text-sm text-red-500 font-medium">{msg}</p>
    </div>
  );
}
function EmptyMsg({ msg }: { msg: string }) {
  return (
    <div className="flex items-center justify-center h-full py-12">
      <p className="text-sm text-[var(--muted)]">{msg}</p>
    </div>
  );
}

// ─── Validate saved state ─────────────────────────────────────────────────────
function isValidState(v: any): v is PageState {
  return v && typeof v === "object" && Array.isArray(v.boxes) && v.boxes.length > 0 && v.boxes.every((b: any) => b.i && typeof b.x === "number");
}

// ─── Extract table from Palo Alto XML→JSON ────────────────────────────────────
interface TableData { columns: string[]; rows: Record<string, any>[]; }

function extractTable(raw: any): TableData | null {
  if (!raw) return null;
  try {
    const entry: any[] | undefined =
      toArr(raw?.report?.result?.entry) ??
      toArr(raw?.report?.result?.report?.entry) ??
      toArr(raw?.response?.result?.report?.entry) ??
      toArr(raw?.response?.result?.entry) ??
      toArr(raw?.result?.report?.entry) ??
      toArr(raw?.result?.entry) ??
      toArr(raw?.entry);

    if (entry && entry.length > 0) {
      const colSet = new Set<string>();
      entry.forEach(e => {
        if (typeof e === "object" && e !== null) {
          Object.keys(e).forEach(k => {
            if (k === "@name") colSet.add("name");
            else if (!k.startsWith("@")) colSet.add(k);
          });
        }
      });
      if (colSet.size === 0) return null;
      const columns = Array.from(colSet);
      const rows = entry.map(e => {
        const row: Record<string, any> = {};
        columns.forEach(col => {
          const rk = col === "name" ? "@name" : col;
          const v = e?.[rk] ?? e?.[col];
          row[col] = typeof v === "object" && v !== null && "#text" in v ? v["#text"] : v ?? "";
        });
        return row;
      });
      return { columns, rows };
    }
    const result = raw?.report?.result ?? raw?.response?.result ?? raw?.result;
    if (result && typeof result === "object") {
      const keys = Object.keys(result).filter(k => !k.startsWith("@") && typeof result[k] !== "object");
      if (keys.length > 0) return { columns: keys, rows: [Object.fromEntries(keys.map(k => [k, result[k]]))] };
    }
  } catch { }
  return null;
}

function toArr(v: any): any[] | undefined {
  if (Array.isArray(v) && v.length > 0) return v;
  if (v && typeof v === "object" && !Array.isArray(v)) return [v];
  return undefined;
}

// ─── Extract trend data for line chart ───────────────────────────────────────
function extractTrendData(raw: any): { name: string; value: number }[] {
  try {
    const entry = toArr(raw?.report?.result?.entry) ?? toArr(raw?.result?.entry) ?? toArr(raw?.entry);
    if (!entry) return [];
    return entry.slice(0, 20).map((e: any, i: number) => ({
      name: e?.["@name"] || e?.name || String(i + 1),
      value: Number(e?.count || e?.value || e?.threats || 0),
    })).filter(d => d.value > 0);
  } catch { return []; }
}

function parseBytesToMB(value: any): number {
  if (value === null || value === undefined || value === "") return 0;

  const str = String(value).replace(/,/g, "").trim().toLowerCase();
  const num = parseFloat(str);

  if (Number.isNaN(num)) return 0;

  if (str.includes("tb")) return num * 1024 * 1024;
  if (str.includes("gb")) return num * 1024;
  if (str.includes("mb")) return num;
  if (str.includes("kb")) return num / 1024;
  if (str.includes("b")) return num / (1024 * 1024);

  return num / (1024 * 1024);
}

function buildRiskTrendData(rows: Record<string, any>[]) {
  return rows
    .map((row, index) => {
      const rawTime =
        row["slabbed-receive_time"] ||
        row["slabbed-receive-time"] ||
        row["receive_time"] ||
        row["receive-time"] ||
        row["time"];

      const date = parsePaloAltoDate(rawTime);
      const nbytesBytes = parseBytesToBytes(row["nbytes"]);
      const nsessValue = getNumberOnly(row["nsess"]);

      return {
        time: date ? date.getTime() : index,
        nbytesBytes,
        nbytesText: formatBytes(nbytesBytes),
        nsessValue,
        nsessText: String(row["nsess"] ?? ""),
        risk: row["risk"],
      };
    })
    .sort((a, b) => Number(a.time) - Number(b.time));
}
function getNumberOnly(value: any): number {
  if (value === null || value === undefined || value === "") return 0;

  const num = Number(String(value).replace(/,/g, "").replace(/[^\d.]/g, ""));
  return Number.isNaN(num) ? 0 : num;
}

function parsePaloAltoDate(value: any): Date | null {
  if (!value) return null;

  const str = String(value).trim();

  const match = str.match(
    /^(\d{2})\/(\d{2})\/(\d{4}),?\s+(\d{2}):(\d{2}):(\d{2})$/
  );

  if (match) {
    const [, dd, mm, yyyy, hh, min, ss] = match;
    return new Date(
      Number(yyyy),
      Number(mm) - 1,
      Number(dd),
      Number(hh),
      Number(min),
      Number(ss)
    );
  }

  const num = Number(str);
  if (!Number.isNaN(num)) {
    return new Date(num > 9999999999 ? num : num * 1000);
  }

  const d = new Date(str);
  return Number.isNaN(d.getTime()) ? null : d;
}
function parseBytesToBytes(value: any): number {
  if (value === null || value === undefined || value === "") return 0;

  const str = String(value).replace(/,/g, "").trim().toLowerCase();
  const num = parseFloat(str);

  if (Number.isNaN(num)) return 0;

  if (str.includes("tb")) return num * 1e12;
  if (str.includes("gb")) return num * 1e9;
  if (str.includes("mb")) return num * 1e6;
  if (str.includes("kb")) return num * 1e3;
  if (str.includes("b")) return num;

  return num;
}



function formatBytesShort(bytes: number): string {
  if (!bytes || Number.isNaN(bytes)) return "0";

  if (bytes >= 1e12) return `${(bytes / 1e12).toFixed(1)}T`;
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)}G`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)}M`;
  if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(1)}K`;

  return String(bytes);
}
function formatChartDateTime(value: any): string {
  const d = parsePaloAltoDate(value);
  if (!d) return String(value ?? "");

  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}
function parseChartDate(value: any): Date | null {
  if (!value) return null;

  const num = Number(value);

  if (!isNaN(num)) {
    return new Date(num * 1000);
  }

  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

// function formatChartDateTime(value: any): string {
//   const d = parseChartDate(value);
//   if (!d) return String(value ?? "");

//   return d.toLocaleString("en-US", {
//     month: "short",
//     day: "numeric",
//     hour: "2-digit",
//     minute: "2-digit",
//     hour12: true,
//   });
// }
// ─── Format cell values ───────────────────────────────────────────────────────
function formatCell(col: string, val: any): string {
  if (val === null || val === undefined || val === "") return "—";
  const str = String(val);
  if (col.includes("time") || col.includes("date")) {
    const ts = Number(val);
    if (!isNaN(ts) && ts > 1_000_000_000) return new Date(ts * 1000).toLocaleString();
    if (str.includes("T") || (str.includes("-") && str.length >= 10)) {
      const d = new Date(str);
      if (!isNaN(d.getTime())) return d.toLocaleString();
    }
    return str;
  }
  if (col === "nbytes" || col.includes("byte")) {
    const n = Number(val);
    if (!isNaN(n)) {
      if (n >= 1e12) return (n / 1e12).toFixed(2) + " TB";
      if (n >= 1e9) return (n / 1e9).toFixed(2) + " GB";
      if (n >= 1e6) return (n / 1e6).toFixed(2) + " MB";
      if (n >= 1e3) return (n / 1e3).toFixed(2) + " KB";
      return n + " B";
    }
  }
  const n = Number(val);
  if (!isNaN(n) && str === String(n) && n > 999) return n.toLocaleString();
  return str;
}

function formatChartTime(value: any): string {
  if (!value) return "";

  const num = Number(value);

  const d = !isNaN(num)
    ? new Date(num * 1000) // 🔥 FIX: backend gives seconds
    : new Date(value);

  if (!isNaN(d.getTime())) {
    return d.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return String(value);
}
function normalizeBoxes(savedBoxes: BoxLayout[] = []): BoxLayout[] {
  return DEFAULT_STATE.boxes.map((defaultBox) => {
    const savedBox = savedBoxes.find((box) => box.i === defaultBox.i);
    return savedBox ? { ...defaultBox, ...savedBox } : defaultBox;
  });
}
