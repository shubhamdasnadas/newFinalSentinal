"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

type S1ApplicationCve = {
  name?: string;
  vendor?: string;
  cveCount?: number;
  estimate?: boolean;
  daysDetected?: number;
  applicationId?: string;
  detectionDate?: string;
  endpointCount?: number;
  highestSeverity?: string | null;
  highestNvdBaseScore?: string | null;
};

const COLORS = {
  CRITICAL: "#a855f7",
  HIGH: "#ef4444",
  MEDIUM: "#eab308",
  LOW: "#3b82f6",
  UNKNOWN: "#64748b",
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "-";
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const shortName = (value?: string) => {
  if (!value) return "-";
  return value.length > 18 ? value.slice(0, 18) + "..." : value;
};

const CustomRiskTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;

  const data = payload[0]?.payload;

  return (
    <div className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-3 shadow-lg text-xs">
      <p className="font-bold text-[var(--foreground)] mb-1">
        {data?.fullName}
      </p>
      <p className="text-[var(--muted)]">
        CVE Count:{" "}
        <span className="font-bold text-[var(--foreground)]">
          {data?.cves}
        </span>
      </p>
      <p className="text-[var(--muted)]">
        Base Score:{" "}
        <span className="font-bold text-[var(--foreground)]">
          {data?.score}
        </span>
      </p>
    </div>
  );
};

