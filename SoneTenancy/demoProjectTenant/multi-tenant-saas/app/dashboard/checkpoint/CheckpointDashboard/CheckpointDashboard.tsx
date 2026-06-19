"use client";

import { useMemo } from "react";
import type { ReactNode } from "react";
import {
  PieChart, Pie, Cell,
  BarChart, Bar, LabelList,
  LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from "recharts";

export interface HarmonyEvent {
  eventId: string;
  customerId: string;
  type: string;
  state: string;
  severity: string;
  confidenceIndicator: string;
  description: string;
  senderAddress?: string;
  saas?: string;
  entityId?: string;
  entityLink?: string;
  eventCreated: string;
  actions: string[];
  additionalData?: unknown;
  availableEventActions?: unknown;
  data?: string;
}

interface Props {
  events: HarmonyEvent[];
}

const dateFmt = (d: Date) => d.toISOString().slice(0, 10);

const TOOLTIP_STYLE = {
  background: "var(--card-bg)",
  border: "1px solid var(--card-border)",
  borderRadius: 8,
  fontSize: 12,
};

// ── Shared UI ─────────────────────────────────────────────────────────────────
function WidgetCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl overflow-hidden shadow-sm">
      <div className="px-5 py-3.5 border-b border-[var(--card-border)]">
        <p className="text-sm font-semibold text-[var(--foreground)]">{title}</p>
      </div>
      <div className="px-4 py-4">{children}</div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex items-center justify-center h-32 text-sm text-[var(--muted)]">
      No data available
    </div>
  );
}

// ── Widget 1: Severity Distribution Donut ─────────────────────────────────────
const SEV_COLORS = ["#22c55e", "#84cc16", "#f59e0b", "#f97316", "#ef4444"];

function SeverityDonut({ events }: { events: HarmonyEvent[] }) {
  const { data, total } = useMemo(() => {
    const counts: Record<string, number> = {};
    events.forEach((e) => {
      const s = e.severity ?? "?";
      counts[s] = (counts[s] || 0) + 1;
    });
    const data = Object.entries(counts)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([sev, value]) => ({ name: `Sev ${sev}`, value }));
    return { data, total: data.reduce((s, d) => s + d.value, 0) };
  }, [events]);

  if (total === 0) return <WidgetCard title="Severity Distribution"><EmptyState /></WidgetCard>;

  return (
    <WidgetCard title="Severity Distribution">
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={2} dataKey="value">
            {data.map((_, i) => <Cell key={i} fill={SEV_COLORS[i % SEV_COLORS.length]} />)}
          </Pie>
          <Tooltip
            formatter={(v) => { const n = Number(v); return [`${n} (${Math.round((n / total) * 100)}%)`, ""] as [string, string]; }}
            contentStyle={TOOLTIP_STYLE}
          />
          <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
        </PieChart>
      </ResponsiveContainer>
    </WidgetCard>
  );
}

// ── Widget 2: Event State Breakdown Donut ─────────────────────────────────────
const STATE_COLORS: Record<string, string> = {
  new: "#ef4444",
  pending: "#f97316",
  detected: "#f59e0b",
  remediated: "#22c55e",
  closed: "#3b82f6",
  done: "#10b981",
};

function StateDonut({ events }: { events: HarmonyEvent[] }) {
  const { data, total } = useMemo(() => {
    const counts: Record<string, number> = {};
    events.forEach((e) => {
      const s = e.state ?? "unknown";
      counts[s] = (counts[s] || 0) + 1;
    });
    const data = Object.entries(counts).map(([name, value]) => ({ name, value }));
    return { data, total: data.reduce((s, d) => s + d.value, 0) };
  }, [events]);

  if (total === 0) return <WidgetCard title="Event State Breakdown"><EmptyState /></WidgetCard>;

  return (
    <WidgetCard title="Event State Breakdown">
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={2} dataKey="value">
            {data.map((d, i) => <Cell key={i} fill={STATE_COLORS[d.name] ?? "#6366f1"} />)}
          </Pie>
          <Tooltip
            formatter={(v) => { const n = Number(v); return [`${n} (${Math.round((n / total) * 100)}%)`, ""] as [string, string]; }}
            contentStyle={TOOLTIP_STYLE}
          />
          <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
        </PieChart>
      </ResponsiveContainer>
    </WidgetCard>
  );
}

