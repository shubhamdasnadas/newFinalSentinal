"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import {
  PieChart, Pie, Cell, BarChart, Bar, LineChart, Line, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import FirewallGraphWidget from "./FirewallGraphWidget";

// ─── Constants ────────────────────────────────────────────────────────────────
const FIREWALL_REPORTS = [
  "bandwidth-trend", "blocked-credential-post", "risk-trend", "risky-users",
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

const CHART_COLORS = ["#3b82f6", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#6366f1"];

// ─── Types ────────────────────────────────────────────────────────────────────
interface PageState {
  mitigationChart: "donut" | "probability" | "bar";
  firewallReport: string;
}

const DEFAULT_STATE: PageState = {
  mitigationChart: "donut",
  firewallReport: "bandwidth-trend",
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function SecurityDashboard() {
  const { activeOrgSlug } = useAuth();

  // ── State ──────────────────────────────────────────────────────────────────
  const [state, setState] = useState<PageState>(DEFAULT_STATE);
  const [stateLoaded, setStateLoaded] = useState(false);

  // ── SentinelOne ─────────────────────────────────────────────────────────────
  const [s1Data, setS1Data] = useState<any[]>([]);
  const [s1Loading, setS1Loading] = useState(true);
  const [s1Error, setS1Error] = useState("");
  const [agentInfoData, setAgentInfoData] = useState<any[]>([]);
  const [agentInfoLoading, setAgentInfoLoading] = useState(false);
  const [agentInfoError, setAgentInfoError] = useState("");

  // ── Firewall report preview ─────────────────────────────────────────────────
  const [fwRaw, setFwRaw] = useState<any>(null);
  const [fwLoading, setFwLoading] = useState(false);
  const [fwError, setFwError] = useState("");
  const [collecting, setCollecting] = useState(false);
  const [collectMsg, setCollectMsg] = useState<{ text: string; ok: boolean } | null>(null);

  // ── Firewall widget builder ─────────────────────────────────────────────────
  const [selectedReport, setSelectedReport] = useState("risk-trend");
  const [selectedXAxis, setSelectedXAxis] = useState<string[]>([]);
  const [selectedYAxis, setSelectedYAxis] = useState<string[]>([]);
  const [selectedChartType, setSelectedChartType] = useState<"bar" | "line" | "mixed">("bar");
  const [showXDrop, setShowXDrop] = useState(false);
  const [showYDrop, setShowYDrop] = useState(false);

  // ── Saved widgets (from DB) ─────────────────────────────────────────────────
  const [firewallWidgets, setFirewallWidgets] = useState<any[]>([]);

  // ── ALL useEffects BEFORE any early return ──────────────────────────────────

  // Load persisted options (no layout needed)
  useEffect(() => {
    if (!activeOrgSlug) { setStateLoaded(true); return; }
    fetch("/api/dashboard/layout", { credentials: "include" })
      .then(r => r.json())
      .then(d => {
        setState(prev => ({ ...prev, ...(d.layout?.secopts || {}) }));
      })
      .catch(() => { })
      .finally(() => setStateLoaded(true));
  }, [activeOrgSlug]);

  // Load saved firewall widgets
  useEffect(() => {
    if (!activeOrgSlug) return;
    fetch("/api/firewall/widgets", { credentials: "include" })
      .then(r => r.json())
      .then(d => setFirewallWidgets(Array.isArray(d.widgets) ? d.widgets : []))
      .catch(() => setFirewallWidgets([]));
  }, [activeOrgSlug]);

  // Load SentinelOne threats
  useEffect(() => {
    if (!activeOrgSlug) return;
    setS1Loading(true);
    fetch("/api/sentinelone/threats", { credentials: "include" })
      .then(async r => { const j = await r.json(); if (!r.ok || (j.message && !j.data)) setS1Error(j.message || "Failed"); else setS1Data(j.data || []); })
      .catch(e => setS1Error(e.message))
      .finally(() => setS1Loading(false));
  }, [activeOrgSlug]);

  // Load agent info
  useEffect(() => {
    if (!activeOrgSlug) return;
    setAgentInfoLoading(true);
    fetch("/api/sentinelone/sentinalone_agentinfo", { credentials: "include" })
      .then(async r => { const j = await r.json(); if (!r.ok) { setAgentInfoError(j.message || "Failed"); return; } setAgentInfoData(Array.isArray(j.data) ? j.data : []); })
      .catch(e => setAgentInfoError(e.message || "Network error"))
      .finally(() => setAgentInfoLoading(false));
  }, [activeOrgSlug]);

  // Load firewall report data for preview
  useEffect(() => {
    if (!activeOrgSlug || !selectedReport) return;
    setFwLoading(true); setFwError(""); setFwRaw(null);
    fetch(`/api/firewall/reports/${selectedReport}`, { credentials: "include" })
      .then(r => r.json())
      .then(d => { if (d.message && d.data === undefined) setFwError(d.message); else setFwRaw(d.data ?? null); })
      .catch(() => setFwError("Network error"))
      .finally(() => setFwLoading(false));
  }, [activeOrgSlug, selectedReport]);

  // Auto-select axes when report data loads
  useEffect(() => {
    const table = fwRaw ? extractTable(fwRaw) : null;
    if (!table?.columns?.length) return;
    const cols = table.columns;
    const numCol = cols.find(c => table.rows.some(r => getNum(r[c]) > 0)) || cols[1] || cols[0];
    setSelectedXAxis(prev => prev.length ? prev : [cols[0]]);
    setSelectedYAxis(prev => prev.length ? prev : [numCol]);
  }, [fwRaw]);

  // ── Persist chart option changes ────────────────────────────────────────────
  const updateState = useCallback((patch: Partial<PageState>) => {
    setState(prev => {
      const next = { ...prev, ...patch };
      fetch("/api/dashboard/layout", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ layout: { secopts: { mitigationChart: next.mitigationChart, firewallReport: next.firewallReport } } }),
      }).catch(() => { });
      return next;
    });
  }, []);

  // ── Early returns (AFTER all hooks) ────────────────────────────────────────
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

  // ── Derived data ────────────────────────────────────────────────────────────
  const fwTable = fwRaw ? extractTable(fwRaw) : null;
  const fwColumns = fwTable?.columns ?? [];
  const fwTrendData = selectedReport === "risk-trend" && fwTable?.rows?.length ? buildRiskTrendData(fwTable.rows) : [];

  const mitigationCounts: Record<string, number> = {};
  s1Data.forEach(t => { const s = t.threatInfo?.mitigationStatus || "unknown"; mitigationCounts[s] = (mitigationCounts[s] || 0) + 1; });
  const mitigationData = Object.entries(mitigationCounts).map(([name, value], i) => ({ name, value, fill: CHART_COLORS[i % CHART_COLORS.length] }));
  const mitigationTotal = mitigationData.reduce((s, d) => s + d.value, 0);

  const severityCounts: Record<string, number> = {};
  s1Data.forEach(t => { const s = t.threatInfo?.confidenceLevel || "unknown"; severityCounts[s] = (severityCounts[s] || 0) + 1; });
  const severityData = Object.entries(severityCounts).map(([name, value], i) => ({ name, value, fill: CHART_COLORS[i % CHART_COLORS.length] }));

  const recentThreats = [...s1Data]
    .sort((a, b) => new Date(b.threatInfo?.createdAt || 0).getTime() - new Date(a.threatInfo?.createdAt || 0).getTime())
    .slice(0, 10);

  const activeCount = agentInfoData.filter(a => a.isActive).length;
  const inactiveCount = agentInfoData.filter(a => !a.isActive).length;

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleCollect = async () => {
    setCollecting(true); setCollectMsg(null);
    try {
      const res = await fetch("/api/firewall/collect", { method: "POST", credentials: "include" });
      const d = await res.json();
      setCollectMsg({ text: d.message || "Done", ok: res.ok });
      if (res.ok) {
        setFwLoading(true);
        fetch(`/api/firewall/reports/${selectedReport}`, { credentials: "include" })
          .then(r => r.json()).then(d => setFwRaw(d.data ?? null)).finally(() => setFwLoading(false));
      }
    } catch { setCollectMsg({ text: "Collection failed", ok: false }); }
    finally { setCollecting(false); }
  };

  const handleAddWidget = async () => {
    if (!selectedXAxis.length || !selectedYAxis.length) return;
    const res = await fetch("/api/firewall/widgets", {
      method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify({ reportName: selectedReport, xAxis: selectedXAxis, yAxis: selectedYAxis, chartType: selectedYAxis.length > 1 ? "mixed" : selectedChartType }),
    });
    const d = await res.json();
    if (res.ok && d.widget) setFirewallWidgets(prev => [...prev, d.widget]);
  };

  const handleDeleteWidget = async (id: string) => {
    const res = await fetch(`/api/firewall/widgets/${id}`, { method: "DELETE", credentials: "include" });
    if (res.ok) setFirewallWidgets(prev => prev.filter(w => w.id !== id));
  };

  const toggleAxis = (col: string, list: string[], setter: React.Dispatch<React.SetStateAction<string[]>>) =>
    setter(prev => prev.includes(col) ? prev.filter(v => v !== col) : [...prev, col]);

  const tooltipStyle = { background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 8 };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="p-3 sm:p-5 lg:p-6">
      {/* ── Page header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--foreground)]">Security Dashboard</h1>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <button onClick={handleCollect} disabled={collecting}
            className="inline-flex items-center gap-2 bg-indigo-600 text-white px-3 sm:px-4 py-2 rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors whitespace-nowrap">
            {collecting
              ? <><div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /><span className="hidden sm:inline">Collecting…</span></>
              : <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg><span className="hidden sm:inline">Collect Firewall Data</span><span className="sm:hidden">Collect</span></>}
          </button>
        </div>
      </div>

      {collectMsg && (
        <div className={`mb-4 px-4 py-3 rounded-xl text-sm border ${collectMsg.ok ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300" : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300"}`}>
          {collectMsg.text}
        </div>
      )}

      {/* ── Dashboard Grid ── */}
      <div className="flex flex-col gap-4">

        {/* ══ ROW 1: Mitigation | Severity | Recent Threats | Agent Status ══ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">

          {/* ── Mitigation Status ── */}
          <div className="bg-[var(--card-bg)] rounded-2xl border border-[var(--card-border)] shadow-sm flex flex-col" style={{ height: "380px" }}>
            <div className="bg-[var(--muted-bg)] border-b border-[var(--card-border)] px-4 py-3 flex items-center justify-between flex-shrink-0 rounded-t-2xl">
              <div>
                <p className="text-xs text-[var(--muted)] font-medium">SentinelOne</p>
                <p className="text-sm font-bold text-[var(--foreground)]">Mitigation Status</p>
              </div>
              <div className="flex gap-1">
                {(["donut", "probability", "bar"] as const).map(ct => (
                  <button key={ct} onClick={() => updateState({ mitigationChart: ct })}
                    className={`px-2 py-1 rounded-lg text-[10px] font-medium transition-colors ${state.mitigationChart === ct ? "bg-indigo-600 text-white" : "bg-[var(--card-bg)] border border-[var(--card-border)] text-[var(--muted)] hover:bg-[var(--muted-bg)]"}`}>
                    {ct === "donut" ? "Donut" : ct === "probability" ? "%" : "Bar"}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-auto p-4 relative">
              {s1Loading ? <Spin /> : s1Error ? <Err msg={s1Error} /> : mitigationData.length === 0 ? <Empty msg="No mitigation data" /> :
                state.mitigationChart === "bar" ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={mitigationData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--muted)" }} angle={-20} textAnchor="end" />
                      <YAxis tick={{ fontSize: 11, fill: "var(--muted)" }} allowDecimals={false} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>{mitigationData.map((d, i) => <Cell key={i} fill={d.fill} />)}</Bar>
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
                        <div className="w-full bg-[var(--muted-bg)] rounded-full h-2.5">
                          <div className="h-2.5 rounded-full" style={{ width: mitigationTotal > 0 ? `${(d.value / mitigationTotal) * 100}%` : "0%", backgroundColor: d.fill }} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="relative h-full flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={mitigationData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius="45%" outerRadius="65%" paddingAngle={2}>
                          {mitigationData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                        </Pie>
                        <Tooltip contentStyle={tooltipStyle} />
                        <Legend iconSize={10} wrapperStyle={{ fontSize: 11, color: "var(--muted)" }} />
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

          {/* ── Threat Severity ── */}
          <div className="bg-[var(--card-bg)] rounded-2xl border border-[var(--card-border)] shadow-sm flex flex-col" style={{ height: "380px" }}>
            <div className="bg-[var(--muted-bg)] border-b border-[var(--card-border)] px-4 py-3 flex-shrink-0 rounded-t-2xl">
              <p className="text-xs text-[var(--muted)] font-medium">SentinelOne</p>
              <p className="text-sm font-bold text-[var(--foreground)]">Threat Severity</p>
            </div>
            <div className="flex-1 min-h-0 overflow-auto p-4">
              {s1Loading ? <Spin /> : s1Error ? <Err msg={s1Error} /> : severityData.length === 0 ? <Empty msg="No severity data" /> : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={severityData} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: "var(--muted)" }} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "var(--muted)" }} width={70} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>{severityData.map((d, i) => <Cell key={i} fill={d.fill} />)}</Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* ── Recent Threats ── */}
          <div className="bg-[var(--card-bg)] rounded-2xl border border-[var(--card-border)] shadow-sm flex flex-col" style={{ height: "380px" }}>
            <div className="bg-[var(--muted-bg)] border-b border-[var(--card-border)] px-4 py-3 flex-shrink-0 rounded-t-2xl">
              <p className="text-xs text-[var(--muted)] font-medium">SentinelOne</p>
              <p className="text-sm font-bold text-[var(--foreground)]">Recent Threats</p>
            </div>
            <div className="flex-1 min-h-0 overflow-auto">
              {s1Loading ? <Spin /> : s1Error ? <Err msg={s1Error} /> : recentThreats.length === 0 ? <Empty msg="No threats found" /> : (
                <table className="w-full text-xs">
                  <thead className="sticky top-0 z-10 bg-[var(--muted-bg)]">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold text-[var(--muted)] border-b border-[var(--card-border)]">Threat</th>
                      <th className="text-left px-3 py-2 font-semibold text-[var(--muted)] border-b border-[var(--card-border)]">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentThreats.map((t, i) => {
                      const status = t.threatInfo?.mitigationStatus || "unknown";
                      const cls = status === "mitigated" ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                        : status === "active" ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                          : "bg-[var(--muted-bg)] text-[var(--muted)]";
                      return (
                        <tr key={i} className={i % 2 === 0 ? "bg-[var(--card-bg)]" : "bg-[var(--muted-bg)]"}>
                          <td className="px-3 py-2 border-b border-[var(--card-border)]">
                            <p className="font-medium text-[var(--foreground)] truncate max-w-[110px]">{t.threatInfo?.threatName || "Unknown"}</p>
                            <p className="text-[var(--muted)] truncate max-w-[110px]">{t.agentRealtimeInfo?.agentComputerName || "—"}</p>
                          </td>
                          <td className="px-3 py-2 border-b border-[var(--card-border)]">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${cls}`}>{status}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* ── Agent Status ── */}
          <div className="bg-[var(--card-bg)] rounded-2xl border border-[var(--card-border)] shadow-sm flex flex-col" style={{ height: "380px" }}>
            <div className="bg-[var(--muted-bg)] border-b border-[var(--card-border)] px-4 py-3 flex items-center justify-between flex-shrink-0 rounded-t-2xl">
              <div>
                <p className="text-xs text-[var(--muted)] font-medium">SentinelOne</p>
                <p className="text-sm font-bold text-[var(--foreground)]">Agent Status</p>
              </div>
              <div className="flex gap-1.5">
                <span className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">{activeCount} Active</span>
                <span className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">{inactiveCount} Inactive</span>
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-auto">
              {agentInfoLoading ? <Spin /> : agentInfoError ? <Err msg={agentInfoError} /> : agentInfoData.length === 0 ? <Empty msg="No agent info found" /> : (
                <table className="w-full text-sm border-collapse">
                  <thead className="sticky top-0 z-10 bg-[var(--muted-bg)]">
                    <tr>
                      <th className="text-left px-4 py-2.5 font-semibold text-[var(--muted)] border border-[var(--card-border)] text-xs">Computer</th>
                      <th className="text-left px-4 py-2.5 font-semibold text-[var(--muted)] border border-[var(--card-border)] text-xs">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agentInfoData.map((a, i) => (
                      <tr key={a.id || i} className={i % 2 === 0 ? "bg-[var(--card-bg)]" : "bg-[var(--muted-bg)]"}>
                        <td className="px-4 py-2.5 text-[var(--muted)] border border-[var(--card-border)] whitespace-nowrap text-xs">{a.computerName || "—"}</td>
                        <td className="px-4 py-2.5 border border-[var(--card-border)] whitespace-nowrap">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${a.isActive ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"}`}>
                            {a.isActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

        </div>
        {/* ══ END ROW 1 ══ */}

        {/* ══ ROW 2: Firewall Report Explorer | Risk Trend ══ */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">

          {/* ── Firewall Report Explorer (7/12) ── */}
          <div className="xl:col-span-7 bg-[var(--card-bg)] rounded-2xl border border-[var(--card-border)] shadow-sm flex flex-col" style={{ height: "460px" }}>

            {/* Header */}
            <div className="flex-shrink-0 rounded-t-2xl overflow-hidden">
              {/* Title row */}
              <div className="flex items-center justify-between px-4 pt-3 pb-2">0.
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-indigo-500 dark:text-indigo-400 uppercase tracking-widest">Palo Alto Firewall</p>
                    <p className="text-sm font-bold text-[var(--foreground)] leading-tight">Report Explorer</p>
                  </div>
                </div>
                {fwRaw && !fwLoading && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />Live
                  </span>
                )}
              </div>

              <div className="h-px bg-[var(--card-border)]" />

              {/* Controls toolbar */}
              <div className="px-4 py-2.5 bg-[var(--muted-bg)] flex flex-wrap items-end gap-2">

                {/* Report */}
                <div className="flex flex-col gap-0.5">
                  <label className="text-[9px] font-bold text-[var(--muted)] uppercase tracking-wider">Report</label>
                  <select value={selectedReport}
                    onChange={e => { setSelectedReport(e.target.value); setSelectedXAxis([]); setSelectedYAxis([]); }}
                    className="h-8 border border-[var(--input-border)] rounded-lg px-2.5 text-xs font-medium text-[var(--foreground)] bg-[var(--card-bg)] min-w-[155px] focus:outline-none focus:ring-2 focus:ring-indigo-400">
                    {FIREWALL_REPORTS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>

                <div className="w-px h-8 bg-[var(--card-border)]" />

                {/* X-Axis */}
                <div className="flex flex-col gap-0.5 relative">
                  <label className="text-[9px] font-bold text-[var(--muted)] uppercase tracking-wider">X-Axis</label>
                  <button type="button" onClick={() => { setShowXDrop(p => !p); setShowYDrop(false); }}
                    className={`h-8 border rounded-lg px-2.5 text-xs font-medium flex items-center gap-1.5 min-w-[110px] focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-colors ${selectedXAxis.length ? "border-blue-400 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-600" : "border-[var(--input-border)] bg-[var(--card-bg)] text-[var(--muted)]"}`}>
                    <span className="truncate flex-1 text-left">{selectedXAxis.length === 0 ? "X-Axis" : selectedXAxis.length === 1 ? selectedXAxis[0] : `${selectedXAxis.length} selected`}</span>
                    <svg className="w-3 h-3 flex-shrink-0 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </button>
                  {showXDrop && (
                    <div className="absolute z-50 top-full mt-1 left-0 w-48 border border-[var(--card-border)] rounded-xl bg-[var(--card-bg)] shadow-2xl overflow-hidden">
                      <div className="px-3 py-2 bg-[var(--muted-bg)] border-b border-[var(--card-border)] flex items-center justify-between">
                        <span className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider">X-Axis</span>
                        {selectedXAxis.length > 0 && <button onClick={() => setSelectedXAxis([])} className="text-[10px] text-red-500 hover:text-red-700 font-medium">Clear</button>}
                      </div>
                      <div className="max-h-48 overflow-auto p-1.5">
                        {fwColumns.length === 0 ? <p className="text-xs text-[var(--muted)] px-3 py-2">No columns</p>
                          : fwColumns.map(col => (
                            <label key={col} className="flex items-center gap-2.5 px-2.5 py-2 text-xs text-[var(--foreground)] cursor-pointer hover:bg-[var(--muted-bg)] rounded-lg transition-colors">
                              <input type="checkbox" checked={selectedXAxis.includes(col)} onChange={() => toggleAxis(col, selectedXAxis, setSelectedXAxis)} className="w-3.5 h-3.5 accent-indigo-500" />
                              <span className="truncate font-medium">{col}</span>
                            </label>
                          ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Y-Axis */}
                <div className="flex flex-col gap-0.5 relative">
                  <label className="text-[9px] font-bold text-[var(--muted)] uppercase tracking-wider">Y-Axis</label>
                  <button type="button" onClick={() => { setShowYDrop(p => !p); setShowXDrop(false); }}
                    className={`h-8 border rounded-lg px-2.5 text-xs font-medium flex items-center gap-1.5 min-w-[110px] focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-colors ${selectedYAxis.length ? "border-emerald-400 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-600" : "border-[var(--input-border)] bg-[var(--card-bg)] text-[var(--muted)]"}`}>
                    <span className="truncate flex-1 text-left">{selectedYAxis.length === 0 ? "Y-Axis" : selectedYAxis.length === 1 ? selectedYAxis[0] : `${selectedYAxis.length} selected`}</span>
                    <svg className="w-3 h-3 flex-shrink-0 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </button>
                  {showYDrop && (
                    <div className="absolute z-50 top-full mt-1 left-0 w-48 border border-[var(--card-border)] rounded-xl bg-[var(--card-bg)] shadow-2xl overflow-hidden">
                      <div className="px-3 py-2 bg-[var(--muted-bg)] border-b border-[var(--card-border)] flex items-center justify-between">
                        <span className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider">Y-Axis</span>
                        {selectedYAxis.length > 0 && <button onClick={() => setSelectedYAxis([])} className="text-[10px] text-red-500 hover:text-red-700 font-medium">Clear</button>}
                      </div>
                      <div className="max-h-48 overflow-auto p-1.5">
                        {fwColumns.length === 0 ? <p className="text-xs text-[var(--muted)] px-3 py-2">No columns</p>
                          : fwColumns.map(col => (
                            <label key={col} className="flex items-center gap-2.5 px-2.5 py-2 text-xs text-[var(--foreground)] cursor-pointer hover:bg-[var(--muted-bg)] rounded-lg transition-colors">
                              <input type="checkbox" checked={selectedYAxis.includes(col)} onChange={() => toggleAxis(col, selectedYAxis, setSelectedYAxis)} className="w-3.5 h-3.5 accent-indigo-500" />
                              <span className="truncate font-medium">{col}</span>
                            </label>
                          ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Chart type */}
                <div className="flex flex-col gap-0.5">
                  <label className="text-[9px] font-bold text-[var(--muted)] uppercase tracking-wider">Chart</label>
                  <div className="flex h-8 rounded-lg border border-[var(--input-border)] overflow-hidden bg-[var(--card-bg)]">
                    {(["bar", "line", "mixed"] as const).map(ct => (
                      <button key={ct} type="button" onClick={() => setSelectedChartType(ct)}
                        disabled={selectedYAxis.length > 1}
                        className={`px-2.5 text-[10px] font-semibold transition-colors border-r last:border-r-0 border-[var(--input-border)] disabled:opacity-40 ${(selectedYAxis.length > 1 ? "mixed" : selectedChartType) === ct ? "bg-indigo-600 text-white" : "text-[var(--muted)] hover:bg-[var(--muted-bg)]"}`}>
                        {ct === "bar" ? "Bar" : ct === "line" ? "Line" : "Mix"}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex-1" />

                {/* Add Widget */}
                <div className="flex flex-col gap-0.5">
                  <label className="text-[9px] font-bold text-transparent uppercase tracking-wider select-none">·</label>
                  <button onClick={() => handleAddWidget()}
                    disabled={!selectedXAxis.length || !selectedYAxis.length}
                    className="h-8 inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 dark:disabled:bg-indigo-900 text-white px-4 rounded-lg text-xs font-semibold transition-colors shadow-sm disabled:cursor-not-allowed">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                    Add
                  </button>
                </div>
              </div>

              {/* Selection pills */}
              {(selectedXAxis.length > 0 || selectedYAxis.length > 0) && (
                <div className="px-4 py-2 flex flex-wrap gap-1.5 border-t border-[var(--card-border)] bg-[var(--card-bg)]">
                  {selectedXAxis.map(x => (
                    <span key={x} className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-700">
                      <span className="opacity-60 mr-0.5">X</span>{x}
                      <button onClick={() => setSelectedXAxis(p => p.filter(v => v !== x))} className="w-3.5 h-3.5 rounded-full hover:bg-blue-200 flex items-center justify-center ml-0.5">×</button>
                    </span>
                  ))}
                  {selectedYAxis.map(y => (
                    <span key={y} className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700">
                      <span className="opacity-60 mr-0.5">Y</span>{y}
                      <button onClick={() => setSelectedYAxis(p => p.filter(v => v !== y))} className="w-3.5 h-3.5 rounded-full hover:bg-emerald-200 flex items-center justify-center ml-0.5">×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Body — scrollable */}
            <div className="flex-1 min-h-0 overflow-auto">
              {fwLoading ? <Spin /> : fwError ? (
                <div className="flex flex-col items-center justify-center h-full py-10 text-center px-6">
                  <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-3">
                    <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <p className="text-sm font-semibold text-red-500">{fwError}</p>
                  <p className="text-xs text-[var(--muted)] mt-1">Click &quot;Collect Firewall Data&quot; to fetch</p>
                </div>
              ) : !fwRaw ? (
                <div className="flex flex-col items-center justify-center h-full py-10 text-center px-6">
                  <div className="w-10 h-10 rounded-full bg-[var(--muted-bg)] flex items-center justify-center mb-3">
                    <svg className="w-5 h-5 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  </div>
                  <p className="text-sm font-semibold text-[var(--foreground)]">No data yet</p>
                  <p className="text-xs text-[var(--muted)] mt-1">Click &quot;Collect Firewall Data&quot; to fetch</p>
                </div>
              ) : selectedXAxis.length > 0 && selectedYAxis.length > 0 ? (
                <PreviewChart rows={fwTable?.rows ?? []} xList={selectedXAxis} yList={selectedYAxis} chartType={selectedYAxis.length > 1 ? "mixed" : selectedChartType} />
              ) : fwTable && fwTable.rows.length > 0 ? (
                <table className="w-full text-sm border-collapse">
                  <thead className="sticky top-0 z-10">
                    <tr>{fwTable.columns.map(col => <th key={col} className="text-left px-4 py-3 font-semibold text-[var(--muted)] border border-[var(--card-border)] bg-[var(--muted-bg)] whitespace-nowrap text-xs">{col}</th>)}</tr>
                  </thead>
                  <tbody>
                    {fwTable.rows.map((row, ri) => (
                      <tr key={ri} className={ri % 2 === 0 ? "bg-[var(--card-bg)]" : "bg-[var(--muted-bg)]"}>
                        {fwTable.columns.map(col => <td key={col} className="px-4 py-2.5 text-[var(--muted)] border border-[var(--card-border)] whitespace-nowrap text-xs">{fmtCell(col, row[col])}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-4">
                  <p className="text-xs text-amber-600 mb-2 font-medium">Could not parse table — raw data</p>
                  <pre className="text-xs text-[var(--muted)] bg-[var(--muted-bg)] rounded-xl p-3 overflow-auto whitespace-pre-wrap max-h-72">{JSON.stringify(fwRaw, null, 2)}</pre>
                </div>
              )}
            </div>
          </div>

          {/* ── Risk Trend (5/12) ── */}
          <div className="xl:col-span-5 bg-[var(--card-bg)] rounded-2xl border border-[var(--card-border)] shadow-sm flex flex-col" style={{ height: "460px" }}>
            <div className="bg-[var(--muted-bg)] border-b border-[var(--card-border)] px-4 py-3 flex-shrink-0 rounded-t-2xl">
              <p className="text-xs text-[var(--muted)] font-medium">Palo Alto Firewall</p>
              <p className="text-sm font-bold text-[var(--foreground)]">Risk Trend</p>
            </div>
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              <div className="flex-[3] min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={fwTrendData} margin={{ top: 10, right: 25, left: 5, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
                    <XAxis dataKey="time" hide />
                    <YAxis yAxisId="nb" orientation="right" tick={{ fontSize: 11, fill: "var(--muted)" }} tickFormatter={v => fmtBytesShort(Number(v))} />
                    <Tooltip contentStyle={tooltipStyle} labelFormatter={l => `Time: ${fmtDateTime(l)}`} formatter={(v, n, item: any) => n === "Nbytes" ? [item?.payload?.nbytesText ?? fmtBytes(Number(v)), "Nbytes"] : [String(v), String(n)]} />
                    <Line yAxisId="nb" type="monotone" dataKey="nbytesBytes" name="Nbytes" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-[1.4] min-h-0 border-t border-[var(--card-border)] pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={fwTrendData} margin={{ top: 5, right: 25, left: 5, bottom: 35 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
                    <XAxis dataKey="time" tick={{ fontSize: 11, fill: "var(--muted)" }} tickFormatter={v => fmtDateTime(v)} angle={-20} textAnchor="end" height={45} />
                    <YAxis yAxisId="ns" orientation="right" tick={{ fontSize: 11, fill: "var(--muted)" }} tickFormatter={v => fmtBytesShort(Number(v))} />
                    <Tooltip contentStyle={tooltipStyle} labelFormatter={l => `Time: ${fmtDateTime(l)}`} formatter={(v, n, item: any) => n === "Nsess" ? [item?.payload?.nsessText ?? String(v), "Nsess"] : [String(v), String(n)]} />
                    <Bar yAxisId="ns" dataKey="nsessValue" name="Nsess" barSize={35} fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

        </div>
        {/* ══ END ROW 2 ══ */}

        {/* ── Dynamic saved firewall widgets ── */}
        {firewallWidgets.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {firewallWidgets.map(widget => (
              <div key={widget.id} className="bg-[var(--card-bg)] rounded-2xl border border-[var(--card-border)] shadow-sm overflow-hidden" style={{ minHeight: "330px" }}>
                <FirewallGraphWidget widget={widget} onDelete={handleDeleteWidget} />
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}

// ─── Helper UI components ─────────────────────────────────────────────────────
function Spin() {
  return <div className="flex items-center justify-center h-full py-12"><div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full" /></div>;
}
function Err({ msg }: { msg: string }) {
  return <div className="flex items-center justify-center h-full py-12 text-center px-4"><p className="text-sm text-red-500 font-medium">{msg}</p></div>;
}
function Empty({ msg }: { msg: string }) {
  return <div className="flex items-center justify-center h-full py-12"><p className="text-sm text-[var(--muted)]">{msg}</p></div>;
}

// ─── PreviewChart — live dynamic chart inside the firewall widget ─────────────
const PCOLS = ["#6366f1", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6", "#06b6d4"];

function parseN(v: any): number {
  if (v == null || v === "") return 0;
  const s = String(v).replace(/,/g, "").trim().toLowerCase();
  const n = parseFloat(s);
  if (isNaN(n)) return 0;
  if (s.includes("tb")) return n * 1e12;
  if (s.includes("gb")) return n * 1e9;
  if (s.includes("mb")) return n * 1e6;
  if (s.includes("kb")) return n * 1e3;
  return n;
}

function fmtLbl(v: any): string {
  const s = String(v ?? "");
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4}),?\s+(\d{2}):(\d{2}):(\d{2})$/);
  if (m) { const [, dd, mm, yyyy, hh, min] = m; return new Date(+yyyy, +mm - 1, +dd, +hh, +min).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }); }
  return s.length > 18 ? s.slice(0, 18) + "…" : s;
}

function PreviewChart({ rows, xList, yList, chartType }: { rows: Record<string, any>[]; xList: string[]; yList: string[]; chartType: "bar" | "line" | "mixed" }) {
  const ts = { background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 8 };
  const data = rows.slice(0, 30).map((row, i) => {
    const label = xList.length ? xList.map(x => row[x]).filter(Boolean).join(" | ") : `Item ${i + 1}`;
    const item: Record<string, any> = { label: fmtLbl(label) };
    yList.forEach(y => { item[y] = parseN(row[y]); });
    return item;
  }).filter(item => yList.some(y => Number(item[y]) > 0));

  if (data.length === 0) return <div className="h-full flex items-center justify-center text-center px-4 py-12"><p className="text-sm text-[var(--muted)]">No numeric data for selected Y-Axis columns</p></div>;

  const isMixed = chartType === "mixed" || yList.length > 1;

  if (isMixed) return (
    <div className="w-full h-full min-h-[200px] p-3">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 35, left: 10, bottom: 50 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--muted)" }} angle={-25} textAnchor="end" height={60} />
          <YAxis yAxisId="left" orientation="left" tick={{ fontSize: 10, fill: "var(--muted)" }} />
          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: "var(--muted)" }} />
          <Tooltip contentStyle={ts} /><Legend wrapperStyle={{ fontSize: 11 }} />
          {yList.map((y, i) => i === 0
            ? <Bar key={y} yAxisId="left" dataKey={y} name={y} fill={PCOLS[i % PCOLS.length]} barSize={24} radius={[4, 4, 0, 0]} />
            : <Line key={y} yAxisId="right" type="monotone" dataKey={y} name={y} stroke={PCOLS[i % PCOLS.length]} strokeWidth={2} dot={{ r: 3 }} />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );

  if (chartType === "line") return (
    <div className="w-full h-full min-h-[200px] p-3">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 50 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--muted)" }} angle={-25} textAnchor="end" height={60} />
          <YAxis tick={{ fontSize: 10, fill: "var(--muted)" }} />
          <Tooltip contentStyle={ts} /><Legend wrapperStyle={{ fontSize: 11 }} />
          {yList.map((y, i) => <Line key={y} type="monotone" dataKey={y} name={y} stroke={PCOLS[i % PCOLS.length]} strokeWidth={2} dot={{ r: 3 }} />)}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );

  return (
    <div className="w-full h-full min-h-[200px] p-3">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 50 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--muted)" }} angle={-25} textAnchor="end" height={60} />
          <YAxis tick={{ fontSize: 10, fill: "var(--muted)" }} />
          <Tooltip contentStyle={ts} /><Legend wrapperStyle={{ fontSize: 11 }} />
          {yList.map((y, i) => <Bar key={y} dataKey={y} name={y} fill={PCOLS[i % PCOLS.length]} radius={[4, 4, 0, 0]} />)}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Utility functions ────────────────────────────────────────────────────────
function getNum(v: any): number {
  if (v == null || v === "") return 0;
  const n = Number(String(v).replace(/,/g, "").replace(/[^\d.]/g, ""));
  return isNaN(n) ? 0 : n;
}

function fmtBytes(b: number): string {
  if (!b || isNaN(b)) return "0";
  if (b >= 1e12) return (b / 1e12).toFixed(2) + " TB";
  if (b >= 1e9) return (b / 1e9).toFixed(2) + " GB";
  if (b >= 1e6) return (b / 1e6).toFixed(2) + " MB";
  if (b >= 1e3) return (b / 1e3).toFixed(2) + " KB";
  return b + " B";
}

function fmtBytesShort(b: number): string {
  if (!b || isNaN(b)) return "0";
  if (b >= 1e12) return `${(b / 1e12).toFixed(1)}T`;
  if (b >= 1e9) return `${(b / 1e9).toFixed(1)}G`;
  if (b >= 1e6) return `${(b / 1e6).toFixed(1)}M`;
  if (b >= 1e3) return `${(b / 1e3).toFixed(1)}K`;
  return String(b);
}

function fmtCell(col: string, val: any): string {
  if (val == null || val === "") return "—";
  const s = String(val);
  if (col.includes("time") || col.includes("date")) {
    const ts = Number(val);
    if (!isNaN(ts) && ts > 1_000_000_000) return new Date(ts * 1000).toLocaleString();
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.toLocaleString();
    return s;
  }
  if (col === "nbytes" || col.includes("byte")) {
    const n = Number(val);
    if (!isNaN(n)) return fmtBytes(n);
  }
  const n = Number(val);
  if (!isNaN(n) && s === String(n) && n > 999) return n.toLocaleString();
  return s;
}

function parsePADate(v: any): Date | null {
  if (!v) return null;
  const s = String(v).trim();
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4}),?\s+(\d{2}):(\d{2}):(\d{2})$/);
  if (m) { const [, dd, mm, yyyy, hh, min, ss] = m; return new Date(+yyyy, +mm - 1, +dd, +hh, +min, +ss); }
  const n = Number(s);
  if (!isNaN(n)) return new Date(n > 9999999999 ? n : n * 1000);
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function fmtDateTime(v: any): string {
  const d = parsePADate(v);
  if (!d) return String(v ?? "");
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: true });
}

function parseBytesToBytes(v: any): number {
  if (v == null || v === "") return 0;
  const s = String(v).replace(/,/g, "").trim().toLowerCase();
  const n = parseFloat(s);
  if (isNaN(n)) return 0;
  if (s.includes("tb")) return n * 1e12;
  if (s.includes("gb")) return n * 1e9;
  if (s.includes("mb")) return n * 1e6;
  if (s.includes("kb")) return n * 1e3;
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
      const rows = entry.map(e => {
        const row: Record<string, any> = {};
        columns.forEach(col => { const rk = col === "name" ? "@name" : col; const v = e?.[rk] ?? e?.[col]; row[col] = typeof v === "object" && v !== null && "#text" in v ? v["#text"] : v ?? ""; });
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
