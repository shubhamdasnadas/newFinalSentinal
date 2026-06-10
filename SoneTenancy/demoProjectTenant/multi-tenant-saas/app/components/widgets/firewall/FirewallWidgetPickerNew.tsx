"use client";

import { useEffect, useState } from "react";
import { BarChart, Bar, LineChart, Line, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

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

const REPORT_DESCRIPTIONS: Record<string, string> = {
    "bandwidth-trend": "Bandwidth usage over time",
    "blocked-credential-post": "Blocked credential attempts",
    "risk-trend": "Risk events timeline",
    "risky-users": "Users with risky activity",
    "top-attacks": "Most common attack types",
    "top-applications": "Most used applications",
    "top-sources": "Traffic sources",
    "top-destinations": "Traffic destinations",
    "top-users": "Most active users",
};

function isTimeCol(col: string) { return /time|date|timestamp/i.test(col); }
function isBytesCol(col: string) { return /byte|bps|bandwidth/i.test(col); }

interface TableData {
    columns: string[];
    rows: Record<string, any>[];
}

function toArr(v: any): any[] | undefined {
    if (Array.isArray(v) && v.length > 0) return v;
    if (v && typeof v === "object" && !Array.isArray(v)) return [v];
    return undefined;
}

function extractTable(raw: any): TableData {
    if (!raw) return { columns: [], rows: [] };
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
            entry.forEach((item) => {
                if (typeof item !== "object" || item === null) return;
                Object.keys(item).forEach((key) => {
                    if (key === "@name") colSet.add("name");
                    else if (!key.startsWith("@")) colSet.add(key);
                });
            });

            const columns = Array.from(colSet);
            const rows = entry.map((item) => {
                const row: Record<string, any> = {};
                columns.forEach((col) => {
                    const rawKey = col === "name" ? "@name" : col;
                    const value = item?.[rawKey] ?? item?.[col];
                    row[col] = typeof value === "object" && value !== null && "#text" in value ? value["#text"] : value ?? "";
                });
                return row;
            });

            return { columns, rows };
        }

        const result = raw?.report?.result ?? raw?.response?.result ?? raw?.result;
        if (result && typeof result === "object") {
            const columns = Object.keys(result).filter((key) => !key.startsWith("@") && typeof result[key] !== "object");
            if (columns.length > 0) {
                return { columns, rows: [Object.fromEntries(columns.map((key) => [key, result[key]]))] };
            }
        }
    } catch { }
    return { columns: [], rows: [] };
}

export interface FirewallWidgetDraft {
    reportName: string;
    xAxis: string[];
    yAxis: string[];
    chartType: "bar" | "line" | "mixed";
}

interface Props {
    draft: FirewallWidgetDraft;
    onChange: (d: FirewallWidgetDraft) => void;
}

