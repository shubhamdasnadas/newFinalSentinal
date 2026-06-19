"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type FirewallApiResponse = {
  report: string;
  data: any;
  updatedAt: string | null;
  message?: string;
};

type TableData = {
  columns: string[];
  rows: Record<string, any>[];
};

type AllReportData = {
  report: string;
  data: any;
  updatedAt: string | null;
  rows: Record<string, any>[];
  columns: string[];
};

const FIREWALL_REPORTS = [
  "bandwidth-trend",
  "blocked-credential-post",
  "risk-trend",
  "risky-users",
  "spyware-infected-hosts",
  "threat-trend",
  "top-application-categories",
  "top-applications",
  "top-attacker-destinations",
  "top-attacker-sources",
  "top-attacks",
  "top-blocked-url-categories",
  "top-blocked-url-users",
  "top-blocked-websites",
  "top-connections",
  "top-denied-applications",
  "top-denied-destinations",
  "top-denied-sources",
  "top-destination-countries",
  "top-destinations",
  "top-http-applications",
  "top-source-countries",
  "top-sources",
  "top-spyware-threats",
  "top-url-categories",
  "top-url-users",
  "top-users",
  "top-viruses",
  "top-vulnerabilities",
  "top-websites",
];

const COLORS = [
  "#3b82f6",
  "#f59e0b",
  "#10b981",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#ec4899",
  "#84cc16",
  "#f97316",
  "#6366f1",
];

const RISK_COLORS: Record<string, string> = {
  "1": "#22c55e",
  "2": "#84cc16",
  "3": "#f59e0b",
  "4": "#f97316",
  "5": "#ef4444",
};

const formatDate = (value: any) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("en-CA");
};

const parseNumber = (value: any): number => {
  if (value === null || value === undefined || value === "") return 0;

  const str = String(value)
    .replace(/,/g, "")
    .replace(/[^\d.-]/g, "")
    .trim();

  const num = Number(str);
  return Number.isFinite(num) ? num : 0;
};

const formatNumber = (value: number) => {
  return Number(value || 0).toLocaleString("en-IN");
};

const formatBytes = (value: any) => {
  const bytes = parseNumber(value);

  if (bytes >= 1e12) return `${(bytes / 1e12).toFixed(2)} TB`;
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(2)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(2)} MB`;
  if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(2)} KB`;

  return `${bytes} B`;
};

const toArray = (value: any): any[] | undefined => {
  if (Array.isArray(value) && value.length > 0) return value;
  if (value && typeof value === "object" && !Array.isArray(value)) return [value];
  return undefined;
};

const extractTable = (raw: any): TableData | null => {
  if (!raw) return null;

  try {
    const entry =
      toArray(raw?.report?.result?.entry) ||
      toArray(raw?.report?.result?.report?.entry) ||
      toArray(raw?.response?.result?.report?.entry) ||
      toArray(raw?.response?.result?.entry) ||
      toArray(raw?.result?.report?.entry) ||
      toArray(raw?.result?.entry) ||
      toArray(raw?.entry);

    if (entry && entry.length > 0) {
      const colSet = new Set<string>();

      entry.forEach((item) => {
        if (typeof item === "object" && item !== null) {
          Object.keys(item).forEach((key) => {
            if (key === "@name") colSet.add("name");
            else if (!key.startsWith("@")) colSet.add(key);
          });
        }
      });

      const columns = Array.from(colSet);

      const rows = entry.map((item) => {
        const row: Record<string, any> = {};

        columns.forEach((col) => {
          const realKey = col === "name" ? "@name" : col;
          const value = item?.[realKey] ?? item?.[col];

          row[col] =
            typeof value === "object" && value !== null && "#text" in value
              ? value["#text"]
              : value ?? "";
        });

        return row;
      });

      return { columns, rows };
    }

    if (Array.isArray(raw)) {
      const columns = Array.from(
        new Set(raw.flatMap((item) => Object.keys(item || {})))
      );

      return { columns, rows: raw };
    }

    if (typeof raw === "object") {
      const columns = Object.keys(raw).filter(
        (key) => typeof raw[key] !== "object"
      );

      if (columns.length > 0) return { columns, rows: [raw] };
    }
  } catch (error) {
    console.error("extractTable error:", error);
  }

  return null;
};

const getFirstValue = (
  row: Record<string, any>,
  columns: string[],
  fallback: any = "-"
): any => {
  for (const col of columns) {
    const value = row[col];
    if (value !== undefined && value !== null && value !== "") return value;
  }

  return fallback;
};

const getSumByColumn = (
  rows: Record<string, any>[],
  possibleColumns: string[]
) => {
  const col = possibleColumns.find((c) =>
    rows.some((row) => row[c] !== undefined && row[c] !== null && row[c] !== "")
  );

  if (!col) return 0;
  return rows.reduce((sum, row) => sum + parseNumber(row[col]), 0);
};

