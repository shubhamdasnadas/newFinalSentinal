"use client";

import { useState, useEffect } from "react";

export default function FirewallTableWidget({
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

  return (
    <div className="bg-[var(--card-bg)] rounded-2xl border border-[var(--card-border)] shadow-sm flex flex-col overflow-hidden">
      <div className="drag-handle cursor-grab active:cursor-grabbing bg-[var(--muted-bg)] border-b border-[var(--card-border)] px-4 py-3 flex items-start justify-between flex-shrink-0 select-none">
        <div>
          <p className="text-xs text-[var(--muted)] font-medium">Palo Alto Firewall</p>
          <p className="text-sm font-bold text-[var(--foreground)]">{widget.report_name}</p>
          {updatedAt && (
            <p className="text-xs text-[var(--muted)] mt-1">
              Updated: {new Date(updatedAt).toLocaleString()}
            </p>
          )}
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(widget.id);
          }}
          className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg p-2"
          title="Delete widget"
        >
          🗑
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        {loading ? (
          <LoadingSpinner />
        ) : error ? (
          <ErrorMsg msg={error} />
        ) : !raw ? (
          <EmptyMsg msg="No data found" />
        ) : table && table.rows.length > 0 ? (
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 z-10">
              <tr>
                {table.columns.map((col) => (
                  <th
                    key={col}
                    className="text-left px-4 py-3 font-semibold text-[var(--muted)] border border-[var(--card-border)] bg-[var(--muted-bg)] whitespace-nowrap"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {table.rows.map((row, ri) => (
                <tr
                  key={ri}
                  className={ri % 2 === 0 ? "bg-[var(--card-bg)]" : "bg-[var(--muted-bg)]"}
                >
                  {table.columns.map((col) => (
                    <td
                      key={col}
                      className="px-4 py-3 text-[var(--muted)] border border-[var(--card-border)] whitespace-nowrap"
                    >
                      {formatCell(col, row[col])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <pre className="text-xs text-[var(--muted)] bg-[var(--muted-bg)] rounded-xl p-3 overflow-auto whitespace-pre-wrap">
            {JSON.stringify(raw, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}

// ─── Helper components ────────────────────────────────────────────────────────

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center h-full py-12">
      <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
    </div>
  );
}

function ErrorMsg({ msg }: { msg: string }) {
  return (
    <div className="flex items-center justify-center h-full py-12 text-center px-4">
      <p className="text-sm text-red-500 font-medium">{msg}</p>
    </div>
  );
}

function EmptyMsg({ msg }: { msg: string }) {
  return (
    <div className="flex items-center justify-center h-full py-12">
      <p className="text-sm text-[var(--muted)]">{msg}</p>
    </div>
  );
}

// ─── Table extraction ─────────────────────────────────────────────────────────

interface TableData {
  columns: string[];
  rows: Record<string, unknown>[];
}

function extractTable(raw: unknown): TableData | null {
  if (!raw) return null;
  try {
    const entry: unknown[] | undefined =
      toArr((raw as any)?.report?.result?.entry) ??
      toArr((raw as any)?.report?.result?.report?.entry) ??
      toArr((raw as any)?.response?.result?.report?.entry) ??
      toArr((raw as any)?.response?.result?.entry) ??
      toArr((raw as any)?.result?.report?.entry) ??
      toArr((raw as any)?.result?.entry) ??
      toArr((raw as any)?.entry);

    if (entry && entry.length > 0) {
      const colSet = new Set<string>();
      entry.forEach((e) => {
        if (typeof e === "object" && e !== null) {
          Object.keys(e as object).forEach((k) => {
            if (k === "@name") colSet.add("name");
            else if (!k.startsWith("@")) colSet.add(k);
          });
        }
      });
      if (colSet.size === 0) return null;
      const columns = Array.from(colSet);
      const rows = entry.map((e) => {
        const row: Record<string, unknown> = {};
        columns.forEach((col) => {
          const rk = col === "name" ? "@name" : col;
          const v = (e as any)?.[rk] ?? (e as any)?.[col];
          row[col] =
            typeof v === "object" && v !== null && "#text" in v
              ? (v as any)["#text"]
              : v ?? "";
        });
        return row;
      });
      return { columns, rows };
    }

    const result =
      (raw as any)?.report?.result ??
      (raw as any)?.response?.result ??
      (raw as any)?.result;
    if (result && typeof result === "object") {
      const keys = Object.keys(result).filter(
        (k) => !k.startsWith("@") && typeof result[k] !== "object"
      );
      if (keys.length > 0)
        return {
          columns: keys,
          rows: [Object.fromEntries(keys.map((k) => [k, result[k]]))],
        };
    }
  } catch {
    // ignore parse errors
  }
  return null;
}

function toArr(v: unknown): unknown[] | undefined {
  if (Array.isArray(v) && v.length > 0) return v;
  if (v && typeof v === "object" && !Array.isArray(v)) return [v];
  return undefined;
}

// ─── Cell formatter ───────────────────────────────────────────────────────────

function formatCell(col: string, val: unknown): string {
  if (val === null || val === undefined || val === "") return "—";
  const str = String(val);
  if (col.includes("time") || col.includes("date")) {
    const ts = Number(val);
    if (!isNaN(ts) && ts > 1_000_000_000)
      return new Date(ts * 1000).toLocaleString();
    if (str.includes("T") || (str.includes("-") && str.length >= 10)) {
      const d = new Date(str);
      if (!isNaN(d.getTime())) return d.toLocaleString();
    }
    return str;
  }
  if (col === "nbytes" || col.includes("byte")) {
    const n = Number(val);
    if (!isNaN(n)) {
      if (n >= 1e12) return (n / 1e12).toFixed(2) + " TB";
      if (n >= 1e9) return (n / 1e9).toFixed(2) + " GB";
      if (n >= 1e6) return (n / 1e6).toFixed(2) + " MB";
      if (n >= 1e3) return (n / 1e3).toFixed(2) + " KB";
      return n + " B";
    }
  }
  const n = Number(val);
  if (!isNaN(n) && str === String(n) && n > 999) return n.toLocaleString();
  return str;
}
