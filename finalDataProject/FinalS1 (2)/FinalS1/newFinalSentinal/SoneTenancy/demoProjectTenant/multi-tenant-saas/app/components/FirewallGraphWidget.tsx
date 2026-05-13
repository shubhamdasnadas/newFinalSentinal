"use client";

import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

const CHART_COLORS = ["#6366f1", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6", "#06b6d4"];

export default function FirewallGraphWidget({
  widget,
  onDelete,
}: {
  widget: any;
  onDelete: (id: string) => void;
}) {
  const [raw, setRaw] = useState<any>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!widget?.report_name) return;

    setLoading(true);
    setError("");
    setRaw(null);

    fetch(`/api/firewall/reports/${widget.report_name}`, {
      credentials: "include",
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.message && d.data === undefined) {
          setError(d.message);
        } else {
          setRaw(d.data ?? null);
          setUpdatedAt(d.updatedAt ?? null);
        }
      })
      .catch(() => setError("Network error"))
      .finally(() => setLoading(false));
  }, [widget?.report_name]);

  const table = raw ? extractTable(raw) : null;
  const rows = table?.rows ?? [];

  const xAxisList = parseAxis(widget.x_axis);
  const yAxisList = parseAxis(widget.y_axis);
  const chartType = widget.chart_type || "mixed";

  const chartData = rows
    .slice(0, 30)
    .map((row, index) => {
      const label = xAxisList.length
        ? xAxisList.map((x) => row[x]).filter(Boolean).join(" | ")
        : `Item ${index + 1}`;

      const item: Record<string, any> = {
        label: formatLabel(label),
      };

      yAxisList.forEach((y) => {
        item[y] = getNumber(row[y]);
      });

      return item;
    })
    .filter((item) => yAxisList.some((y) => Number(item[y]) > 0));

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[var(--card-bg)]">
      <div className="drag-handle cursor-grab active:cursor-grabbing bg-[var(--muted-bg)] border-b border-[var(--card-border)] px-4 py-3 flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-xs text-[var(--muted)] font-medium">Palo Alto Firewall</p>
          <p className="text-sm font-bold text-[var(--foreground)] truncate">{widget.report_name}</p>
          <p className="text-[10px] text-[var(--muted)] mt-0.5 truncate">
            X: {xAxisList.join(", ") || "—"} · Y: {yAxisList.join(", ") || "—"}
          </p>
          {updatedAt && (
            <p className="text-[10px] text-[var(--muted)]">
              Updated: {new Date(updatedAt).toLocaleString()}
            </p>
          )}
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(widget.id);
          }}
          className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg px-2 py-1 text-sm"
          title="Delete widget"
        >
          🗑
        </button>
      </div>

      <div className="flex-1 min-h-0 p-3">
        {loading ? (
          <CenterText text="Loading..." />
        ) : error ? (
          <CenterText text={error} danger />
        ) : !xAxisList.length || !yAxisList.length ? (
          <CenterText text="X-Axis or Y-Axis not selected" />
        ) : chartData.length === 0 ? (
          <CenterText text="No numeric data found for selected Y-Axis" />
        ) : yAxisList.length > 1 || chartType === "mixed" ? (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartData}
              margin={{ top: 10, right: 35, left: 10, bottom: 45 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />

              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: "var(--muted)" }}
                angle={-25}
                textAnchor="end"
                height={55}
              />

              <YAxis
                yAxisId="barAxis"
                orientation="left"
                tick={{ fontSize: 10, fill: "var(--muted)" }}
              />

              <YAxis
                yAxisId="lineAxis"
                orientation="right"
                tick={{ fontSize: 10, fill: "var(--muted)" }}
              />

              <Tooltip
                contentStyle={{
                  background: "var(--card-bg)",
                  border: "1px solid var(--card-border)",
                  borderRadius: 8,
                }}
              />

              <Legend wrapperStyle={{ fontSize: 11 }} />

              {yAxisList.map((y, index) =>
                index === 0 ? (
                  <Bar
                    key={y}
                    yAxisId="barAxis"
                    dataKey={y}
                    name={y}
                    fill={CHART_COLORS[index % CHART_COLORS.length]}
                    barSize={28}
                    radius={[4, 4, 0, 0]}
                  />
                ) : (
                  <Line
                    key={y}
                    yAxisId="lineAxis"
                    type="monotone"
                    dataKey={y}
                    name={y}
                    stroke={CHART_COLORS[index % CHART_COLORS.length]}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                )
              )}
            </ComposedChart>
          </ResponsiveContainer>
        ) : chartType === "line" ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 45 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--muted)" }} angle={-25} textAnchor="end" height={55} />
              <YAxis tick={{ fontSize: 10, fill: "var(--muted)" }} />
              <Tooltip contentStyle={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 8 }} />
              <Line type="monotone" dataKey={yAxisList[0]} name={yAxisList[0]} stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 45 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--muted)" }} angle={-25} textAnchor="end" height={55} />
              <YAxis tick={{ fontSize: 10, fill: "var(--muted)" }} />
              <Tooltip contentStyle={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 8 }} />
              <Bar dataKey={yAxisList[0]} name={yAxisList[0]} fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function CenterText({ text, danger }: { text: string; danger?: boolean }) {
  return (
    <div className="h-full flex items-center justify-center text-center px-4">
      <p className={`text-sm font-medium ${danger ? "text-red-500" : "text-[var(--muted)]"}`}>
        {text}
      </p>
    </div>
  );
}

