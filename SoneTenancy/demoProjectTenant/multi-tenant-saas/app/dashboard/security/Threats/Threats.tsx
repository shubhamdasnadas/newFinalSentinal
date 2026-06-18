"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  PieChart, Pie, Cell, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from "recharts";

// ─── Types ─────────────────────────────────────────────────────────────────────
interface ThreatInfoData {
  threatName?: string;
  classification?: string;
  confidenceLevel?: string;
  mitigationStatus?: string;
  incidentStatus?: string;
  isFileless?: boolean;
  analystVerdict?: string;
  processUser?: string;
  createdAt?: string;
  identifiedAt?: string;
  mitigationEndedAt?: string;
}

interface AgentRealtimeInfoData {
  agentComputerName?: string;
  agentInfected?: boolean;
  siteName?: string;
  groupName?: string;
}

interface MitigationStatusItem {
  status?: string;
  action?: string;
  latestReport?: string;
  mitigationEndedAt?: string;
  mitigationStartedAt?: string;
}

interface IndicatorTechnique {
  name?: string;
}

interface IndicatorTactic {
  techniques?: IndicatorTechnique[];
}

interface Indicator {
  tactics?: IndicatorTactic[];
}

interface ThreatRecord {
  threatInfo?: ThreatInfoData;
  agentRealtimeInfo?: AgentRealtimeInfoData;
  mitigationStatus?: MitigationStatusItem[];
  indicators?: Indicator[];
}

// ─── Constants ─────────────────────────────────────────────────────────────────
const CHART_COLORS = [
  "#3b82f6", "#f59e0b", "#10b981", "#ef4444",
  "#8b5cf6", "#06b6d4", "#ec4899", "#6366f1",
];

const TOOLTIP_PROPS = {
  contentStyle: {
    background: "var(--card-bg)",
    border: "1px solid var(--card-border)",
    borderRadius: 8,
    fontSize: 12,
  },
};

// ─── Helpers ───────────────────────────────────────────────────────────────────
function parseDate(v?: string | null): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

function formatDuration(minutes: number): string {
  if (minutes < 1) return "<1m";
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h < 24) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  const d = Math.floor(h / 24);
  const rh = h % 24;
  return rh > 0 ? `${d}d ${rh}h` : `${d}d`;
}

function truncateLabel(label: string, maxLen = 22): string {
  return label.length > maxLen ? label.slice(0, maxLen - 1) + "…" : label;
}

function topN(
  counts: Record<string, number>,
  n: number
): { name: string; value: number }[] {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([name, value]) => ({ name, value }));
}

// ─── Helper Components ─────────────────────────────────────────────────────────
function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center h-full py-12">
      <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
    </div>
  );
}

function EmptyMsg({ msg }: { msg: string }) {
  return (
    <div className="flex items-center justify-center h-full py-8">
      <p className="text-sm text-[var(--muted)]">{msg}</p>
    </div>
  );
}

