"use client";

import React, { useMemo } from "react";
import {
  Bar,
  BarChart,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type RiskyEndpointItem = {
  computerName?: string;
  user?: string;
  site?: string;
  riskScore?: number;
  reasons?: string[];
};

const COLORS = {
  red: "#ef4444",
  orange: "#f59e0b",
  yellow: "#eab308",
  green: "#22c55e",
  blue: "#3b82f6",
  purple: "#8b5cf6",
  slate: "#64748b",
};

const reasonColorMap: Record<string, string> = {
  Inactive: COLORS.red,
  "Firewall Disabled": COLORS.orange,
  "Old/No Scan": COLORS.purple,
  "Active Threats": COLORS.red,
  "Threat Detected": COLORS.red,
};

const normalizeReason = (reason: string) => {
  const value = reason.toLowerCase();

  if (value.includes("inactive")) return "Inactive";
  if (value.includes("firewall")) return "Firewall Disabled";
  if (value.includes("old") || value.includes("scan")) return "Old/No Scan";
  if (value.includes("threat")) return "Active Threats";

  return reason;
};

const Riskyendpoint = ({ data }: { data: RiskyEndpointItem[] }) => {
  const rows = Array.isArray(data) ? data : [];

  const analytics = useMemo(() => {
    const totalHighRisk = rows.length;

    const reasonCount: Record<string, number> = {};
    const userMap: Record<string, number> = {};

    const siteMap: Record<
      string,
      {
        site: string;
        inactive: number;
        firewallDisabled: number;
        oldScan: number;
        activeThreats: number;
        total: number;
      }
    > = {};

    const scoreDistribution: Record<string, number> = {
      "0-10": 0,
      "11-20": 0,
      "21-30": 0,
      "31-40": 0,
      "41+": 0,
    };

    rows.forEach((item) => {
      const site = item.site || "Unknown";
      const user = item.user || "Unknown";
      const score = Number(item.riskScore || 0);

      if (!siteMap[site]) {
        siteMap[site] = {
          site,
          inactive: 0,
          firewallDisabled: 0,
          oldScan: 0,
          activeThreats: 0,
          total: 0,
        };
      }

      siteMap[site].total += 1;
      userMap[user] = (userMap[user] || 0) + 1;

      if (score <= 10) scoreDistribution["0-10"] += 1;
      else if (score <= 20) scoreDistribution["11-20"] += 1;
      else if (score <= 30) scoreDistribution["21-30"] += 1;
      else if (score <= 40) scoreDistribution["31-40"] += 1;
      else scoreDistribution["41+"] += 1;

      item.reasons?.forEach((r) => {
        const reason = normalizeReason(r);
        reasonCount[reason] = (reasonCount[reason] || 0) + 1;

        if (reason === "Inactive") siteMap[site].inactive += 1;
        if (reason === "Firewall Disabled") siteMap[site].firewallDisabled += 1;
        if (reason === "Old/No Scan") siteMap[site].oldScan += 1;
        if (reason === "Active Threats") siteMap[site].activeThreats += 1;
      });
    });

    const inactiveCount = reasonCount["Inactive"] || 0;
    const firewallDisabledCount = reasonCount["Firewall Disabled"] || 0;
    const oldScanCount = reasonCount["Old/No Scan"] || 0;
    const activeThreatCount = reasonCount["Active Threats"] || 0;

    const healthScore = Math.max(
      0,
      Math.min(
        100,
        100 -
          inactiveCount * 5 -
          firewallDisabledCount * 10 -
          oldScanCount * 3 -
          activeThreatCount * 15
      )
    );

    return {
      totalHighRisk,
      inactiveCount,
      firewallDisabledCount,
      oldScanCount,
      activeThreatCount,
      healthScore,

      reasonBreakdown: Object.entries(reasonCount).map(([name, value]) => ({
        name,
        value,
      })),

      siteWiseRisk: Object.values(siteMap),

      topUsers: Object.entries(userMap)
        .map(([user, count]) => ({ user, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),

      scoreDistributionData: Object.entries(scoreDistribution).map(
        ([range, count]) => ({
          range,
          count,
        })
      ),

      leaderboard: [...rows]
        .sort((a, b) => Number(b.riskScore || 0) - Number(a.riskScore || 0))
        .slice(0, 5),
    };
  }, [rows]);

  const scanCompliance =
    analytics.totalHighRisk > 0
      ? Math.max(
          0,
          Math.round(
            ((analytics.totalHighRisk - analytics.oldScanCount) /
              analytics.totalHighRisk) *
              100
          )
        )
      : 100;

  const activeTrendData = [
    { name: "Mon", value: Math.max(1, analytics.inactiveCount - 4) },
    { name: "Tue", value: Math.max(1, analytics.inactiveCount - 2) },
    { name: "Wed", value: analytics.inactiveCount },
    { name: "Thu", value: Math.max(1, analytics.inactiveCount - 1) },
    { name: "Fri", value: analytics.inactiveCount },
  ];

  return (
    <div className="w-full space-y-5 rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4 text-[var(--foreground)] shadow-sm">
      <div>
        <h2 className="text-lg font-bold text-[var(--foreground)]">
          Risky Endpoint Dashboard
        </h2>
        <p className="text-sm text-[var(--muted)]">
          Security overview based on risky endpoint reasons and risk score
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="High Risk Endpoints"
          value={analytics.totalHighRisk}
          subtitle="Machines Require Action"
          icon="🔴"
          color="red"
        />

        <ChartCard title="Firewall Disabled" value={analytics.firewallDisabledCount}>
          <ResponsiveContainer width="100%" height={90}>
            <PieChart>
              <Pie
                data={[
                  {
                    name: "Disabled",
                    value: analytics.firewallDisabledCount,
                  },
                  {
                    name: "Other",
                    value: Math.max(
                      0,
                      analytics.totalHighRisk -
                        analytics.firewallDisabledCount
                    ),
                  },
                ]}
                innerRadius={28}
                outerRadius={40}
                paddingAngle={3}
                dataKey="value"
              >
                <Cell fill={COLORS.red} />
                <Cell fill={COLORS.green} />
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <GaugeCard
          title="Scan Compliance"
          value={scanCompliance}
          subtitle={`${analytics.oldScanCount} Machines Not Scanned`}
        />

        <ChartCard title="Inactive Devices" value={analytics.inactiveCount}>
          <ResponsiveContainer width="100%" height={80}>
            <LineChart data={activeTrendData}>
              <Line
                type="monotone"
                dataKey="value"
                stroke={COLORS.red}
                strokeWidth={3}
                dot={false}
              />
              <Tooltip />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <BigCard title="Risk Score Distribution">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={analytics.scoreDistributionData}>
              <XAxis dataKey="range" fontSize={12} stroke="var(--muted)" />
              <YAxis allowDecimals={false} fontSize={12} stroke="var(--muted)" />
              <Tooltip />
              <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                {analytics.scoreDistributionData.map((_, index) => (
                  <Cell
                    key={index}
                    fill={
                      index <= 1
                        ? COLORS.green
                        : index === 2
                        ? COLORS.orange
                        : COLORS.red
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </BigCard>

        <BigCard title="Risk Reason Breakdown">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={analytics.reasonBreakdown}
                dataKey="value"
                nameKey="name"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={3}
              >
                {analytics.reasonBreakdown.map((item, index) => (
                  <Cell
                    key={index}
                    fill={reasonColorMap[item.name] || COLORS.blue}
                  />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>

          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
            {analytics.reasonBreakdown.map((item) => (
              <div
                key={item.name}
                className="flex items-center justify-between rounded-lg border border-[var(--card-border)] bg-[var(--muted-bg)] px-2 py-1 text-[var(--foreground)]"
              >
                <span>{item.name}</span>
                <b>{item.value}</b>
              </div>
            ))}
          </div>
        </BigCard>

        <BigCard title="Site Wise Risk">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={analytics.siteWiseRisk}>
              <XAxis dataKey="site" fontSize={11} stroke="var(--muted)" />
              <YAxis allowDecimals={false} fontSize={12} stroke="var(--muted)" />
              <Tooltip />
              <Bar dataKey="inactive" stackId="a" fill={COLORS.red} />
              <Bar dataKey="firewallDisabled" stackId="a" fill={COLORS.orange} />
              <Bar dataKey="oldScan" stackId="a" fill={COLORS.purple} />
            </BarChart>
          </ResponsiveContainer>
        </BigCard>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <BigCard title="Top Risky Users">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={analytics.topUsers} layout="vertical">
              <XAxis type="number" allowDecimals={false} fontSize={12} stroke="var(--muted)" />
              <YAxis dataKey="user" type="category" width={80} fontSize={12} stroke="var(--muted)" />
              <Tooltip />
              <Bar dataKey="count" fill={COLORS.blue} radius={[0, 8, 8, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </BigCard>

        <BigCard title="Endpoint Health Score">
          <div className="flex h-[220px] flex-col items-center justify-center">
            <div
              className="flex h-36 w-36 items-center justify-center rounded-full"
              style={{
                background: `conic-gradient(${
                  analytics.healthScore >= 80
                    ? COLORS.green
                    : analytics.healthScore >= 50
                    ? COLORS.orange
                    : COLORS.red
                } ${analytics.healthScore * 3.6}deg, var(--muted-bg) 0deg)`,
              }}
            >
              <div className="flex h-28 w-28 flex-col items-center justify-center rounded-full bg-[var(--card-bg)]">
                <span className="text-3xl font-bold text-[var(--foreground)]">
                  {analytics.healthScore}
                </span>
                <span className="text-xs text-[var(--muted)]">/ 100</span>
              </div>
            </div>

            <p className="mt-3 text-sm font-semibold text-[var(--foreground)]">
              {analytics.healthScore >= 80
                ? "Good"
                : analytics.healthScore >= 50
                ? "Warning"
                : "Critical"}
            </p>
          </div>
        </BigCard>

        <BigCard title="Risk Score Leaderboard">
          <div className="space-y-3">
            {analytics.leaderboard.map((item, index) => (
              <div
                key={`${item.computerName}-${index}`}
                className="flex items-center justify-between rounded-xl border border-[var(--card-border)] bg-[var(--muted-bg)] px-3 py-2"
              >
                <div>
                  <p className="text-sm font-bold text-[var(--foreground)]">
                    {index === 0
                      ? "🥇"
                      : index === 1
                      ? "🥈"
                      : index === 2
                      ? "🥉"
                      : `${index + 1}.`}{" "}
                    {item.computerName || "-"}
                  </p>
                  <p className="text-xs text-[var(--muted)]">
                    {item.user || "-"} • {item.site || "-"}
                  </p>
                </div>

                <span className="rounded-full bg-red-100 px-3 py-1 text-sm font-bold text-red-600 dark:bg-red-900/40 dark:text-red-300">
                  {item.riskScore || 0}
                </span>
              </div>
            ))}
          </div>
        </BigCard>
      </div>
    </div>
  );
};

const SummaryCard = ({
  title,
  value,
  subtitle,
  icon,
  color,
}: {
  title: string;
  value: number;
  subtitle: string;
  icon: string;
  color: "red" | "green" | "blue" | "orange";
}) => {
  const colorMap = {
    red: "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-900/20 dark:text-red-300",
    green:
      "border-green-200 bg-green-50 text-green-700 dark:border-green-900/60 dark:bg-green-900/20 dark:text-green-300",
    blue: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-900/20 dark:text-blue-300",
    orange:
      "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900/60 dark:bg-orange-900/20 dark:text-orange-300",
  };

  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${colorMap[color]}`}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">{title}</p>
        <span className="text-xl">{icon}</span>
      </div>
      <h3 className="mt-3 text-3xl font-extrabold">{value}</h3>
      <p className="mt-1 text-xs opacity-80">{subtitle}</p>
    </div>
  );
};

const ChartCard = ({
  title,
  value,
  children,
}: {
  title: string;
  value: number;
  children: React.ReactNode;
}) => {
  return (
    <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--muted-bg)] p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold text-[var(--foreground)]">
          {title}
        </p>
        <span className="text-2xl font-bold text-[var(--foreground)]">
          {value}
        </span>
      </div>
      {children}
    </div>
  );
};

const BigCard = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => {
  return (
    <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4 shadow-sm">
      <h3 className="mb-4 text-sm font-bold text-[var(--foreground)]">
        {title}
      </h3>
      {children}
    </div>
  );
};

const GaugeCard = ({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: number;
  subtitle: string;
}) => {
  const barColor =
    value >= 80 ? "bg-green-500" : value >= 50 ? "bg-orange-500" : "bg-red-500";

  return (
    <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--muted-bg)] p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-[var(--foreground)]">
          {title}
        </p>
        <span
          className={`text-2xl font-bold ${
            value >= 80
              ? "text-green-600 dark:text-green-400"
              : value >= 50
              ? "text-orange-600 dark:text-orange-400"
              : "text-red-600 dark:text-red-400"
          }`}
        >
          {value}%
        </span>
      </div>

      <div className="mt-5 h-3 rounded-full bg-[var(--card-bg)]">
        <div
          className={`h-3 rounded-full ${barColor}`}
          style={{ width: `${value}%` }}
        />
      </div>

      <p className="mt-4 text-xs text-[var(--muted)]">{subtitle}</p>
    </div>
  );
};

export default Riskyendpoint;