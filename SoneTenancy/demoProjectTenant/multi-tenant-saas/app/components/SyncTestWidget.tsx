"use client";

import { useEffect, useState, useCallback } from "react";

interface TestRow {
  id: number;
  counter: number;
  label: string;
  created_at: string;
}

export default function SyncTestWidget() {
  const [rows, setRows] = useState<TestRow[]>([]);
  const [count, setCount] = useState<number | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rawDebug, setRawDebug] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastFetched, setLastFetched] = useState<string | null>(null);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/sync-test");
      const data = await res.json();
      setRawDebug(JSON.stringify(data, null, 2));
      if (!res.ok) {
        setError(`API error ${res.status}: ${data.message ?? "unknown"}`);
      } else {
        setRows(data.rows ?? []);
        setCount(data.count ?? 0);
        setInfo(data.info ?? null);
      }
      setLastFetched(new Date().toLocaleTimeString());
    } catch (e: any) {
      setError(`Fetch failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch_();
    const interval = setInterval(fetch_, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetch_]);

  const latest = rows[0];

  return (
    <div style={{ border: "2px dashed #f59e0b", borderRadius: 8, padding: 16, background: "#fffbeb", marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <span style={{ fontWeight: 700, fontSize: 14, color: "#92400e" }}>
          [TEST] Background Sync Probe
        </span>
        <button
          onClick={fetch_}
          disabled={loading}
          style={{ fontSize: 12, padding: "4px 12px", borderRadius: 6, background: "#f59e0b", color: "#fff", border: "none", cursor: "pointer", opacity: loading ? 0.6 : 1 }}
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {error && (
        <p style={{ fontSize: 12, color: "#dc2626", margin: "0 0 8px", fontFamily: "monospace" }}>{error}</p>
      )}

      {info && (
        <p style={{ fontSize: 12, color: "#78716c", margin: "0 0 8px" }}>{info}</p>
      )}

      {!info && latest && (
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 11, color: "#78716c", textTransform: "uppercase", letterSpacing: 1 }}>Latest counter</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: "#d97706" }}>{latest.counter}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "#78716c", textTransform: "uppercase", letterSpacing: 1 }}>Written at</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#44403c" }}>{new Date(latest.created_at).toLocaleString()}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "#78716c", textTransform: "uppercase", letterSpacing: 1 }}>Total rows</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#44403c" }}>{count}</div>
          </div>
        </div>
      )}

      {!info && rows.length > 1 && (
        <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ color: "#78716c" }}>
              <th style={{ textAlign: "left", paddingBottom: 4 }}>#</th>
              <th style={{ textAlign: "left", paddingBottom: 4 }}>Counter</th>
              <th style={{ textAlign: "left", paddingBottom: 4 }}>Written at</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} style={{ borderTop: "1px solid #fde68a" }}>
                <td style={{ padding: "3px 0", color: "#a8a29e" }}>{row.id}</td>
                <td style={{ padding: "3px 8px", fontWeight: 600 }}>{row.counter}</td>
                <td style={{ padding: "3px 0", color: "#44403c" }}>{new Date(row.created_at).toLocaleTimeString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* {rawDebug && (
        <pre style={{ fontSize: 11, color: "#44403c", background: "#fef3c7", padding: 8, borderRadius: 4, marginTop: 8, overflow: "auto", maxHeight: 200 }}>{rawDebug}</pre>
      )} */}

      {lastFetched && (
        <p style={{ fontSize: 11, color: "#a8a29e", margin: "8px 0 0" }}>Page fetched at {lastFetched}</p>
      )}
    </div>
  );
}
