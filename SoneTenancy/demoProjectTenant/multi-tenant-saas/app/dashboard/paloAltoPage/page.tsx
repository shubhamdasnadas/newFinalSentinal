"use client";

import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

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
  "top-connections",
  "top-denied-applications",
  "top-destinations",
  "top-sources",
  "top-users",
  "top-vulnerabilities",
  "top-websites",
];

const COLORS = ["#6366f1", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6"];

const PaloAltoPage = () => {
  const [selectedReport, setSelectedReport] = useState("risk-trend");
  const [selectedXAxis, setSelectedXAxis] = useState<string[]>([]);
  const [selectedYAxis, setSelectedYAxis] = useState<string[]>([]);
  const [selectedChartType, setSelectedChartType] =
    useState<"bar" | "line" | "mixed">("bar");

  const [showXDrop, setShowXDrop] = useState(false);
  const [showYDrop, setShowYDrop] = useState(false);

  const [fwRaw, setFwRaw] = useState<any>(null);
  const [fwLoading, setFwLoading] = useState(false);
  const [fwError, setFwError] = useState("");

  useEffect(() => {
    if (!selectedReport) return;

    setFwLoading(true);
    setFwError("");
    setFwRaw(null);

    fetch(`/api/firewall/reports/${selectedReport}`, {
      credentials: "include",
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.message && d.data === undefined) {
          setFwError(d.message);
        } else {
          setFwRaw(d.data ?? null);
        }
      })
      .catch(() => setFwError("Network error"))
      .finally(() => setFwLoading(false));
  }, [selectedReport]);

  const fwTable = fwRaw ? extractTable(fwRaw) : null;
  const fwColumns = fwTable?.columns ?? [];
  const fwTrendData =
    selectedReport === "risk-trend" && fwTable?.rows?.length
      ? buildRiskTrendData(fwTable.rows)
      : [];

  useEffect(() => {
    if (!fwTable?.columns?.length) return;

    const cols = fwTable.columns;
    const numCol =
      cols.find((c) => fwTable.rows.some((r) => getNum(r[c]) > 0)) ||
      cols[1] ||
      cols[0];

    setSelectedXAxis((prev) => (prev.length ? prev : [cols[0]]));
    setSelectedYAxis((prev) => (prev.length ? prev : [numCol]));
  }, [fwRaw]);

  const toggleAxis = (
    col: string,
    setter: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    setter((prev) =>
      prev.includes(col) ? prev.filter((v) => v !== col) : [...prev, col]
    );
  };

  return (
    <div className="p-4">
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        {/* Report Explorer */}
        <div className="xl:col-span-7 bg-[var(--card-bg)] rounded-2xl border border-[var(--card-border)] shadow-sm flex flex-col h-[460px]">
          <div className="flex-shrink-0 rounded-t-2xl overflow-visible">
            <div className="flex items-center justify-between px-4 pt-3 pb-2">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center">
                  🛡️
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-indigo-500 uppercase tracking-widest">
                    Palo Alto Firewall
                  </p>
                  <p className="text-sm font-bold text-[var(--foreground)]">
                    Report Explorer
                  </p>
                </div>
              </div>

              {fwRaw && !fwLoading && (
                <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-600 border border-emerald-200">
                  ● Live
                </span>
              )}
            </div>

            <div className="h-px bg-[var(--card-border)]" />

            <div className="px-4 py-2.5 bg-[var(--muted-bg)] flex flex-wrap items-end gap-2">
              <div className="flex flex-col gap-0.5">
                <label className="text-[9px] font-bold text-[var(--muted)] uppercase">
                  Report
                </label>
                <select
                  value={selectedReport}
                  onChange={(e) => {
                    setSelectedReport(e.target.value);
                    setSelectedXAxis([]);
                    setSelectedYAxis([]);
                  }}
                  className="h-8 border border-[var(--input-border)] rounded-lg px-2.5 text-xs font-medium bg-[var(--card-bg)] min-w-[180px]"
                >
                  {FIREWALL_REPORTS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              {/* X Axis */}
              <div className="flex flex-col gap-0.5 relative">
                <label className="text-[9px] font-bold text-[var(--muted)] uppercase">
                  X-Axis
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setShowXDrop(!showXDrop);
                    setShowYDrop(false);
                  }}
                  className="h-8 border border-blue-400 bg-blue-50 text-blue-700 rounded-lg px-2.5 text-xs min-w-[120px]"
                >
                  {selectedXAxis.length === 0
                    ? "X-Axis"
                    : selectedXAxis.length === 1
                    ? selectedXAxis[0]
                    : `${selectedXAxis.length} selected`}
                </button>

                {showXDrop && (
                  <div className="absolute z-50 top-full mt-1 w-52 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl shadow-xl p-2 max-h-52 overflow-auto">
                    {fwColumns.map((col) => (
                      <label
                        key={col}
                        className="flex items-center gap-2 px-2 py-2 text-xs cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedXAxis.includes(col)}
                          onChange={() => toggleAxis(col, setSelectedXAxis)}
                        />
                        {col}
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Y Axis */}
              <div className="flex flex-col gap-0.5 relative">
                <label className="text-[9px] font-bold text-[var(--muted)] uppercase">
                  Y-Axis
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setShowYDrop(!showYDrop);
                    setShowXDrop(false);
                  }}
                  className="h-8 border border-emerald-400 bg-emerald-50 text-emerald-700 rounded-lg px-2.5 text-xs min-w-[120px]"
                >
                  {selectedYAxis.length === 0
                    ? "Y-Axis"
                    : selectedYAxis.length === 1
                    ? selectedYAxis[0]
                    : `${selectedYAxis.length} selected`}
                </button>

                {showYDrop && (
                  <div className="absolute z-50 top-full mt-1 w-52 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl shadow-xl p-2 max-h-52 overflow-auto">
                    {fwColumns.map((col) => (
                      <label
                        key={col}
                        className="flex items-center gap-2 px-2 py-2 text-xs cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedYAxis.includes(col)}
                          onChange={() => toggleAxis(col, setSelectedYAxis)}
                        />
                        {col}
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Chart Type */}
              <div className="flex flex-col gap-0.5">
                <label className="text-[9px] font-bold text-[var(--muted)] uppercase">
                  Chart
                </label>
                <div className="flex h-8 rounded-lg border overflow-hidden">
                  {(["bar", "line", "mixed"] as const).map((ct) => (
                    <button
                      key={ct}
                      onClick={() => setSelectedChartType(ct)}
                      className={`px-3 text-[10px] font-semibold ${
                        selectedChartType === ct
                          ? "bg-indigo-600 text-white"
                          : "bg-[var(--card-bg)] text-[var(--muted)]"
                      }`}
                    >
                      {ct === "mixed" ? "Mix" : ct}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-auto">
            {fwLoading ? (
              <Spin />
            ) : fwError ? (
              <Err msg={fwError} />
            ) : selectedXAxis.length && selectedYAxis.length ? (
              <PreviewChart
                rows={fwTable?.rows ?? []}
                xList={selectedXAxis}
                yList={selectedYAxis}
                chartType={
                  selectedYAxis.length > 1 ? "mixed" : selectedChartType
                }
              />
            ) : (
              <Empty msg="Select X-Axis and Y-Axis" />
            )}
          </div>
        </div>

        {/* Risk Trend */}
        <div className="xl:col-span-5 bg-[var(--card-bg)] rounded-2xl border border-[var(--card-border)] shadow-sm flex flex-col h-[460px]">
          <div className="bg-[var(--muted-bg)] border-b border-[var(--card-border)] px-4 py-3 rounded-t-2xl">
            <p className="text-xs text-[var(--muted)] font-medium">
              Palo Alto Firewall
            </p>
            <p className="text-sm font-bold text-[var(--foreground)]">
              Risk Trend
            </p>
          </div>

          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={fwTrendData}
                margin={{ top: 20, right: 30, left: 5, bottom: 50 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="time"
                  tickFormatter={fmtDateTime}
                  angle={-25}
                  textAnchor="end"
                  height={70}
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  yAxisId="left"
                  orientation="left"
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tickFormatter={(v) => fmtBytesShort(Number(v))}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip
                  labelFormatter={(l) => `Time: ${fmtDateTime(l)}`}
                  formatter={(v: any, n: any) =>
                    n === "Nbytes"
                      ? [fmtBytes(Number(v)), "Nbytes"]
                      : [String(v), String(n)]
                  }
                />
                <Legend />
                <Bar
                  yAxisId="left"
                  dataKey="nsessValue"
                  name="Nsess"
                  fill="#6366f1"
                  radius={[4, 4, 0, 0]}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="nbytesBytes"
                  name="Nbytes"
                  stroke="#ef4444"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaloAltoPage;

/* ---------------- Helper Components ---------------- */

function Spin() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
    </div>
  );
}

function Err({ msg }: { msg: string }) {
  return (
    <div className="flex items-center justify-center h-full text-red-500 text-sm">
      {msg}
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return (
    <div className="flex items-center justify-center h-full text-[var(--muted)] text-sm">
      {msg}
    </div>
  );
}

/* ---------------- Preview Chart ---------------- */

function PreviewChart({
  rows,
  xList,
  yList,
  chartType,
}: {
  rows: Record<string, any>[];
  xList: string[];
  yList: string[];
  chartType: "bar" | "line" | "mixed";
}) {
  const data = rows
    .slice(0, 30)
    .map((row, i) => {
      const label = xList.map((x) => row[x]).filter(Boolean).join(" | ");
      const item: Record<string, any> = {
        label: label || `Item ${i + 1}`,
      };

      yList.forEach((y) => {
        item[y] = parseNumber(row[y]);
      });

      return item;
    })
    .filter((item) => yList.some((y) => Number(item[y]) > 0));

  if (!data.length) return <Empty msg="No numeric data found" />;

  if (chartType === "mixed" || yList.length > 1) {
    return (
      <div className="w-full h-full p-3">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" angle={-25} textAnchor="end" height={70} />
            <YAxis yAxisId="left" />
            <YAxis yAxisId="right" orientation="right" />
            <Tooltip />
            <Legend />
            {yList.map((y, i) =>
              i === 0 ? (
                <Bar
                  key={y}
                  yAxisId="left"
                  dataKey={y}
                  fill={COLORS[i % COLORS.length]}
                />
              ) : (
                <Line
                  key={y}
                  yAxisId="right"
                  type="monotone"
                  dataKey={y}
                  stroke={COLORS[i % COLORS.length]}
                />
              )
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (chartType === "line") {
    return (
      <div className="w-full h-full p-3">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" angle={-25} textAnchor="end" height={70} />
            <YAxis />
            <Tooltip />
            <Legend />
            {yList.map((y, i) => (
              <Line
                key={y}
                type="monotone"
                dataKey={y}
                stroke={COLORS[i % COLORS.length]}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <div className="w-full h-full p-3">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="label" angle={-25} textAnchor="end" height={70} />
          <YAxis />
          <Tooltip />
          <Legend />
          {yList.map((y, i) => (
            <Bar key={y} dataKey={y} fill={COLORS[i % COLORS.length]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ---------------- Utility Functions ---------------- */

function parseNumber(v: any): number {
  if (v == null || v === "") return 0;

  const s = String(v).replace(/,/g, "").toLowerCase();
  const n = parseFloat(s);

  if (isNaN(n)) return 0;
  if (s.includes("tb")) return n * 1e12;
  if (s.includes("gb")) return n * 1e9;
  if (s.includes("mb")) return n * 1e6;
  if (s.includes("kb")) return n * 1e3;

  return n;
}

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

function parsePADate(v: any): Date | null {
  if (!v) return null;

  const s = String(v).trim();
  const m = s.match(
    /^(\d{2})\/(\d{2})\/(\d{4}),?\s+(\d{2}):(\d{2}):(\d{2})$/
  );

  if (m) {
    const [, dd, mm, yyyy, hh, min, ss] = m;
    return new Date(+yyyy, +mm - 1, +dd, +hh, +min, +ss);
  }

  const n = Number(s);
  if (!isNaN(n)) return new Date(n > 9999999999 ? n : n * 1000);

  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function fmtDateTime(v: any): string {
  const d = parsePADate(v);
  if (!d) return String(v ?? "");

  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function buildRiskTrendData(rows: Record<string, any>[]) {
  return rows
    .map((row, i) => {
      const rawTime =
        row["slabbed-receive_time"] ||
        row["slabbed-receive-time"] ||
        row["receive_time"] ||
        row["receive-time"] ||
        row["time"];

      const date = parsePADate(rawTime);
      const nbytesBytes = parseNumber(row["nbytes"]);

      return {
        time: date ? date.getTime() : i,
        nbytesBytes,
        nsessValue: getNum(row["nsess"]),
      };
    })
    .sort((a, b) => Number(a.time) - Number(b.time));
}

function extractTable(raw: any): { columns: string[]; rows: Record<string, any>[] } | null {
  if (!raw) return null;

  const entry =
    toArr(raw?.report?.result?.entry) ??
    toArr(raw?.report?.result?.report?.entry) ??
    toArr(raw?.response?.result?.report?.entry) ??
    toArr(raw?.response?.result?.entry) ??
    toArr(raw?.result?.report?.entry) ??
    toArr(raw?.result?.entry) ??
    toArr(raw?.entry);

  if (!entry?.length) return null;

  const colSet = new Set<string>();

  entry.forEach((e) => {
    if (typeof e === "object" && e !== null) {
      Object.keys(e).forEach((k) => {
        if (k === "@name") colSet.add("name");
        else if (!k.startsWith("@")) colSet.add(k);
      });
    }
  });

  const columns = Array.from(colSet);

  const rows = entry.map((e) => {
    const row: Record<string, any> = {};

    columns.forEach((col) => {
      const rk = col === "name" ? "@name" : col;
      const v = e?.[rk] ?? e?.[col];

      row[col] =
        typeof v === "object" && v !== null && "#text" in v
          ? v["#text"]
          : v ?? "";
    });

    return row;
  });

  return { columns, rows };
}

function toArr(v: any): any[] | undefined {
  if (Array.isArray(v) && v.length > 0) return v;
  if (v && typeof v === "object" && !Array.isArray(v)) return [v];
  return undefined;
}