// ── Widget 3: Top Sender Domains ───────────────────────────────────────────────
function TopSenderDomains({ events }: { events: HarmonyEvent[] }) {
  const data = useMemo(() => {
    const counts: Record<string, number> = {};
    events.forEach((e) => {
      if (!e.senderAddress) return;
      const parts = e.senderAddress.split("@");
      if (parts.length < 2) return;
      const domain = parts[parts.length - 1].toLowerCase();
      counts[domain] = (counts[domain] || 0) + 1;
    });
    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));
  }, [events]);

  if (data.length === 0) return <WidgetCard title="Top Sender Domains"><EmptyState /></WidgetCard>;

  return (
    <WidgetCard title="Top Sender Domains">
      <ResponsiveContainer width="100%" height={Math.max(200, data.length * 32 + 40)}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 48, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 10, fill: "var(--muted)" }} tickLine={false} axisLine={false} allowDecimals={false} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "var(--foreground)" }} tickLine={false} axisLine={false} width={110} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Bar dataKey="count" name="Events" fill="#6366f1" radius={[0, 4, 4, 0]}>
            <LabelList dataKey="count" position="right" style={{ fontSize: 10, fill: "var(--muted)" }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </WidgetCard>
  );
}

// ── Widget 4: Top Individual Senders ──────────────────────────────────────────
function TopSenders({ events }: { events: HarmonyEvent[] }) {
  const data = useMemo(() => {
    const counts: Record<string, number> = {};
    events.forEach((e) => {
      if (!e.senderAddress) return;
      const s = e.senderAddress.toLowerCase();
      counts[s] = (counts[s] || 0) + 1;
    });
    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));
  }, [events]);

  if (data.length === 0) return <WidgetCard title="Top Individual Senders"><EmptyState /></WidgetCard>;

  return (
    <WidgetCard title="Top Individual Senders">
      <ResponsiveContainer width="100%" height={Math.max(200, data.length * 32 + 40)}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 48, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 10, fill: "var(--muted)" }} tickLine={false} axisLine={false} allowDecimals={false} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "var(--foreground)" }} tickLine={false} axisLine={false} width={140} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Bar dataKey="count" name="Events" fill="#f97316" radius={[0, 4, 4, 0]}>
            <LabelList dataKey="count" position="right" style={{ fontSize: 10, fill: "var(--muted)" }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </WidgetCard>
  );
}

// ── Widget 5: Confidence Indicator Donut ──────────────────────────────────────
const CONF_COLORS: Record<string, string> = {
  malicious: "#ef4444",
  suspicious: "#f97316",
  detected: "#f59e0b",
  unknown: "#94a3b8",
};

function ConfidenceDonut({ events }: { events: HarmonyEvent[] }) {
  const { data, total } = useMemo(() => {
    const counts: Record<string, number> = {};
    events.forEach((e) => {
      const c = (e.confidenceIndicator ?? "unknown").toLowerCase();
      counts[c] = (counts[c] || 0) + 1;
    });
    const data = Object.entries(counts).map(([name, value]) => ({ name, value }));
    return { data, total: data.reduce((s, d) => s + d.value, 0) };
  }, [events]);

  if (total === 0) return <WidgetCard title="Confidence Indicator"><EmptyState /></WidgetCard>;

  return (
    <WidgetCard title="Confidence Indicator">
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={2} dataKey="value">
            {data.map((d, i) => <Cell key={i} fill={CONF_COLORS[d.name] ?? "#6366f1"} />)}
          </Pie>
          <Tooltip
            formatter={(v) => { const n = Number(v); return [`${n} (${Math.round((n / total) * 100)}%)`, ""] as [string, string]; }}
            contentStyle={TOOLTIP_STYLE}
          />
          <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
        </PieChart>
      </ResponsiveContainer>
    </WidgetCard>
  );
}

// ── Widget 6: Most Targeted Mailboxes ─────────────────────────────────────────
const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;