const CveCard = () => {
  const [rawCves, setRawCves] = useState<S1ApplicationCve[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError("");

    fetch("/api/sentinelone/db/application-cve", {
      credentials: "include",
    })
      .then(async (r) => {
        const j = await r.json();

        if (!r.ok) {
          throw new Error(j.message || "Failed to fetch CVE data");
        }

        setRawCves(Array.isArray(j.data) ? j.data : []);
        setLastSyncedAt(j.lastSyncedAt || null);
      })
      .catch((e) => setError(e.message || "Network error"))
      .finally(() => setLoading(false));
  }, []);

  const dashboardData = useMemo(() => {
    const totalApplications = rawCves.length;

    const totalCves = rawCves.reduce(
      (sum, item) => sum + Number(item.cveCount || 0),
      0
    );

    const totalEndpoints = rawCves.reduce(
      (sum, item) => sum + Number(item.endpointCount || 0),
      0
    );

    const avgScore =
      rawCves.length > 0
        ? (
            rawCves.reduce(
              (sum, item) => sum + Number(item.highestNvdBaseScore || 0),
              0
            ) / rawCves.length
          ).toFixed(2)
        : "0";

    const severityMap: Record<string, number> = {
      CRITICAL: 0,
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0,
      UNKNOWN: 0,
    };

    rawCves.forEach((item) => {
      const severity = (item.highestSeverity || "UNKNOWN").toUpperCase();
      severityMap[severity] = (severityMap[severity] || 0) + 1;
    });

    const severityDistribution = Object.entries(severityMap).map(
      ([name, value]) => ({
        name,
        value,
        fill: COLORS[name as keyof typeof COLORS] || COLORS.UNKNOWN,
      })
    );

    const topRiskyApps = [...rawCves]
      .sort((a, b) => Number(b.cveCount || 0) - Number(a.cveCount || 0))
      .slice(0, 10)
      .map((item) => ({
        name: shortName(item.name),
        fullName: item.name || "-",
        cves: Number(item.cveCount || 0),
        score: Number(item.highestNvdBaseScore || 0),
      }));

    const cveAging = [
      { name: "0-30", count: 0 },
      { name: "31-90", count: 0 },
      { name: "91-180", count: 0 },
      { name: "180+", count: 0 },
    ];

    rawCves.forEach((item) => {
      const days = Number(item.daysDetected || 0);

      if (days <= 30) cveAging[0].count += 1;
      else if (days <= 90) cveAging[1].count += 1;
      else if (days <= 180) cveAging[2].count += 1;
      else cveAging[3].count += 1;
    });

    const endpointImpact = [...rawCves]
      .sort((a, b) => Number(b.endpointCount || 0) - Number(a.endpointCount || 0))
      .slice(0, 10)
      .map((item) => ({
        name: shortName(item.name),
        endpoints: Number(item.endpointCount || 0),
      }));

    const scoreRange = [
      { name: "0-3.9 Low", value: 0, fill: "#3b82f6" },
      { name: "4-6.9 Medium", value: 0, fill: "#eab308" },
      { name: "7-8.9 High", value: 0, fill: "#ef4444" },
      { name: "9-10 Critical", value: 0, fill: "#a855f7" },
    ];

    rawCves.forEach((item) => {
      const score = Number(item.highestNvdBaseScore || 0);

      if (score <= 3.9) scoreRange[0].value += 1;
      else if (score <= 6.9) scoreRange[1].value += 1;
      else if (score <= 8.9) scoreRange[2].value += 1;
      else scoreRange[3].value += 1;
    });

    const vendorMap: Record<string, number> = {};

    rawCves.forEach((item) => {
      const vendor = item.vendor || "Unknown";
      vendorMap[vendor] = (vendorMap[vendor] || 0) + Number(item.cveCount || 0);
    });

    const vendorRisk = Object.entries(vendorMap)
      .map(([vendor, cves]) => ({
        vendor: shortName(vendor),
        cves,
      }))
      .sort((a, b) => b.cves - a.cves)
      .slice(0, 10);

    const estimateStatus = [
      {
        name: "Estimate Yes",
        value: rawCves.filter((item) => item.estimate).length,
        fill: "#f97316",
      },
      {
        name: "Estimate No",
        value: rawCves.filter((item) => !item.estimate).length,
        fill: "#22c55e",
      },
    ];

    const criticalApps = [...rawCves]
      .filter((item) => item.highestSeverity?.toUpperCase() === "CRITICAL")
      .sort((a, b) => Number(b.cveCount || 0) - Number(a.cveCount || 0))
      .slice(0, 6);

    return {
      totalApplications,
      totalCves,
      totalEndpoints,
      avgScore,
      severityDistribution,
      topRiskyApps,
      cveAging,
      endpointImpact,
      scoreRange,
      vendorRisk,
      estimateStatus,
      criticalApps,
      severityMap,
    };
  }, [rawCves]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] p-6">
        Loading CVE dashboard...
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[var(--background)] p-6">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-600">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen p-4 sm:p-6 bg-[var(--background)] text-[var(--foreground)]">
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-[var(--foreground)]">
          SentinelOne Application CVE Dashboard
        </h1>

        <p className="text-xs sm:text-sm text-[var(--muted)] mt-0.5">
          Application vulnerability analytics from SentinelOne
        </p>

        {lastSyncedAt && (
          <p className="mt-1 text-xs text-[var(--muted)]">
            Last synced: {formatDateTime(lastSyncedAt)}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-4 mb-6">
        <StatCard title="Applications" value={dashboardData.totalApplications} />
        <StatCard title="Total CVEs" value={dashboardData.totalCves} />
        <StatCard
          title="Critical Apps"
          value={dashboardData.severityMap.CRITICAL}
          color="purple"
        />
        <StatCard
          title="High Apps"
          value={dashboardData.severityMap.HIGH}
          color="red"
        />
        <StatCard
          title="Medium Apps"
          value={dashboardData.severityMap.MEDIUM}
          color="yellow"
        />
        <StatCard title="Endpoints" value={dashboardData.totalEndpoints} />
        <StatCard title="Avg Score" value={dashboardData.avgScore} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
        <ChartCard title="Severity Distribution">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={dashboardData.severityDistribution}
                dataKey="value"
                nameKey="name"
                innerRadius={65}
                outerRadius={95}
                paddingAngle={3}
              >
                {dashboardData.severityDistribution.map((item, index) => (
                  <Cell key={index} fill={item.fill} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ color: "var(--muted)", fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Base Score Range">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={dashboardData.scoreRange}
                dataKey="value"
                nameKey="name"
                innerRadius={65}
                outerRadius={95}
                paddingAngle={3}
              >
                {dashboardData.scoreRange.map((item, index) => (
                  <Cell key={index} fill={item.fill} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ color: "var(--muted)", fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
        <ChartCard title="Top 10 Risky Applications">
          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={dashboardData.topRiskyApps}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
              <XAxis dataKey="name" tick={{ fill: "var(--muted)", fontSize: 11 }} />
              <YAxis tick={{ fill: "var(--muted)", fontSize: 11 }} />
              <Tooltip content={<CustomRiskTooltip />} />
              <Legend wrapperStyle={{ color: "var(--muted)", fontSize: 12 }} />
              <Bar dataKey="cves" name="CVE Count" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="CVE Aging">
          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={dashboardData.cveAging}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
              <XAxis dataKey="name" tick={{ fill: "var(--muted)", fontSize: 12 }} />
              <YAxis tick={{ fill: "var(--muted)", fontSize: 12 }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" name="Applications" fill="#38bdf8" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
        <ChartCard title="Endpoint Impact">
          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={dashboardData.endpointImpact}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
              <XAxis dataKey="name" tick={{ fill: "var(--muted)", fontSize: 11 }} />
              <YAxis tick={{ fill: "var(--muted)", fontSize: 11 }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="endpoints" name="Affected Endpoints" fill="#22c55e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Vendor Risk">
          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={dashboardData.vendorRisk} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
              <XAxis type="number" tick={{ fill: "var(--muted)", fontSize: 11 }} />
              <YAxis
                type="category"
                dataKey="vendor"
                width={130}
                tick={{ fill: "var(--muted)", fontSize: 11 }}
              />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="cves" name="Total CVEs" fill="#f97316" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">
          Critical Apps Mini Cards
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {dashboardData.criticalApps.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No critical apps found.</p>
          ) : (
            dashboardData.criticalApps.map((item, index) => (
              <div
                key={item.applicationId || index}
                className="rounded-xl border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/20 p-4"
              >
                <h3 className="text-sm font-bold text-purple-700 dark:text-purple-300 mb-2">
                  {item.name || "-"}
                </h3>

                <p className="text-xs text-[var(--muted)] mb-3">
                  {item.vendor || "Unknown Vendor"}
                </p>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <Info label="Severity" value={item.highestSeverity || "-"} />
                  <Info label="CVEs" value={item.cveCount ?? 0} />
                  <Info label="Score" value={item.highestNvdBaseScore || "-"} />
                  <Info label="Endpoints" value={item.endpointCount ?? 0} />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default CveCard;

const tooltipStyle = {
  background: "var(--card-bg)",
  border: "1px solid var(--card-border)",
  borderRadius: 8,
  color: "var(--foreground)",
};

const StatCard = ({
  title,
  value,
  color = "slate",
}: {
  title: string;
  value: string | number;
  color?: "slate" | "red" | "yellow" | "purple";
}) => {
  const classes =
    color === "red"
      ? "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400"
      : color === "yellow"
      ? "border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400"
      : color === "purple"
      ? "border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400"
      : "border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--foreground)]";

  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${classes}`}>
      <p className="text-xs font-semibold opacity-80 uppercase tracking-wide">
        {title}
      </p>
      <h2 className="text-2xl font-bold mt-1">{value}</h2>
    </div>
  );
};

const ChartCard = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => {
  return (
    <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4 shadow-sm">
      <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">
        {title}
      </h2>
      {children}
    </div>
  );
};

const Info = ({ label, value }: { label: string; value: string | number }) => {
  return (
    <div className="rounded-lg bg-[var(--card-bg)] border border-[var(--card-border)] p-3">
      <p className="text-[11px] text-[var(--muted)]">{label}</p>
      <p className="text-sm font-bold text-[var(--foreground)]">{value}</p>
    </div>
  );
};