const getRowsByReport = (reports: AllReportData[], reportName: string) => {
  return reports.find((report) => report.report === reportName)?.rows ?? [];
};

const makeTopChartData = (
  rows: Record<string, any>[],
  columns: string[],
  limit = 8
) => {
  const map = new Map<string, number>();

  rows.forEach((row) => {
    const value = String(getFirstValue(row, columns, "")).trim();
    if (!value || value === "-") return;

    const numericValue = parseNumber(
      getFirstValue(row, ["count", "nrepeat", "nsess", "sessions", "threats"], 1)
    );

    map.set(value, (map.get(value) || 0) + (numericValue || 1));
  });

  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .reverse()
    .map(([name, value]) => ({
      name: name.length > 28 ? `${name.slice(0, 28)}...` : name,
      value,
    }));
};

const makeRiskTrendData = (rows: Record<string, any>[]) => {
  const map = new Map<string, { date: string; sessions: number; traffic: number }>();

  rows.forEach((row) => {
    const rawDate = getFirstValue(row, [
      "slabbed-receive_time",
      "receive_time",
      "time",
      "date",
      "updatedAt",
    ]);

    const date = formatDate(rawDate);
    if (!date || date === "-") return;

    const old = map.get(date) || { date, sessions: 0, traffic: 0 };

    old.sessions += parseNumber(
      getFirstValue(row, ["nsess", "sessions", "session", "count"], 1)
    );

    old.traffic += parseNumber(getFirstValue(row, ["nbytes", "bytes", "byte"], 0));

    map.set(date, old);
  });

  return Array.from(map.values()).sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
};

const makeRiskDistribution = (rows: Record<string, any>[]) => {
  const map = new Map<string, number>();

  rows.forEach((row) => {
    const risk = String(getFirstValue(row, ["risk", "severity", "name"], "-"));
    const count = parseNumber(
      getFirstValue(row, ["count", "nrepeat", "nsess", "sessions"], 1)
    );

    if (!risk || risk === "-") return;

    map.set(risk, (map.get(risk) || 0) + (count || 1));
  });

  return Array.from(map.entries())
    .map(([risk, value]) => ({
      name: `Risk ${risk}`,
      risk,
      value,
    }))
    .sort((a, b) => parseNumber(a.risk) - parseNumber(b.risk));
};

const getSecurityScoreStatus = (score: number) => {
  if (score >= 90) return { label: "Excellent", color: "#22c55e" };
  if (score >= 70) return { label: "Warning", color: "#f59e0b" };
  return { label: "Critical", color: "#ef4444" };
};

const KpiCard = ({
  title,
  value,
  subtitle,
  icon,
  color,
  bgColor = "#ffffff",
}: {
  title: string;
  value: string | number;
  subtitle: string;
  icon: string;
  color: string;
  bgColor?: string;
}) => {
  return (
    <div
      className="group relative flex min-h-[156px] w-full overflow-hidden rounded-2xl border border-slate-200 p-4 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
      style={{ backgroundColor: bgColor }}
    >
      <div
        className="absolute right-0 top-0 h-20 w-20 rounded-bl-[40px] opacity-10"
        style={{ backgroundColor: color }}
      />

      <div className="flex w-full flex-col justify-between pr-12">
        <div>
          <p className="max-w-[135px] text-[11px] font-black uppercase leading-4 tracking-wide text-slate-500">
            {title}
          </p>

          <h2
            className="mt-3 max-w-full break-words text-[24px] font-black leading-[1.15] text-slate-950"
            title={String(value)}
          >
            {value}
          </h2>
        </div>

        <p className="mt-3 text-sm font-medium leading-5 text-slate-500">
          {subtitle}
        </p>
      </div>

      <div
        className="absolute right-4 top-4 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg text-white shadow-sm"
        style={{ backgroundColor: color }}
      >
        {icon}
      </div>
    </div>
  );
};

const ChartCard = ({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) => {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <h3 className="text-base font-extrabold text-slate-950 sm:text-lg">
        {title}
      </h3>
      <p className="mb-4 text-sm text-slate-500">{subtitle}</p>
      {children}
    </div>
  );
};