function parseAxis(value: any): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [String(value)];
  } catch {
    return String(value)
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
  }
}

function getNumber(value: any): number {
  if (value === null || value === undefined || value === "") return 0;

  const str = String(value).replace(/,/g, "").trim().toLowerCase();
  const num = parseFloat(str);

  if (Number.isNaN(num)) return 0;

  if (str.includes("tb")) return num * 1_000_000_000_000;
  if (str.includes("gb")) return num * 1_000_000_000;
  if (str.includes("mb")) return num * 1_000_000;
  if (str.includes("kb")) return num * 1_000;

  return num;
}

function formatLabel(value: any) {
  const str = String(value ?? "");

  const d = parsePaloAltoDate(str);
  if (d) {
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return str.length > 18 ? `${str.slice(0, 18)}...` : str;
}

function parsePaloAltoDate(value: any): Date | null {
  if (!value) return null;

  const str = String(value).trim();
  const match = str.match(/^(\d{2})\/(\d{2})\/(\d{4}),?\s+(\d{2}):(\d{2}):(\d{2})$/);

  if (match) {
    const [, dd, mm, yyyy, hh, min, ss] = match;
    return new Date(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(min), Number(ss));
  }

  const d = new Date(str);
  return Number.isNaN(d.getTime()) ? null : d;
}

function extractTable(raw: any) {
  if (!raw) return null;

  const entry =
    toArr(raw?.report?.result?.entry) ??
    toArr(raw?.report?.result?.report?.entry) ??
    toArr(raw?.response?.result?.report?.entry) ??
    toArr(raw?.response?.result?.entry) ??
    toArr(raw?.result?.report?.entry) ??
    toArr(raw?.result?.entry) ??
    toArr(raw?.entry);

  if (!entry || entry.length === 0) return null;

  const colSet = new Set<string>();

  entry.forEach((e: any) => {
    if (typeof e === "object" && e !== null) {
      Object.keys(e).forEach((k) => {
        if (k === "@name") colSet.add("name");
        else if (!k.startsWith("@")) colSet.add(k);
      });
    }
  });

  const columns = Array.from(colSet);

  const rows = entry.map((e: any) => {
    const row: Record<string, any> = {};

    columns.forEach((col) => {
      const key = col === "name" ? "@name" : col;
      const value = e?.[key] ?? e?.[col];

      row[col] =
        typeof value === "object" && value !== null && "#text" in value
          ? value["#text"]
          : value ?? "";
    });

    return row;
  });

  return { columns, rows };
}

function toArr(value: any): any[] | undefined {
  if (Array.isArray(value) && value.length > 0) return value;
  if (value && typeof value === "object" && !Array.isArray(value)) return [value];
  return undefined;
}