function TopTargetedMailboxes({ events }: { events: HarmonyEvent[] }) {
  const data = useMemo(() => {
    const counts: Record<string, number> = {};
    events.forEach((e) => {
      const desc = e.description ?? "";
      const matches = desc.match(EMAIL_RE);
      if (!matches) return;
      const sender = (e.senderAddress ?? "").toLowerCase();
      matches.forEach((m) => {
        const lm = m.toLowerCase();
        if (lm !== sender) counts[lm] = (counts[lm] || 0) + 1;
      });
    });
    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));
  }, [events]);

  if (data.length === 0) return <WidgetCard title="Most Targeted Mailboxes"><EmptyState /></WidgetCard>;

  return (
    <WidgetCard title="Most Targeted Mailboxes">
      <ResponsiveContainer width="100%" height={Math.max(200, data.length * 32 + 40)}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 48, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 10, fill: "var(--muted)" }} tickLine={false} axisLine={false} allowDecimals={false} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "var(--foreground)" }} tickLine={false} axisLine={false} width={140} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Bar dataKey="count" name="Events" fill="#8b5cf6" radius={[0, 4, 4, 0]}>
            <LabelList dataKey="count" position="right" style={{ fontSize: 10, fill: "var(--muted)" }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </WidgetCard>
  );
}

// ── Widget 7: Cumulative Events Over Time ─────────────────────────────────────
function CumulativeTimeline({ events }: { events: HarmonyEvent[] }) {
  const data = useMemo(() => {
    const counts: Record<string, number> = {};
    events.forEach((e) => {
      const d = dateFmt(new Date(e.eventCreated));
      counts[d] = (counts[d] || 0) + 1;
    });
    let cumulative = 0;
    return Object.entries(counts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => {
        cumulative += count;
        return { date, cumulative };
      });
  }, [events]);

  if (data.length === 0) return <WidgetCard title="Cumulative Events Over Time"><EmptyState /></WidgetCard>;

  return (
    <WidgetCard title="Cumulative Events Over Time">
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--muted)" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 10, fill: "var(--muted)" }} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [Number(v), "Cumulative"] as [number, string]} />
          <Line type="monotone" dataKey="cumulative" stroke="#6366f1" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    </WidgetCard>
  );
}

// ── Widget 8: Week-over-Week KPI ──────────────────────────────────────────────
function WeekOverWeek({ events }: { events: HarmonyEvent[] }) {
  const stats = useMemo(() => {
    const now = Date.now();
    const DAY = 86_400_000;
    const current = events.filter((e) => now - new Date(e.eventCreated).getTime() < 7 * DAY).length;
    const previous = events.filter((e) => {
      const age = now - new Date(e.eventCreated).getTime();
      return age >= 7 * DAY && age < 14 * DAY;
    }).length;
    const pct = previous === 0 ? null : Math.round(((current - previous) / previous) * 100);
    return { current, previous, pct };
  }, [events]);

  const { current, previous, pct } = stats;
  const up = pct !== null && pct > 0;
  const down = pct !== null && pct < 0;

  return (
    <WidgetCard title="Last 7 Days">
      <div className="flex flex-col items-center justify-center py-5 gap-2">
        <p className="text-5xl font-bold text-[var(--foreground)]">{current}</p>
        <p className="text-xs text-[var(--muted)]">events this week</p>
        {pct === null ? (
          <p className="text-sm text-[var(--muted)] mt-1">No prior-week data</p>
        ) : (
          <div className="text-center mt-1">
            <p className={`text-2xl font-semibold ${up ? "text-red-500" : down ? "text-green-500" : "text-[var(--muted)]"}`}>
              {up ? "▲ +" : down ? "▼ " : ""}{pct}%
            </p>
            <p className="text-xs text-[var(--muted)]">vs previous week ({previous} events)</p>
          </div>
        )}
      </div>
    </WidgetCard>
  );
}

// ── Widget 9: Average Severity KPI ────────────────────────────────────────────
function AvgSeverity({ events }: { events: HarmonyEvent[] }) {
  const avg = useMemo(() => {
    const valid = events.filter((e) => e.severity !== "" && !isNaN(Number(e.severity)));
    if (valid.length === 0) return null;
    return (valid.reduce((s, e) => s + Number(e.severity), 0) / valid.length).toFixed(1);
  }, [events]);

  return (
    <WidgetCard title="Average Severity">
      <div className="flex flex-col items-center justify-center py-5 gap-1">
        <p className="text-5xl font-bold text-amber-500">{avg ?? "—"}</p>
        <p className="text-sm text-[var(--muted)]">out of 5</p>
      </div>
    </WidgetCard>
  );
}

// ── Widget 10: Critical Events KPI ────────────────────────────────────────────
function CriticalEvents({ events }: { events: HarmonyEvent[] }) {
  const count = useMemo(
    () => events.filter((e) => Number(e.severity) >= 4).length,
    [events]
  );

  return (
    <WidgetCard title="Critical Events">
      <div className="flex flex-col items-center justify-center py-5 gap-1">
        <p className="text-5xl font-bold text-red-500">{count}</p>
        <p className="text-sm text-[var(--muted)]">severity ≥ 4</p>
      </div>
    </WidgetCard>
  );
}