export default function FirewallThreatAnalyticsDashboard() {
  const [allReports, setAllReports] = useState<AllReportData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchAllReports = async () => {
    try {
      setLoading(true);
      setError("");

      const results = await Promise.all(
        FIREWALL_REPORTS.map(async (reportName) => {
          try {
            const res = await fetch(`/api/firewall/reports/${reportName}`, {
              credentials: "include",
              cache: "no-store",
            });

            const json: FirewallApiResponse = await res.json();

            if (!res.ok) {
              console.error(`${reportName} failed:`, json.message);
              return null;
            }

            const table = extractTable(json.data);

            return {
              report: reportName,
              data: json.data,
              updatedAt: json.updatedAt,
              rows: table?.rows ?? [],
              columns: table?.columns ?? [],
            };
          } catch (err) {
            console.error(`${reportName} fetch error:`, err);
            return null;
          }
        })
      );

      setAllReports(results.filter(Boolean) as AllReportData[]);
    } catch (err: any) {
      setError(err.message || "Failed to fetch firewall reports");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllReports();
  }, []);

  const allRows: Record<string, any>[] = useMemo(() => {
    return allReports.flatMap((report) =>
      report.rows.map((row) => ({
        reportName: report.report,
        updatedAt: report.updatedAt,
        ...row,
      }))
    );
  }, [allReports]);

  const dashboard = useMemo(() => {
    const riskRows = getRowsByReport(allReports, "risk-trend");
    const attackerSourceRows = getRowsByReport(allReports, "top-attacker-sources");
    const attackerDestinationRows = getRowsByReport(
      allReports,
      "top-attacker-destinations"
    );

    const deniedRows = [
      ...getRowsByReport(allReports, "top-denied-destinations"),
      ...getRowsByReport(allReports, "top-denied-sources"),
      ...getRowsByReport(allReports, "top-denied-applications"),
    ];

    const riskyUserRows = getRowsByReport(allReports, "risky-users");
    const topUserRows = getRowsByReport(allReports, "top-users");
    const topAttackRows = getRowsByReport(allReports, "top-attacks");
    const connectionRows = getRowsByReport(allReports, "top-connections");

    const totalSessions = getSumByColumn(allRows, [
      "nsess",
      "sessions",
      "session",
      "count",
    ]);

    const totalTraffic = getSumByColumn(allRows, ["nbytes", "bytes", "byte"]);

    const highRiskEvents = riskRows.reduce((sum, row) => {
      const risk = parseNumber(getFirstValue(row, ["risk", "name", "severity"], 0));
      if (risk >= 4) {
        return (
          sum +
          parseNumber(
            getFirstValue(row, ["count", "nrepeat", "nsess", "sessions"], 1)
          )
        );
      }
      return sum;
    }, 0);

    const blockedConnections =
      deniedRows.length ||
      allRows.filter((row) => {
        const action = String(
          getFirstValue(row, ["action", "category", "name"], "")
        ).toLowerCase();

        return (
          action.includes("block") ||
          action.includes("deny") ||
          action.includes("drop")
        );
      }).length;

    const topSource =
      makeTopChartData(attackerSourceRows.length ? attackerSourceRows : allRows, [
        "src",
        "source",
        "source_ip",
        "name",
      ])[0]?.name || "-";

    const topDestination =
      makeTopChartData(
        attackerDestinationRows.length ? attackerDestinationRows : allRows,
        ["dst", "destination", "destination_ip", "name"]
      )[0]?.name || "-";

    const criticalUsers = riskyUserRows.length;

    const securityScore = Math.max(
      0,
      Math.min(
        100,
        Math.round(
          100 -
            highRiskEvents * 0.05 -
            criticalUsers * 2 -
            blockedConnections * 0.1
        )
      )
    );

    return {
      totalSessions,
      totalTraffic,
      highRiskEvents,
      blockedConnections,
      topSource,
      topDestination,
      securityScore,
      riskTrendData: makeRiskTrendData(riskRows.length ? riskRows : allRows),
      riskDistribution: makeRiskDistribution(riskRows),
      topAttacks: makeTopChartData(topAttackRows.length ? topAttackRows : allRows, [
        "threatid",
        "threat",
        "name",
        "category",
      ]),
      topSources: makeTopChartData(
        attackerSourceRows.length ? attackerSourceRows : allRows,
        ["src", "source", "source_ip", "name"]
      ),
      topDeniedDestinations: makeTopChartData(
        deniedRows.length ? deniedRows : allRows,
        ["dst", "destination", "destination_ip", "name"]
      ),
      topConnections: makeTopChartData(
        connectionRows.length ? connectionRows : allRows,
        ["name", "src", "source", "dst", "destination"]
      ),
    };
  }, [allReports, allRows]);

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-5">
      <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-black text-slate-950">
            Firewall SOC / NOC Dashboard
          </h1>
          <p className="text-sm text-slate-500">
            Palo Alto firewall reports · {formatNumber(allRows.length)} total rows
          </p>
        </div>

        <button
          onClick={fetchAllReports}
          className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"
        >
          Refresh
        </button>
      </div>

      {loading && (
        <div className="flex h-72 items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        </div>
      )}

      {error && (
        <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
          <div className="mb-6 grid grid-cols-[repeat(auto-fit,minmax(230px,1fr))] gap-4">
            <KpiCard
              title="Total Sessions"
              value={formatNumber(dashboard.totalSessions)}
              subtitle="nsess / session count"
              icon="📊"
              color="#3b82f6"
              bgColor="#eff6ff"
            />

            <KpiCard
              title="Total Traffic"
              value={formatBytes(dashboard.totalTraffic)}
              subtitle="nbytes total traffic"
              icon="🌐"
              color="#06b6d4"
              bgColor="#ecfeff"
            />

            <KpiCard
              title="High Risk Events"
              value={formatNumber(dashboard.highRiskEvents)}
              subtitle="Risk 4 + Risk 5"
              icon="🔴"
              color="#ef4444"
              bgColor="#fef2f2"
            />

           

            <KpiCard
              title="Top Destination"
              value={dashboard.topDestination}
              subtitle="Highest attacker destination"
              icon="🎯"
              color="#0f766e"
              bgColor="#f0fdfa"
            />

            <KpiCard
              title="Security Score"
              value={`${dashboard.securityScore}/100`}
              subtitle={getSecurityScoreStatus(dashboard.securityScore).label}
              icon="✅"
              color={getSecurityScoreStatus(dashboard.securityScore).color}
              bgColor="#f8fafc"
            />
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <ChartCard
              title="Risk Trend Over Time"
              subtitle="Bar = traffic bytes, Line = session count"
            >
              <div className="h-[360px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={dashboard.riskTrendData}
                    margin={{ top: 10, right: 25, bottom: 55, left: 10 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />

                    <XAxis
                      dataKey="date"
                      angle={-35}
                      textAnchor="end"
                      height={75}
                      tick={{ fontSize: 11, fill: "#64748b" }}
                    />

                    <YAxis
                      yAxisId="left"
                      tick={{ fontSize: 11, fill: "#64748b" }}
                    />

                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tick={{ fontSize: 11, fill: "#64748b" }}
                      tickFormatter={(value) => formatBytes(value)}
                    />

                    <Tooltip
                      formatter={(value: any, name: any) => {
                        if (name === "traffic") {
                          return [formatBytes(value), "Traffic"];
                        }
                        return [formatNumber(parseNumber(value)), "Sessions"];
                      }}
                      contentStyle={{
                        background: "#ffffff",
                        border: "1px solid #e5e7eb",
                        borderRadius: 12,
                      }}
                    />

                    <Bar
                      yAxisId="right"
                      dataKey="traffic"
                      name="traffic"
                      fill="#93c5fd"
                      radius={[5, 5, 0, 0]}
                      maxBarSize={42}
                    />

                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="sessions"
                      name="sessions"
                      stroke="#2563eb"
                      strokeWidth={3}
                      dot={{ r: 3 }}
                      activeDot={{ r: 6 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            <ChartCard
              title="Risk-wise Distribution"
              subtitle="Risk 1 to Risk 5 security distribution"
            >
              <div className="h-[360px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={dashboard.riskDistribution}
                      dataKey="value"
                      nameKey="name"
                      outerRadius={115}
                      label
                    >
                      {dashboard.riskDistribution.map((entry, index) => (
                        <Cell
                          key={`risk-cell-${index}`}
                          fill={
                            RISK_COLORS[String(entry.risk)] ||
                            COLORS[index % COLORS.length]
                          }
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: any) => formatNumber(parseNumber(value))}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            <ChartCard
              title="Top Attacks"
              subtitle="Most repeated firewall threat / attack names"
            >
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={dashboard.topAttacks}
                    layout="vertical"
                    margin={{ top: 10, right: 25, bottom: 10, left: 140 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={140}
                      tick={{ fontSize: 11, fill: "#64748b" }}
                    />
                    <Tooltip />
                    <Bar dataKey="value" radius={[0, 5, 5, 0]}>
                      {dashboard.topAttacks.map((_, index) => (
                        <Cell
                          key={`attack-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            {[
              {
                title: "Top Sources",
                subtitle: "Highest source IP / source count",
                data: dashboard.topSources,
                color: "#3b82f6",
              },
              {
                title: "Top Denied Destinations",
                subtitle: "Denied destination systems",
                data: dashboard.topDeniedDestinations,
                color: "#dc2626",
              },
              {
                title: "Top Connections",
                subtitle: "Most repeated firewall connections",
                data: dashboard.topConnections,
                color: "#0f766e",
              },
            ].map((chart) => (
              <ChartCard
                key={chart.title}
                title={chart.title}
                subtitle={chart.subtitle}
              >
                <div className="h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={chart.data}
                      layout="vertical"
                      margin={{ top: 10, right: 25, bottom: 10, left: 140 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={140}
                        tick={{ fontSize: 11, fill: "#64748b" }}
                      />
                      <Tooltip />
                      <Bar
                        dataKey="value"
                        fill={chart.color}
                        radius={[0, 5, 5, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>
            ))}
          </div>
        </>
      )}
    </div>
  );
}