export default function FirewallWidgetPickerNew({ draft, onChange }: Props) {
    const [columns, setColumns] = useState<string[]>([]);
    const [loadingCols, setLoadingCols] = useState(false);
    const [showX, setShowX] = useState(false);
    const [showY, setShowY] = useState(false);
    const [previewData, setPreviewData] = useState<any[]>([]);
    const [viewMode, setViewMode] = useState<"chart" | "table">("chart");
    const [error, setError] = useState<string>("");

    useEffect(() => {
        if (!draft.reportName) return;
        setLoadingCols(true);
        setColumns([]);
        setPreviewData([]);
        setError("");
        fetch(`/api/firewall/reports/${draft.reportName}`, { credentials: "include" })
            .then((r) => {
                if (!r.ok) throw new Error(`HTTP ${r.status}: ${r.statusText}`);
                return r.json();
            })
            .then((d) => {
                console.log("Firewall report response:", d);
                const table = extractTable(d.data);
                setColumns(table.columns);

                if (table.columns.length && (!draft.xAxis.length || !draft.yAxis.length)) {
                    const xCol = draft.xAxis[0] ?? table.columns.find((c) => isTimeCol(c)) ?? table.columns[0];
                    const yCol = draft.yAxis[0] ?? table.columns.find((c) => c !== xCol && (isBytesCol(c) || /count|num|sess|bytes/i.test(c))) ?? table.columns.find((c) => c !== xCol) ?? table.columns[0];
                    onChange({ ...draft, xAxis: [xCol], yAxis: [yCol] });
                }

                if (table.rows.length === 0) setError("No data available for this report");
                setPreviewData(table.rows.slice(0, 20));
            })
            .catch((err) => {
                console.error("Error fetching firewall report:", err);
                setError(err.message || "Failed to load report data. Please try again.");
            })
            .finally(() => setLoadingCols(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [draft.reportName]);

    const toggleAxis = (col: string, axis: "x" | "y") => {
        const list = axis === "x" ? draft.xAxis : draft.yAxis;
        const key = axis === "x" ? "xAxis" : "yAxis";
        if (list.includes(col)) {
            onChange({ ...draft, [key]: list.filter((v) => v !== col) });
        } else if (axis === "x" || list.length < 2) {
            if (axis === "x") {
                onChange({ ...draft, [key]: [col] });
            } else {
                onChange({ ...draft, [key]: [...list, col] });
            }
        }
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                setShowX(false);
                setShowY(false);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    return (
        <div className="space-y-3 max-h-[80vh] overflow-y-auto px-1">
            {/* Report selector */}
            <div>
                <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider block mb-1.5">Report</label>
                <div className="relative">
                    <select value={draft.reportName} onChange={(e) => onChange({ ...draft, reportName: e.target.value, xAxis: [], yAxis: [] })} className="w-full h-9 border border-[var(--input-border)] rounded-lg px-3 text-sm font-medium text-[var(--foreground)] bg-[var(--card-bg)] focus:outline-none focus:ring-2 focus:ring-orange-400 appearance-none cursor-pointer">
                        <option value="">Select a report...</option>
                        {FIREWALL_REPORTS.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <svg className="absolute right-3 top-2.5 w-4 h-4 pointer-events-none text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </div>
                {draft.reportName && REPORT_DESCRIPTIONS[draft.reportName] && (
                    <p className="text-[9px] text-[var(--muted)] mt-1.5 opacity-75">{REPORT_DESCRIPTIONS[draft.reportName]}</p>
                )}
            </div>

            {/* Axes */}
            <div className="grid grid-cols-2 gap-3">
                {/* X-Axis */}
                <div className="relative">
                    <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider block mb-1.5">X-Axis <span className="text-red-500">*</span></label>
                    <button type="button" onClick={() => { setShowX(!showX); setShowY(false); }} className={`w-full h-9 border rounded-lg px-3 text-xs font-medium flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-orange-400 transition-colors ${draft.xAxis.length ? "border-blue-400 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" : "border-[var(--input-border)] bg-[var(--card-bg)] text-[var(--muted)]"}`}>
                        <span className="truncate flex-1 text-left">{loadingCols ? "Loading…" : draft.xAxis.length === 0 ? "Select…" : draft.xAxis[0]}</span>
                        <svg className="w-3 h-3 flex-shrink-0 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                    {showX && (
                        <div className="absolute z-50 top-full mt-1 left-0 right-0 border border-[var(--card-border)] rounded-xl bg-[var(--card-bg)] shadow-2xl overflow-hidden max-h-48 overflow-y-auto">
                            <div className="px-3 py-2 bg-[var(--muted-bg)] border-b border-[var(--card-border)] flex items-center justify-between sticky top-0">
                                <span className="text-[10px] font-bold text-[var(--muted)] uppercase">X-Axis</span>
                                {draft.xAxis.length > 0 && <button onClick={() => onChange({ ...draft, xAxis: [] })} className="text-[10px] text-red-500 font-medium">Clear</button>}
                            </div>
                            <div className="p-1.5">
                                {columns.length === 0 ? <p className="text-xs text-[var(--muted)] px-2 py-2">No columns</p>
                                    : columns.map((col) => (
                                        <label key={col} className={`flex items-center gap-2 px-2.5 py-2 text-xs rounded-lg cursor-pointer hover:bg-[var(--muted-bg)] ${draft.xAxis.includes(col) ? "text-blue-700 dark:text-blue-300 font-semibold" : ""}`}>
                                            <input type="radio" checked={draft.xAxis.includes(col)} onChange={() => onChange({ ...draft, xAxis: [col] })} className="w-3 h-3" />
                                            <span className="truncate">{col}</span>
                                            {isTimeCol(col) && <span className="ml-auto text-[9px] opacity-60">📅</span>}
                                        </label>
                                    ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Y-Axis */}
                <div className="relative">
                    <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider block mb-1.5">Y-Axis <span className="text-red-500">*</span></label>
                    <button type="button" onClick={() => { setShowY(!showY); setShowX(false); }} className={`w-full h-9 border rounded-lg px-3 text-xs font-medium flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-orange-400 transition-colors ${draft.yAxis.length ? "border-emerald-400 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" : "border-[var(--input-border)] bg-[var(--card-bg)] text-[var(--muted)]"}`}>
                        <span className="truncate flex-1 text-left">{loadingCols ? "Loading…" : draft.yAxis.length === 0 ? "Select…" : `${draft.yAxis.length} selected`}</span>
                        <svg className="w-3 h-3 flex-shrink-0 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                    {showY && (
                        <div className="absolute z-50 top-full mt-1 left-0 right-0 border border-[var(--card-border)] rounded-xl bg-[var(--card-bg)] shadow-2xl overflow-hidden max-h-48 overflow-y-auto">
                            <div className="px-3 py-2 bg-[var(--muted-bg)] border-b border-[var(--card-border)] flex items-center justify-between sticky top-0">
                                <span className="text-[10px] font-bold text-[var(--muted)] uppercase">Y-Axis</span>
                                {draft.yAxis.length > 0 && <button onClick={() => onChange({ ...draft, yAxis: [] })} className="text-[10px] text-red-500 font-medium">Clear</button>}
                            </div>
                            <div className="p-1.5">
                                {columns.length === 0 ? <p className="text-xs text-[var(--muted)] px-2 py-2">No columns</p>
                                    : columns.map((col) => {
                                        const isChecked = draft.yAxis.includes(col);
                                        return (
                                            <label key={col} className={`flex items-center gap-2 px-2.5 py-2 text-xs rounded-lg cursor-pointer hover:bg-[var(--muted-bg)] ${isChecked ? "text-emerald-700 dark:text-emerald-300 font-semibold" : ""}`}>
                                                <input type="checkbox" checked={isChecked} onChange={() => toggleAxis(col, "y")} disabled={!isChecked && draft.yAxis.length >= 2} className="w-3 h-3" />
                                                <span className="truncate">{col}</span>
                                                {isBytesCol(col) && <span className="ml-auto text-[9px] opacity-60">📊</span>}
                                            </label>
                                        );
                                    })}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Chart Type */}
            <div>
                <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider block mb-1.5">Chart Type</label>
                <div className="flex rounded-lg border border-[var(--input-border)] overflow-hidden bg-[var(--card-bg)] w-fit">
                    {(["bar", "line", "mixed"] as const).map((ct) => (
                        <button key={ct} type="button" onClick={() => onChange({ ...draft, chartType: ct })} disabled={draft.yAxis.length > 1 && ct !== "mixed"} className={`px-3 py-1.5 text-xs font-semibold border-r last:border-r-0 border-[var(--input-border)] disabled:opacity-40 ${(draft.yAxis.length > 1 ? "mixed" : draft.chartType) === ct ? "bg-orange-500 text-white" : "text-[var(--muted)] hover:bg-[var(--muted-bg)]"}`}>
                            {ct === "bar" ? "Bar" : ct === "line" ? "Line" : "Mixed"}
                        </button>
                    ))}
                </div>
            </div>

            {/* Selected Columns */}
            {(draft.xAxis.length > 0 || draft.yAxis.length > 0) && (
                <div className="flex flex-wrap gap-1.5">
                    {draft.xAxis.map((x) => (
                        <span key={x} className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full text-[9px] font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                            <span>X</span>{x}
                            <button onClick={() => onChange({ ...draft, xAxis: [] })} className="ml-0.5">×</button>
                        </span>
                    ))}
                    {draft.yAxis.map((y) => (
                        <span key={y} className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full text-[9px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                            <span>Y</span>{y}
                            <button onClick={() => onChange({ ...draft, yAxis: draft.yAxis.filter((v) => v !== y) })} className="ml-0.5">×</button>
                        </span>
                    ))}
                </div>
            )}

            {/* PREVIEW SECTION - NOW ALWAYS VISIBLE! */}
            {draft.xAxis.length > 0 && draft.yAxis.length > 0 && (
                <div className="mt-3 pt-3 border-t border-[var(--card-border)]">
                    <div className="flex items-center justify-between gap-2 mb-2">
                        <p className="text-[10px] font-bold text-[var(--muted)] uppercase">📊 Preview</p>
                        {previewData.length > 0 && (
                            <div className="flex gap-1 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-lg p-0.5">
                                <button type="button" onClick={() => setViewMode("chart")} className={`px-2 py-0.5 text-[9px] font-semibold rounded ${viewMode === "chart" ? "bg-orange-500 text-white" : "text-[var(--muted)]"}`}>Chart</button>
                                <button type="button" onClick={() => setViewMode("table")} className={`px-2 py-0.5 text-[9px] font-semibold rounded ${viewMode === "table" ? "bg-orange-500 text-white" : "text-[var(--muted)]"}`}>Table</button>
                            </div>
                        )}
                    </div>

                    {error && (
                        <div className="mb-2 px-2 py-1.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded text-[9px] text-red-700 dark:text-red-300">
                            {error}
                        </div>
                    )}

                    {previewData.length === 0 ? (
                        <div className="h-40 bg-[var(--muted-bg)] rounded border border-dashed border-[var(--card-border)] flex items-center justify-center">
                            <div className="text-center">
                                <p className="text-[9px] text-[var(--muted)]">Loading chart data...</p>
                            </div>
                        </div>
                    ) : viewMode === "chart" ? (
                        <div className="h-44 bg-[var(--muted-bg)] rounded border border-[var(--card-border)] p-2 overflow-hidden">
                            <ResponsiveContainer width="100%" height="100%">
                                {draft.chartType === "bar" ? (
                                    <BarChart data={previewData} margin={{ top: 5, right: 10, left: -15, bottom: 20 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" vertical={false} />
                                        <XAxis dataKey={draft.xAxis[0]} tick={{ fontSize: 10, fill: "var(--muted)" }} angle={-45} textAnchor="end" height={50} />
                                        <YAxis tick={{ fontSize: 10, fill: "var(--muted)" }} width={40} />
                                        <Tooltip contentStyle={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: "4px", fontSize: "11px" }} />
                                        {draft.yAxis.map((key, i) => (
                                            <Bar key={key} dataKey={key} fill={["#3b82f6", "#f97316", "#10b981"][i % 3]} radius={[3, 3, 0, 0]} />
                                        ))}
                                    </BarChart>
                                ) : draft.chartType === "line" ? (
                                    <LineChart data={previewData} margin={{ top: 5, right: 10, left: -15, bottom: 20 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" vertical={false} />
                                        <XAxis dataKey={draft.xAxis[0]} tick={{ fontSize: 10, fill: "var(--muted)" }} angle={-45} textAnchor="end" height={50} />
                                        <YAxis tick={{ fontSize: 10, fill: "var(--muted)" }} width={40} />
                                        <Tooltip contentStyle={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: "4px", fontSize: "11px" }} />
                                        <Legend wrapperStyle={{ fontSize: "10px", paddingTop: "8px" }} />
                                        {draft.yAxis.map((key, i) => (
                                            <Line key={key} type="monotone" dataKey={key} stroke={["#3b82f6", "#f97316", "#10b981"][i % 3]} dot={false} strokeWidth={2} />
                                        ))}
                                    </LineChart>
                                ) : (
                                    <ComposedChart data={previewData} margin={{ top: 5, right: 10, left: -15, bottom: 20 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" vertical={false} />
                                        <XAxis dataKey={draft.xAxis[0]} tick={{ fontSize: 10, fill: "var(--muted)" }} angle={-45} textAnchor="end" height={50} />
                                        <YAxis tick={{ fontSize: 10, fill: "var(--muted)" }} width={40} />
                                        <Tooltip contentStyle={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: "4px", fontSize: "11px" }} />
                                        <Legend wrapperStyle={{ fontSize: "10px", paddingTop: "8px" }} />
                                        {draft.yAxis.map((key, i) => i === 0 ? (
                                            <Bar key={key} dataKey={key} fill="#3b82f6" radius={[3, 3, 0, 0]} />
                                        ) : (
                                            <Line key={key} type="monotone" dataKey={key} stroke={["#f97316", "#10b981"][(i - 1) % 2]} dot={false} strokeWidth={2} />
                                        ))}
                                    </ComposedChart>
                                )}
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="max-h-44 overflow-auto rounded border border-[var(--card-border)] bg-[var(--muted-bg)] text-[8px]">
                            <table className="w-full">
                                <thead className="sticky top-0 bg-[var(--card-bg)] border-b border-[var(--card-border)]">
                                    <tr>
                                        <th className="px-2 py-1 text-left font-semibold text-[var(--muted)]">#</th>
                                        {[draft.xAxis[0], ...draft.yAxis].map((col) => (
                                            <th key={col} className="px-2 py-1 text-left font-semibold text-[var(--foreground)]">{col}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {previewData.map((row, idx) => (
                                        <tr key={idx} className="border-b border-[var(--card-border)] hover:bg-[var(--card-bg)]">
                                            <td className="px-2 py-1 text-[var(--muted)]">{idx + 1}</td>
                                            {[draft.xAxis[0], ...draft.yAxis].map((col) => (
                                                <td key={col} className="px-2 py-1 text-[var(--foreground)] truncate">{typeof row[col] === "number" ? row[col].toLocaleString() : String(row[col] ?? "-")}</td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    <p className="text-[8px] text-[var(--muted)] mt-1">{previewData.length} records • {viewMode === "table" ? "Table view" : "First 20 rows"}</p>
                </div>
            )}
        </div>
    );
}
