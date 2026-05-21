"use client";

import { useEffect, useState } from "react";

const FIREWALL_REPORTS = [
  "bandwidth-trend", "blocked-credential-post","risk-trend", "risky-users",
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

// ─── Helpers ──────────────────────────────────────────────────────────────────
function isTimeCol(col: string) { return /time|date|timestamp/i.test(col); }
function isBytesCol(col: string) { return /byte|bps|bandwidth/i.test(col); }

function extractColumns(raw: any): string[] {
  if (!raw) return [];
  try {
    const result = raw?.response?.result ?? raw?.result;
    if (result && typeof result === "object") {
      const entry = result?.entry;
      const arr = Array.isArray(entry) ? entry : entry ? [entry] : null;
      if (arr?.length) return Object.keys(arr[0]).filter((k) => !k.startsWith("@"));
    }
  } catch {}
  return [];
}

// ─── Props ────────────────────────────────────────────────────────────────────
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

// ─── Main component ───────────────────────────────────────────────────────────
export default function FirewallWidgetPicker({ draft, onChange }: Props) {
  const [columns, setColumns] = useState<string[]>([]);
  const [loadingCols, setLoadingCols] = useState(false);
  const [showX, setShowX] = useState(false);
  const [showY, setShowY] = useState(false);

  // Load columns when report changes
  useEffect(() => {
    if (!draft.reportName) return;
    setLoadingCols(true);
    setColumns([]);
    fetch(`/api/firewall/reports/${draft.reportName}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        const cols = extractColumns(d.data);
        setColumns(cols);
        // Auto-select first time col as X, first numeric col as Y
        if (cols.length && !draft.xAxis.length) {
          const xCol = cols.find((c) => isTimeCol(c)) ?? cols[0];
          const yCol = cols.find((c) => isBytesCol(c) || /count|num|sess|bytes/i.test(c)) ?? cols[1] ?? cols[0];
          onChange({ ...draft, xAxis: [xCol], yAxis: [yCol] });
        }
      })
      .catch(() => {})
      .finally(() => setLoadingCols(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.reportName]);

  const toggleAxis = (col: string, axis: "x" | "y") => {
    const list = axis === "x" ? draft.xAxis : draft.yAxis;
    const key = axis === "x" ? "xAxis" : "yAxis";
    if (list.includes(col)) {
      onChange({ ...draft, [key]: list.filter((v) => v !== col) });
    } else if (list.length < 2) {
      onChange({ ...draft, [key]: [...list, col] });
    }
  };

  return (
    <div className="space-y-4">
      {/* Report selector */}
      <div>
        <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider block mb-1.5">Report</label>
        <select
          value={draft.reportName}
          onChange={(e) => onChange({ ...draft, reportName: e.target.value, xAxis: [], yAxis: [] })}
          className="w-full h-9 border border-[var(--input-border)] rounded-lg px-3 text-sm font-medium text-[var(--foreground)] bg-[var(--card-bg)] focus:outline-none focus:ring-2 focus:ring-orange-400"
        >
          {FIREWALL_REPORTS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      {/* Axis row */}
      <div className="grid grid-cols-2 gap-3">
        {/* X-Axis */}
        <div className="relative">
          <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider block mb-1.5">X-Axis</label>
          <button
            type="button"
            onClick={() => { setShowX((p) => !p); setShowY(false); }}
            className={`w-full h-9 border rounded-lg px-3 text-xs font-medium flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-orange-400 transition-colors ${
              draft.xAxis.length ? "border-blue-400 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" : "border-[var(--input-border)] bg-[var(--card-bg)] text-[var(--muted)]"
            }`}
          >
            <span className="truncate flex-1 text-left">
              {loadingCols ? "Loading…" : draft.xAxis.length === 0 ? "Select column…" : draft.xAxis.length === 1 ? draft.xAxis[0] : `${draft.xAxis.length} selected`}
            </span>
            <svg className="w-3 h-3 flex-shrink-0 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </button>
          {showX && (
            <div className="absolute z-50 top-full mt-1 left-0 right-0 border border-[var(--card-border)] rounded-xl bg-[var(--card-bg)] shadow-2xl overflow-hidden">
              <div className="px-3 py-2 bg-[var(--muted-bg)] border-b border-[var(--card-border)] flex items-center justify-between">
                <span className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider">X-Axis Columns</span>
                {draft.xAxis.length > 0 && <button onClick={() => onChange({ ...draft, xAxis: [] })} className="text-[10px] text-red-500 hover:text-red-700 font-medium">Clear</button>}
              </div>
              {draft.xAxis.length >= 2 && (
                <div className="px-3 py-1.5 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-700 flex items-center gap-1.5">
                  <svg className="w-3 h-3 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
                  <span className="text-[10px] text-amber-700 dark:text-amber-300 font-medium">Max 2 columns. Deselect to change.</span>
                </div>
              )}
              <div className="max-h-44 overflow-auto p-1.5">
                {columns.length === 0 ? <p className="text-xs text-[var(--muted)] px-3 py-2">No columns — select a report first</p>
                  : columns.map((col) => {
                    const isChecked = draft.xAxis.includes(col);
                    const isDisabled = !isChecked && draft.xAxis.length >= 2;
                    return (
                      <label key={col} className={`flex items-center gap-2.5 px-2.5 py-2 text-xs rounded-lg transition-colors ${isDisabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer hover:bg-[var(--muted-bg)]"} ${isChecked ? "text-blue-700 dark:text-blue-300 font-semibold" : "text-[var(--foreground)]"}`}>
                        <input type="checkbox" checked={isChecked} disabled={isDisabled} onChange={() => toggleAxis(col, "x")} className="w-3.5 h-3.5 accent-indigo-500" />
                        <span className="truncate">{col}</span>
                        {isTimeCol(col) && <span className="ml-auto text-[9px] text-indigo-400 font-medium">time</span>}
                      </label>
                    );
                  })}
              </div>
            </div>
          )}
        </div>

        {/* Y-Axis */}
        <div className="relative">
          <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider block mb-1.5">Y-Axis</label>
          <button
            type="button"
            onClick={() => { setShowY((p) => !p); setShowX(false); }}
            className={`w-full h-9 border rounded-lg px-3 text-xs font-medium flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-orange-400 transition-colors ${
              draft.yAxis.length ? "border-emerald-400 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" : "border-[var(--input-border)] bg-[var(--card-bg)] text-[var(--muted)]"
            }`}
          >
            <span className="truncate flex-1 text-left">
              {loadingCols ? "Loading…" : draft.yAxis.length === 0 ? "Select column…" : draft.yAxis.length === 1 ? draft.yAxis[0] : `${draft.yAxis.length} selected`}
            </span>
            <svg className="w-3 h-3 flex-shrink-0 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </button>
          {showY && (
            <div className="absolute z-50 top-full mt-1 left-0 right-0 border border-[var(--card-border)] rounded-xl bg-[var(--card-bg)] shadow-2xl overflow-hidden">
              <div className="px-3 py-2 bg-[var(--muted-bg)] border-b border-[var(--card-border)] flex items-center justify-between">
                <span className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider">Y-Axis Columns</span>
                {draft.yAxis.length > 0 && <button onClick={() => onChange({ ...draft, yAxis: [] })} className="text-[10px] text-red-500 hover:text-red-700 font-medium">Clear</button>}
              </div>
              {draft.yAxis.length >= 2 && (
                <div className="px-3 py-1.5 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-700 flex items-center gap-1.5">
                  <svg className="w-3 h-3 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
                  <span className="text-[10px] text-amber-700 dark:text-amber-300 font-medium">Max 2 columns. Deselect to change.</span>
                </div>
              )}
              <div className="max-h-44 overflow-auto p-1.5">
                {columns.length === 0 ? <p className="text-xs text-[var(--muted)] px-3 py-2">No columns — select a report first</p>
                  : columns.map((col) => {
                    const isChecked = draft.yAxis.includes(col);
                    const isDisabled = !isChecked && draft.yAxis.length >= 2;
                    return (
                      <label key={col} className={`flex items-center gap-2.5 px-2.5 py-2 text-xs rounded-lg transition-colors ${isDisabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer hover:bg-[var(--muted-bg)]"} ${isChecked ? "text-emerald-700 dark:text-emerald-300 font-semibold" : "text-[var(--foreground)]"}`}>
                        <input type="checkbox" checked={isChecked} disabled={isDisabled} onChange={() => toggleAxis(col, "y")} className="w-3.5 h-3.5 accent-indigo-500" />
                        <span className="truncate">{col}</span>
                        {isBytesCol(col) && <span className="ml-auto text-[9px] text-emerald-400 font-medium">bytes</span>}
                      </label>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Chart type */}
      <div>
        <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider block mb-1.5">Chart Type</label>
        <div className="flex rounded-lg border border-[var(--input-border)] overflow-hidden bg-[var(--card-bg)] w-fit">
          {(["bar", "line", "mixed"] as const).map((ct) => (
            <button
              key={ct}
              type="button"
              onClick={() => onChange({ ...draft, chartType: ct })}
              disabled={draft.yAxis.length > 1}
              className={`px-4 py-2 text-xs font-semibold transition-colors border-r last:border-r-0 border-[var(--input-border)] disabled:opacity-40 ${
                (draft.yAxis.length > 1 ? "mixed" : draft.chartType) === ct ? "bg-orange-500 text-white" : "text-[var(--muted)] hover:bg-[var(--muted-bg)]"
              }`}
            >
              {ct === "bar" ? "Bar" : ct === "line" ? "Line" : "Mixed"}
            </button>
          ))}
        </div>
        {draft.yAxis.length > 1 && <p className="text-[10px] text-[var(--muted)] mt-1">Mixed chart auto-selected for multiple Y columns</p>}
      </div>

      {/* Selected pills */}
      {(draft.xAxis.length > 0 || draft.yAxis.length > 0) && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {draft.xAxis.map((x) => (
            <span key={x} className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-700">
              <span className="opacity-60 mr-0.5">X</span>{x}
              <button onClick={() => onChange({ ...draft, xAxis: draft.xAxis.filter((v) => v !== x) })} className="w-3.5 h-3.5 rounded-full hover:bg-blue-200 flex items-center justify-center ml-0.5">×</button>
            </span>
          ))}
          {draft.yAxis.map((y) => (
            <span key={y} className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700">
              <span className="opacity-60 mr-0.5">Y</span>{y}
              <button onClick={() => onChange({ ...draft, yAxis: draft.yAxis.filter((v) => v !== y) })} className="w-3.5 h-3.5 rounded-full hover:bg-emerald-200 flex items-center justify-center ml-0.5">×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