// ── Widget 11: SaaS Platform Distribution ─────────────────────────────────────
const SAAS_COLORS = ["#6366f1", "#f97316", "#22c55e", "#ef4444", "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6"];

function SaasPlatformChart({ events }: { events: HarmonyEvent[] }) {
  const data = useMemo(() => {
    const counts: Record<string, number> = {};
    events.forEach((e) => {
      const p = e.saas ?? "Unknown";
      counts[p] = (counts[p] || 0) + 1;
    });
    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .map(([name, count]) => ({ name, count }));
  }, [events]);

  if (data.length === 0) return <WidgetCard title="SaaS Platform Distribution"><EmptyState /></WidgetCard>;

  const total = data.reduce((s, d) => s + d.count, 0);

  if (data.length <= 6) {
    return (
      <WidgetCard title="SaaS Platform Distribution">
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={data} dataKey="count" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={2}>
              {data.map((_, i) => <Cell key={i} fill={SAAS_COLORS[i % SAAS_COLORS.length]} />)}
            </Pie>
            <Tooltip
              formatter={(v) => { const n = Number(v); return [`${n} (${Math.round((n / total) * 100)}%)`, ""] as [string, string]; }}
              contentStyle={TOOLTIP_STYLE}
            />
            <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      </WidgetCard>
    );
  }

  return (
    <WidgetCard title="SaaS Platform Distribution">
      <ResponsiveContainer width="100%" height={Math.max(200, data.length * 32 + 40)}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 48, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 10, fill: "var(--muted)" }} tickLine={false} axisLine={false} allowDecimals={false} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "var(--foreground)" }} tickLine={false} axisLine={false} width={100} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Bar dataKey="count" name="Events" fill="#6366f1" radius={[0, 4, 4, 0]}>
            <LabelList dataKey="count" position="right" style={{ fontSize: 10, fill: "var(--muted)" }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </WidgetCard>
  );
}

// ── Widget 12: Remediation Rate Over Time ─────────────────────────────────────
function RemediationRateChart({ events }: { events: HarmonyEvent[] }) {
  const data = useMemo(() => {
    const byDay: Record<string, { total: number; remediated: number }> = {};
    events.forEach((e) => {
      const d = dateFmt(new Date(e.eventCreated));
      if (!byDay[d]) byDay[d] = { total: 0, remediated: 0 };
      byDay[d].total++;
      if (e.state === "remediated" || e.state === "closed" || e.state === "done") {
        byDay[d].remediated++;
      }
    });
    return Object.entries(byDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, { total, remediated }]) => ({
        date,
        rate: total > 0 ? Math.round((remediated / total) * 100) : 0,
      }));
  }, [events]);

  if (data.length === 0) return <WidgetCard title="Remediation Rate Over Time"><EmptyState /></WidgetCard>;

  return (
    <WidgetCard title="Remediation Rate Over Time">
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--muted)" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
          <YAxis
            tick={{ fontSize: 10, fill: "var(--muted)" }}
            tickLine={false}
            axisLine={false}
            domain={[0, 100]}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(v) => [`${Number(v)}%`, "Remediation Rate"] as [string, string]}
          />
          <Line type="monotone" dataKey="rate" stroke="#22c55e" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    </WidgetCard>
  );
}

// ── Main export ────────────────────────────────────────────────────────────────
export default function CheckpointDashboard({ events }: Props) {
  if (events.length === 0) return null;

  return (
    <section className="mt-6 space-y-4">
      <h2 className="text-base font-semibold text-[var(--foreground)]">Analytics Overview</h2>

      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <WeekOverWeek events={events} />
        <AvgSeverity events={events} />
        <CriticalEvents events={events} />
      </div>

      {/* Donut charts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <SeverityDonut events={events} />
        <StateDonut events={events} />
        <ConfidenceDonut events={events} />
      </div>

      {/* Sender analysis */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <TopSenderDomains events={events} />
        <TopSenders events={events} />
      </div>

      {/* Target + platform */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <TopTargetedMailboxes events={events} />
        <CumulativeTimeline events={events} />
        {/* <SaasPlatformChart events={events} /> */}
      </div>

      {/* Timeline charts */}
      {/* <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        
        { <RemediationRateChart events={events} />}
      </div> */}
    </section>
  );
}