function KpiCard({
  title,
  value,
  subtitle,
  accent,
}: {
  title: string;
  value: string | number;
  subtitle: string;
  accent: string;
}) {
  return (
    <div className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-5 shadow-sm flex flex-col gap-1">
      <p className="text-xs font-medium text-[var(--muted)] uppercase tracking-wide">{title}</p>
      <p className="text-3xl font-bold" style={{ color: accent }}>
        {value}
      </p>
      <p className="text-xs text-[var(--muted)]">{subtitle}</p>
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  controls,
  children,
  height = 300,
}: {
  title: string;
  subtitle?: string;
  controls?: React.ReactNode;
  children: React.ReactNode;
  height?: number;
}) {
  return (
    <section className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-5 shadow-sm flex flex-col gap-3">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-[var(--foreground)]">{title}</h2>
          {subtitle && (
            <p className="text-xs text-[var(--muted)] mt-0.5">{subtitle}</p>
          )}
        </div>
        {controls && <div className="flex-shrink-0">{controls}</div>}
      </div>
      <div style={{ height }}>{children}</div>
    </section>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export const Threats = () => {
  const [threats, setThreats] = useState<ThreatRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [trendFrom, setTrendFrom] = useState("");
  const [trendTo, setTrendTo] = useState("");

  useEffect(() => {
    setLoading(true);
    fetch("/api/sentinelone/db/threats", {
      method: "GET",
      credentials: "include",
    })
      .then(async (res) => {
        const response = await res.json();
        setThreats(response?.data ?? []);
      })
      .catch((err) => {
        console.error(err);
      })
      .finally(() => setLoading(false));
  }, []);

  // ── KPI aggregations ──────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const total = threats.length;
    const mitigated = threats.filter(
      (t) => t.threatInfo?.mitigationStatus === "mitigated"
    ).length;
    const unresolved = threats.filter(
      (t) => t.threatInfo?.incidentStatus === "unresolved"
    ).length;
    const fileless = threats.filter((t) => t.threatInfo?.isFileless).length;

    let mttdSum = 0, mttdCount = 0;
    let mttmSum = 0, mttmCount = 0;

    for (const t of threats) {
      const created = parseDate(t.threatInfo?.createdAt);
      const identified = parseDate(t.threatInfo?.identifiedAt);

      if (created && identified && created > identified) {
        mttdSum += (created.getTime() - identified.getTime()) / 60000;
        mttdCount++;
      }

      const mitigationEndedAt =
        t.mitigationStatus?.find((m) => m.status === "success")?.mitigationEndedAt;
      const ended = parseDate(mitigationEndedAt);

      if (identified && ended && ended > identified) {
        mttmSum += (ended.getTime() - identified.getTime()) / 60000;
        mttmCount++;
      }
    }

    return {
      total,
      mitigated,
      unresolved,
      fileless,
      avgMttd: mttdCount > 0 ? mttdSum / mttdCount : null,
      avgMttm: mttmCount > 0 ? mttmSum / mttmCount : null,
    };
  }, [threats]);

  // ── Widget 1: Threat trend over time ─────────────────────────────────────────
  const threatTrend = useMemo(() => {
    const dayCounts: Record<string, number> = {};
    for (const t of threats) {
      const d = parseDate(t.threatInfo?.createdAt);
      if (!d) continue;
      const key = d.toISOString().slice(0, 10);
      dayCounts[key] = (dayCounts[key] || 0) + 1;
    }
    return Object.entries(dayCounts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));
  }, [threats]);

  const trendDateBounds = useMemo(() => {
    if (threatTrend.length === 0) return { min: "", max: "" };
    return { min: threatTrend[0].date, max: threatTrend[threatTrend.length - 1].date };
  }, [threatTrend]);

  const filteredThreatTrend = useMemo(() => {
    if (!trendFrom && !trendTo) return threatTrend;
    return threatTrend.filter(({ date }) => {
      if (trendFrom && date < trendFrom) return false;
      if (trendTo && date > trendTo) return false;
      return true;
    });
  }, [threatTrend, trendFrom, trendTo]);

  // ── Widget 2: Top affected endpoints ─────────────────────────────────────────
  const topEndpoints = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of threats) {
      const name = t.agentRealtimeInfo?.agentComputerName?.trim();
      if (!name) continue;
      counts[name] = (counts[name] || 0) + 1;
    }
    return topN(counts, 10).map((d) => ({
      ...d,
      label: truncateLabel(d.name, 24),
    }));
  }, [threats]);

  // ── Widget 3: MITRE ATT&CK techniques ────────────────────────────────────────
  const mitreData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of threats) {
      for (const ind of t.indicators ?? []) {
        for (const tactic of ind.tactics ?? []) {
          for (const tech of tactic.techniques ?? []) {
            const name = tech.name?.trim();
            if (!name) continue;
            counts[name] = (counts[name] || 0) + 1;
          }
        }
      }
    }
    return topN(counts, 10).map((d) => ({
      ...d,
      label: truncateLabel(d.name, 30),
    }));
  }, [threats]);

  // ── Widget 4: Threat classification ──────────────────────────────────────────
  const classificationData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of threats) {
      const cls = t.threatInfo?.classification?.trim() || "Unknown";
      counts[cls] = (counts[cls] || 0) + 1;
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value], i) => ({
        name,
        value,
        fill: CHART_COLORS[i % CHART_COLORS.length],
      }));
  }, [threats]);

  // ── Widget 5: Fileless vs File-based ─────────────────────────────────────────
  const filelessData = useMemo(() => {
    const fileless = threats.filter((t) => t.threatInfo?.isFileless).length;
    const fileBased = threats.length - fileless;
    return [
      { name: "Fileless", value: fileless, fill: "#ef4444" },
      { name: "File-based", value: fileBased, fill: "#3b82f6" },
    ].filter((d) => d.value > 0);
  }, [threats]);

  // ── Widget 6: Mitigation success rate ────────────────────────────────────────
  const mitigationRateData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of threats) {
      for (const m of t.mitigationStatus ?? []) {
        const s = m.status?.trim() || "unknown";
        counts[s] = (counts[s] || 0) + 1;
      }
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value], i) => ({
        name,
        value,
        fill: CHART_COLORS[i % CHART_COLORS.length],
      }));
  }, [threats]);

  // ── Widget 7: Top users generating alerts ────────────────────────────────────
  const topUsersData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of threats) {
      const user = t.threatInfo?.processUser?.trim();
      if (!user) continue;
      counts[user] = (counts[user] || 0) + 1;
    }
    return topN(counts, 10).map((d) => ({
      ...d,
      label: truncateLabel(d.name, 24),
    }));
  }, [threats]);

  // ── Widget 8: MTTD trend ──────────────────────────────────────────────────────
  const mttdTrend = useMemo(() => {
    const dayData: Record<string, { sum: number; count: number }> = {};
    for (const t of threats) {
      const created = parseDate(t.threatInfo?.createdAt);
      console.log(created)
      const identified = parseDate(t.threatInfo?.identifiedAt);
      console.log(identified)
      if (!created || !identified || created <= identified) continue;
      const key = created.toISOString().slice(0, 10);
      const minutes = (created.getTime() - identified.getTime()) / 60000;
      if (!dayData[key]) dayData[key] = { sum: 0, count: 0 };
      dayData[key].sum += minutes;
      dayData[key].count++;
    }
    return Object.entries(dayData)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, { sum, count }]) => ({
        date,
        avgMttd: Math.round(sum / count),
      }));
  }, [threats]);

  // ── Widget 8: MTTM trend ──────────────────────────────────────────────────────
  const mttmTrend = useMemo(() => {
    const dayData: Record<string, { sum: number; count: number }> = {};
    for (const t of threats) {
      const identified = parseDate(t.threatInfo?.identifiedAt);
      const mitigationEndedAt =
        t.mitigationStatus?.find((m) => m.status === "success")?.mitigationEndedAt;
      const ended = parseDate(mitigationEndedAt);
      if (!identified || !ended || ended <= identified) continue;
      const key = identified.toISOString().slice(0, 10);
      const minutes = (ended.getTime() - identified.getTime()) / 60000;
      if (!dayData[key]) dayData[key] = { sum: 0, count: 0 };
      dayData[key].sum += minutes;
      dayData[key].count++;
    }
    return Object.entries(dayData)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, { sum, count }]) => ({
        date,
        avgMttm: Math.round(sum / count),
      }));
  }, [threats]);

  // ── Widget 9: Threats by site ─────────────────────────────────────────────────
  const bySiteData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of threats) {
      const site = t.agentRealtimeInfo?.siteName?.trim() || "Unknown";
      counts[site] = (counts[site] || 0) + 1;
    }
    return topN(counts, 10).map((d) => ({
      ...d,
      label: truncateLabel(d.name, 24),
    }));
  }, [threats]);

  // ── Widget 9b: Threats by group ───────────────────────────────────────────────
  const byGroupData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of threats) {
      const group = t.agentRealtimeInfo?.groupName?.trim() || "Unknown";
      counts[group] = (counts[group] || 0) + 1;
    }
    return topN(counts, 10).map((d) => ({
      ...d,
      label: truncateLabel(d.name, 24),
    }));
  }, [threats]);

  // ── Widget 10: Severity / confidence distribution ─────────────────────────────
  const severityData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of threats) {
      const level =
        t.threatInfo?.confidenceLevel?.trim() ||
        t.threatInfo?.classification?.trim() ||
        "Unknown";
      counts[level] = (counts[level] || 0) + 1;
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value], i) => ({
        name,
        value,
        fill: CHART_COLORS[i % CHART_COLORS.length],
      }));
  }, [threats]);

  // ─── Render ────────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-[var(--foreground)] mb-6">
          Threat Analytics Dashboard
        </h1>
        <LoadingSpinner />
      </div>
    );
  }

  if (threats.length === 0) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-[var(--foreground)] mb-6">
          Threat Analytics Dashboard
        </h1>
        <div className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-12 text-center shadow-sm">
          <p className="text-sm text-[var(--muted)]">No threat data available.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--foreground)]">
          Threat Analytics Dashboard
        </h1>
        <p className="text-sm text-[var(--muted)] mt-0.5">
          {kpis.total.toLocaleString()} threats · SOC security analytics
        </p>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard
          title="Total Threats"
          value={kpis.total.toLocaleString()}
          subtitle="All detections"
          accent="#3b82f6"
        />
        <KpiCard
          title="Mitigated"
          value={kpis.mitigated.toLocaleString()}
          subtitle="Successfully resolved"
          accent="#10b981"
        />
        <KpiCard
          title="Unresolved"
          value={kpis.unresolved.toLocaleString()}
          subtitle="Require attention"
          accent="#ef4444"
        />
        <KpiCard
          title="Fileless Threats"
          value={kpis.fileless.toLocaleString()}
          subtitle="Memory-based attacks"
          accent="#f59e0b"
        />
        {<KpiCard
          title="Avg. MTTD"
          value={kpis.avgMttd !== null ? formatDuration(kpis.avgMttd) : "—"}
          subtitle="Mean time to detect"
          accent="#8b5cf6"
        />}
        <KpiCard
          title="Avg. MTTM"
          value={kpis.avgMttm !== null ? formatDuration(kpis.avgMttm) : "—"}
          subtitle="Mean time to mitigate"
          accent="#06b6d4"
        />
      </div>

      {/* ── Widget 1: Threat Trend Over Time ── */}
      <ChartCard
        title="Threat Trend Over Time"
        subtitle="Daily detection count — spot spikes and historical patterns"
        height={260}
        controls={
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
              From
              <input
                type="date"
                value={trendFrom}
                min={trendDateBounds.min}
                max={trendTo || trendDateBounds.max}
                onChange={(e) => setTrendFrom(e.target.value)}
                className="h-8 rounded-md border border-[var(--card-border)] bg-[var(--muted-bg)] px-2 text-xs text-[var(--foreground)] outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </label>
            <label className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
              To
              <input
                type="date"
                value={trendTo}
                min={trendFrom || trendDateBounds.min}
                max={trendDateBounds.max}
                onChange={(e) => setTrendTo(e.target.value)}
                className="h-8 rounded-md border border-[var(--card-border)] bg-[var(--muted-bg)] px-2 text-xs text-[var(--foreground)] outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </label>
            {(trendFrom || trendTo) && (
              <button
                type="button"
                onClick={() => { setTrendFrom(""); setTrendTo(""); }}
                className="h-8 px-2.5 rounded-md border border-[var(--card-border)] text-xs text-[var(--muted)] hover:bg-[var(--muted-bg)] transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        }
      >
        {filteredThreatTrend.length === 0 ? (
          <EmptyMsg msg={threatTrend.length === 0 ? "No time-series data available" : "No data in selected range"} />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={filteredThreatTrend}
              margin={{ top: 8, right: 20, left: 0, bottom: 40 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: "var(--muted)" }}
                angle={-30}
                textAnchor="end"
                height={50}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "var(--muted)" }}
                allowDecimals={false}
              />
              <Tooltip {...TOOLTIP_PROPS} />
              <Legend wrapperStyle={{ fontSize: 12, color: "var(--muted)" }} />
              <Line
                type="monotone"
                dataKey="count"
                name="Threats"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* ── Widget 2 & 3: Endpoints + MITRE ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard
          title="Top Affected Endpoints"
          subtitle="Endpoints with the highest number of detections (top 10)"
          height={340}
        >
          {topEndpoints.length === 0 ? (
            <EmptyMsg msg="No endpoint data available" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={topEndpoints}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--card-border)"
                  horizontal={false}
                />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: "var(--muted)" }}
                  allowDecimals={false}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "var(--muted)" }}
                  width={150}
                />
                <Tooltip
                  {...TOOLTIP_PROPS}
                  formatter={(v, _name, item) => [v, item?.payload?.name ?? _name]}
                />
                <Bar dataKey="value" name="Threats" radius={[0, 4, 4, 0]}>
                  {topEndpoints.map((_d, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard
          title="MITRE ATT&CK Techniques"
          subtitle="Most frequently detected techniques across all indicators (top 10)"
          height={340}
        >
          {mitreData.length === 0 ? (
            <EmptyMsg msg="No MITRE technique data available" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={mitreData}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--card-border)"
                  horizontal={false}
                />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: "var(--muted)" }}
                  allowDecimals={false}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "var(--muted)" }}
                  width={170}
                />
                <Tooltip
                  {...TOOLTIP_PROPS}
                  formatter={(v, _name, item) => [v, item?.payload?.name ?? _name]}
                />
                <Bar dataKey="value" name="Count" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* ── Widgets 4, 5, 6: Donut row ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <ChartCard
          title="Threat Classification"
          subtitle="Distribution by classification type"
          height={270}
        >
          {classificationData.length === 0 ? (
            <EmptyMsg msg="No classification data" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={classificationData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="42%"
                  innerRadius="38%"
                  outerRadius="62%"
                  paddingAngle={2}
                >
                  {classificationData.map((d, i) => (
                    <Cell key={i} fill={d.fill} />
                  ))}
                </Pie>
                <Tooltip {...TOOLTIP_PROPS} />
                <Legend
                  iconSize={10}
                  wrapperStyle={{ fontSize: 11, color: "var(--muted)" }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard
          title="Fileless vs File-based"
          subtitle="Attack vector distribution"
          height={270}
        >
          {filelessData.length === 0 ? (
            <EmptyMsg msg="No fileless data" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={filelessData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="42%"
                  innerRadius="38%"
                  outerRadius="62%"
                  paddingAngle={3}
                >
                  {filelessData.map((d, i) => (
                    <Cell key={i} fill={d.fill} />
                  ))}
                </Pie>
                <Tooltip {...TOOLTIP_PROPS} />
                <Legend
                  iconSize={10}
                  wrapperStyle={{ fontSize: 11, color: "var(--muted)" }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard
          title="Mitigation Outcomes"
          subtitle="Proportions of mitigation action results"
          height={270}
        >
          {mitigationRateData.length === 0 ? (
            <EmptyMsg msg="No mitigation action data" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={mitigationRateData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="42%"
                  innerRadius="38%"
                  outerRadius="62%"
                  paddingAngle={2}
                >
                  {mitigationRateData.map((d, i) => (
                    <Cell key={i} fill={d.fill} />
                  ))}
                </Pie>
                <Tooltip {...TOOLTIP_PROPS} />
                <Legend
                  iconSize={10}
                  wrapperStyle={{ fontSize: 11, color: "var(--muted)" }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* ── Widget 7 + Widget 10: Top Users + Severity ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard
          title="Top Users Generating Alerts"
          subtitle="By process user — top 10"
          height={320}
        >
          {topUsersData.length === 0 ? (
            <EmptyMsg msg="No process user data available" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={topUsersData}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--card-border)"
                  horizontal={false}
                />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: "var(--muted)" }}
                  allowDecimals={false}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "var(--muted)" }}
                  width={150}
                />
                <Tooltip
                  {...TOOLTIP_PROPS}
                  formatter={(v, _name, item) => [v, item?.payload?.name ?? _name]}
                />
                <Bar dataKey="value" name="Alerts" fill="#f59e0b" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard
          title="Threat Severity Distribution"
          subtitle="By confidence level (falls back to classification)"
          height={320}
        >
          {severityData.length === 0 ? (
            <EmptyMsg msg="No severity data available" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={severityData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="42%"
                  innerRadius="34%"
                  outerRadius="60%"
                  paddingAngle={2}
                >
                  {severityData.map((d, i) => (
                    <Cell key={i} fill={d.fill} />
                  ))}
                </Pie>
                <Tooltip {...TOOLTIP_PROPS} />
                <Legend
                  iconSize={10}
                  wrapperStyle={{ fontSize: 11, color: "var(--muted)" }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* ── Widget 8: MTTD & MTTM Trends ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard
          title="Mean Time To Detect (MTTD) Trend"
          subtitle="Daily average detection latency in minutes"
          height={240}
        >
          {mttdTrend.length === 0 ? (
            <EmptyMsg msg="Insufficient MTTD data" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={mttdTrend}
                margin={{ top: 8, right: 20, left: 0, bottom: 40 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "var(--muted)" }}
                  angle={-30}
                  textAnchor="end"
                  height={50}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "var(--muted)" }}
                  allowDecimals={false}
                  tickFormatter={(v) => `${v}m`}
                />
                <Tooltip
                  {...TOOLTIP_PROPS}
                  formatter={(v) => [`${v}m`, "Avg MTTD"]}
                />
                <Line
                  type="monotone"
                  dataKey="avgMttd"
                  name="Avg MTTD (min)"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard
          title="Mean Time To Mitigate (MTTM) Trend"
          subtitle="Daily average mitigation latency in minutes"
          height={240}
        >
          {mttmTrend.length === 0 ? (
            <EmptyMsg msg="Insufficient MTTM data" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={mttmTrend}
                margin={{ top: 8, right: 20, left: 0, bottom: 40 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "var(--muted)" }}
                  angle={-30}
                  textAnchor="end"
                  height={50}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "var(--muted)" }}
                  allowDecimals={false}
                  tickFormatter={(v) => `${v}m`}
                />
                <Tooltip
                  {...TOOLTIP_PROPS}
                  formatter={(v) => [`${v}m`, "Avg MTTM"]}
                />
                <Line
                  type="monotone"
                  dataKey="avgMttm"
                  name="Avg MTTM (min)"
                  stroke="#06b6d4"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* ── Widget 9: Threats by Site & Group ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard
          title="Threats by Site"
          subtitle="Top sites ranked by threat count"
          height={320}
        >
          {bySiteData.length === 0 ? (
            <EmptyMsg msg="No site data available" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={bySiteData}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--card-border)"
                  horizontal={false}
                />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: "var(--muted)" }}
                  allowDecimals={false}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "var(--muted)" }}
                  width={150}
                />
                <Tooltip
                  {...TOOLTIP_PROPS}
                  formatter={(v, _name, item) => [v, item?.payload?.name ?? _name]}
                />
                <Bar dataKey="value" name="Threats" fill="#06b6d4" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard
          title="Threats by Group"
          subtitle="Top groups ranked by threat count"
          height={320}
        >
          {byGroupData.length === 0 ? (
            <EmptyMsg msg="No group data available" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={byGroupData}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--card-border)"
                  horizontal={false}
                />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: "var(--muted)" }}
                  allowDecimals={false}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "var(--muted)" }}
                  width={150}
                />
                <Tooltip
                  {...TOOLTIP_PROPS}
                  formatter={(v, _name, item) => [v, item?.payload?.name ?? _name]}
                />
                <Bar dataKey="value" name="Threats" fill="#ec4899" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>
    </div>
  );
};
