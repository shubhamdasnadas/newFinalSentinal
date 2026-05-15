"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from "recharts";

interface AnalyticsData {
  pageStats: { _id: string; count: number }[];
  dailyStats: { _id: string; count: number }[];
  totalEvents: number;
  topUsers: { _id: string; count: number }[];
}

const COLORS = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899"];

export default function AnalyticsPage() {
  const { activeOrgSlug, activeOrgName } = useAuth();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeOrgSlug) { setLoading(false); return; }
    fetch("/api/analytics", { credentials: "include" })
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [activeOrgSlug]);

  if (!activeOrgSlug) return (
    <div className="p-8">
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-6">
        <h3 className="font-semibold text-amber-800 dark:text-amber-300">No Organization Selected</h3>
        <p className="text-amber-700 dark:text-amber-400 mt-1 text-sm">Select an organization to view analytics.</p>
      </div>
    </div>
  );

  const maxCount = Math.max(...(data?.dailyStats?.map((d) => d.count) || [1]), 1);

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Analytics</h1>
        <p className="text-[var(--muted)] text-sm mt-1">{activeOrgName} — Usage insights</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            {[
              { label: "Total Events", value: data?.totalEvents ?? 0, color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-50 dark:bg-indigo-900/20" },
              { label: "Unique Pages", value: data?.pageStats?.length ?? 0, color: "text-violet-600 dark:text-violet-400", bg: "bg-violet-50 dark:bg-violet-900/20" },
              { label: "Active Days (7d)", value: data?.dailyStats?.length ?? 0, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-900/20" },
            ].map((s) => (
              <div key={s.label} className={`${s.bg} border border-[var(--card-border)] rounded-2xl p-5`}>
                <p className="text-sm text-[var(--muted)] mb-2">{s.label}</p>
                <p className={`text-4xl font-bold ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Daily chart */}
            <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-6">
              <h3 className="font-semibold text-[var(--foreground)] mb-5">Daily Events (Last 7 Days)</h3>
              {!data?.dailyStats?.length ? (
                <div className="flex flex-col items-center justify-center py-12 text-[var(--muted)]">
                  <svg className="w-10 h-10 mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-sm">No events in the last 7 days</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={data.dailyStats} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
                    <XAxis dataKey="_id" tick={{ fontSize: 11, fill: "var(--muted)" }} />
                    <YAxis tick={{ fontSize: 11, fill: "var(--muted)" }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 8, fontSize: 12 }}
                      labelStyle={{ color: "var(--foreground)" }}
                    />
                    <Line type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2} dot={{ fill: "#6366f1", r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Top pages */}
            <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-6">
              <h3 className="font-semibold text-[var(--foreground)] mb-5">Top Pages</h3>
              {!data?.pageStats?.length ? (
                <div className="flex flex-col items-center justify-center py-12 text-[var(--muted)]">
                  <p className="text-sm">No page data yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {data.pageStats.slice(0, 6).map((p, i) => (
                    <div key={p._id} className="flex items-center gap-3">
                      <span className="w-6 h-6 bg-indigo-100 dark:bg-indigo-900/40 rounded-lg flex items-center justify-center text-xs font-bold text-indigo-600 dark:text-indigo-400 flex-shrink-0">
                        {i + 1}
                      </span>
                      <span className="flex-1 text-sm text-[var(--foreground)] font-mono truncate">{p._id || "/"}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-[var(--muted-bg)] rounded-full h-1.5">
                          <div
                            className="h-1.5 rounded-full bg-indigo-500"
                            style={{ width: `${(p.count / (data.pageStats[0]?.count || 1)) * 100}%` }}
                          />
                        </div>
                        <span className="text-sm font-semibold text-[var(--foreground)] w-6 text-right">{p.count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Top users */}
            {data?.topUsers && data.topUsers.length > 0 && (
              <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-6 lg:col-span-2">
                <h3 className="font-semibold text-[var(--foreground)] mb-5">Most Active Users</h3>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={data.topUsers.slice(0, 8)} margin={{ top: 5, right: 10, left: -20, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
                    <XAxis
                      dataKey="_id"
                      tick={{ fontSize: 10, fill: "var(--muted)" }}
                      angle={-30}
                      textAnchor="end"
                      interval={0}
                    />
                    <YAxis tick={{ fontSize: 11, fill: "var(--muted)" }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 8, fontSize: 12 }}
                      labelStyle={{ color: "var(--foreground)" }}
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {data.topUsers.slice(0, 8).map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
