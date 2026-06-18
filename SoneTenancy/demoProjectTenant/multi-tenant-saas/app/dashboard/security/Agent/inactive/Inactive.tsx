"use client";

import React, { useMemo } from "react";
import {
    PieChart, Pie, Cell,
    BarChart, Bar, LabelList,
    AreaChart, Area,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

export interface InactiveMachine {
    computerName: string;
    user: string;
    site: string;
    lastActiveDate: string;
    inactiveDays: number;
}

// ─── Shared mini-components (self-contained) ───────────────────────────────────

function SectionCard({
    title,
    subtitle,
    icon,
    children,
}: {
    title: string;
    subtitle?: string;
    icon: React.ReactNode;
    children: React.ReactNode;
}) {
    return (
        <div className="bg-[var(--card-bg)] rounded-2xl border border-[var(--card-border)] shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--card-border)] bg-[var(--muted-bg)] flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center flex-shrink-0 text-indigo-600 dark:text-indigo-400">
                    {icon}
                </div>
                <div>
                    <p className="text-sm font-bold text-[var(--foreground)]">{title}</p>
                    {subtitle && <p className="text-xs text-[var(--muted)] mt-0.5">{subtitle}</p>}
                </div>
            </div>
            <div>{children}</div>
        </div>
    );
}

function Empty({ msg }: { msg: string }) {
    return (
        <div className="flex items-center justify-center py-12">
            <p className="text-sm text-[var(--muted)]">{msg}</p>
        </div>
    );
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const SEVERITY_BUCKETS = [
    { name: "7–14d",  min: 7,  max: 14,      color: "#f59e0b" },
    { name: "15–30d", min: 15, max: 30,      color: "#f97316" },
    { name: "31–60d", min: 31, max: 60,      color: "#ef4444" },
    { name: "60+d",   min: 61, max: Infinity, color: "#7f1d1d" },
];

// ─── Widget 1: Total Inactive KPI ─────────────────────────────────────────────

function InactiveTotalKPI({ count }: { count: number }) {
    return (
        <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-5 shadow-sm flex flex-col gap-1">
            <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wide">Inactive Machines</p>
            <p className="text-4xl font-bold text-red-600 dark:text-red-400">{count}</p>
            <p className="text-xs text-[var(--muted)] mt-1">Machines inactive &gt;7 days</p>
        </div>
    );
}

// ─── Widget 6: Average Inactive Days KPI ──────────────────────────────────────

function AvgInactiveDaysKPI({ data }: { data: InactiveMachine[] }) {
    const avg = data.length === 0
        ? "0.0"
        : (data.reduce((s, m) => s + m.inactiveDays, 0) / data.length).toFixed(1);
    return (
        <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-5 shadow-sm flex flex-col gap-1">
            <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wide">Average Inactivity</p>
            <p className="text-4xl font-bold text-orange-600 dark:text-orange-400">{avg}</p>
            <p className="text-xs text-[var(--muted)] mt-1">Days (mean)</p>
        </div>
    );
}

// ─── Widget 8: Status Summary Mini-card ───────────────────────────────────────

function StatusMiniCard({ label, count, color }: { label: string; count: number; color: string }) {
    return (
        <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-5 shadow-sm flex flex-col gap-1">
            <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wide">Inactive</p>
            <p className={`text-4xl font-bold ${color}`}>{count}</p>
            <p className="text-xs text-[var(--muted)] mt-1">{label}</p>
        </div>
    );
}

// ─── Widget 2: Severity Breakdown Donut ───────────────────────────────────────

function SeverityDonutChart({ data }: { data: InactiveMachine[] }) {
    const chartData = useMemo(() =>
        SEVERITY_BUCKETS
            .map(b => ({
                name: b.name,
                value: data.filter(m => m.inactiveDays >= b.min && m.inactiveDays <= b.max).length,
                color: b.color,
            }))
            .filter(b => b.value > 0),
        [data]
    );
    const total = chartData.reduce((s, b) => s + b.value, 0);

    return (
        <SectionCard
            title="Severity Breakdown"
            subtitle="Inactive duration buckets"
            icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                </svg>
            }
        >
            {data.length === 0 ? <Empty msg="No inactive machines" /> : (
                <div className="p-4">
                    <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                            <Pie
                                data={chartData}
                                cx="50%"
                                cy="50%"
                                innerRadius={55}
                                outerRadius={85}
                                dataKey="value"
                                paddingAngle={2}
                            >
                                {chartData.map((entry, i) => (
                                    <Cell key={i} fill={entry.color} />
                                ))}
                            </Pie>
                            <Tooltip
                                formatter={(value) => {
                                    const n = Number(value ?? 0);
                                    return [`${n} (${total > 0 ? ((n / total) * 100).toFixed(0) : 0}%)`, "Machines"];
                                }}
                            />
                            <Legend />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            )}
        </SectionCard>
    );
}

// ─── Widget 3: Inactive by Site ───────────────────────────────────────────────

function InactiveBySiteChart({ data }: { data: InactiveMachine[] }) {
    const chartData = useMemo(() => {
        const map: Record<string, number> = {};
        data.forEach(m => { map[m.site] = (map[m.site] || 0) + 1; });
        return Object.entries(map)
            .map(([site, count]) => ({ site, count }))
            .sort((a, b) => b.count - a.count);
    }, [data]);

    const barH = Math.max(160, chartData.length * 44);

    return (
        <SectionCard
            title="By Site"
            subtitle="Inactive machines per site"
            icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
            }
        >
            {data.length === 0 ? <Empty msg="No site data" /> : (
                <div className="p-4 overflow-x-auto flex items-center justify-center ">
                    <ResponsiveContainer width="100%" height={barH}>
                        <BarChart layout="vertical" data={chartData} margin={{ top: 15, right: 48, bottom: 4, left: 4 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                            <YAxis type="category" dataKey="site" tick={{ fontSize: 11 }} width={115} />
                            <Tooltip />
                            <Bar dataKey="count" name="Machines" fill="#6366f1" radius={[0, 4, 4, 0]}>
                                <LabelList dataKey="count" position="right" style={{ fontSize: 11 }} />
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )}
        </SectionCard>
    );
}

// ─── Widget 4: Oldest Inactive Machines (Top 5) ───────────────────────────────

function OldestInactiveList({ data }: { data: InactiveMachine[] }) {
    const top5 = data.slice(0, 5);
    return (
        <SectionCard
            title="Oldest Inactive Machines"
            subtitle="Top 5 by inactive days"
            icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            }
        >
            {top5.length === 0 ? <Empty msg="No inactive machines" /> : (
                <div className="p-4 space-y-3">
                    {top5.map((m, i) => (
                        <div key={i} className="flex items-center gap-3">
                            <span className={`text-sm font-bold w-10 text-right flex-shrink-0 tabular-nums ${m.inactiveDays > 30 ? "text-red-600 dark:text-red-400" : "text-orange-600 dark:text-orange-400"}`}>
                                {m.inactiveDays}d
                            </span>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-[var(--foreground)] truncate">{m.computerName}</p>
                                <p className="text-xs text-[var(--muted)] truncate">{m.site} · {m.user}</p>
                            </div>
                            <div className="h-2 rounded-full bg-[var(--muted-bg)] w-16 flex-shrink-0">
                                <div
                                    className="h-2 rounded-full"
                                    style={{
                                        width: `${Math.min((m.inactiveDays / (top5[0]?.inactiveDays || 1)) * 100, 100)}%`,
                                        backgroundColor: m.inactiveDays > 30 ? "#ef4444" : "#f97316",
                                    }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </SectionCard>
    );
}

// ─── Widget 5: User Ownership ─────────────────────────────────────────────────

function UserOwnershipChart({ data }: { data: InactiveMachine[] }) {
    const chartData = useMemo(() => {
        const map: Record<string, number> = {};
        data.forEach(m => { map[m.user] = (map[m.user] || 0) + 1; });
        return Object.entries(map)
            .map(([user, count]) => ({ user, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
    }, [data]);

    const barH = Math.max(160, chartData.length * 44);

    return (
        <SectionCard
            title="By User"
            subtitle="Inactive machines per user (top 10)"
            icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
            }
        >
            {data.length === 0 ? <Empty msg="No user data" /> : (
                <div className="p-4 overflow-x-auto">
                    <ResponsiveContainer width="100%" height={barH}>
                        <BarChart layout="vertical" data={chartData} margin={{ top: 4, right: 48, bottom: 4, left: 4 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                            <YAxis type="category" dataKey="user" tick={{ fontSize: 11 }} width={115} />
                            <Tooltip />
                            <Bar dataKey="count" name="Machines" fill="#8b5cf6" radius={[0, 4, 4, 0]}>
                                <LabelList dataKey="count" position="right" style={{ fontSize: 11 }} />
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )}
        </SectionCard>
    );
}

// ─── Widget 7: Last Active Timeline ───────────────────────────────────────────

function LastActiveTimeline({ data }: { data: InactiveMachine[] }) {
    const chartData = useMemo(() => {
        const map: Record<string, number> = {};
        data.forEach(m => {
            if (m.lastActiveDate && m.lastActiveDate !== "—") {
                map[m.lastActiveDate] = (map[m.lastActiveDate] || 0) + 1;
            }
        });
        return Object.entries(map)
            .map(([date, count]) => ({ date, count }))
            .sort((a, b) => a.date.localeCompare(b.date));
    }, [data]);

    return (
        <SectionCard
            title="Last Active Timeline"
            subtitle="Machines grouped by last active date"
            icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
            }
        >
            {chartData.length === 0 ? <Empty msg="No date data available" /> : (
                <div className="p-4">
                    <ResponsiveContainer width="100%" height={210}>
                        <AreaChart data={chartData} margin={{ top: 8, right: 16, bottom: 28, left: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" interval="preserveStartEnd" />
                            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                            <Tooltip />
                            <Area type="monotone" dataKey="count" name="Machines" stroke="#6366f1" fill="#6366f1" fillOpacity={0.15} strokeWidth={2} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            )}
        </SectionCard>
    );
}

// ─── Root export ──────────────────────────────────────────────────────────────

export function InactiveDashboardWidgets({ data }: { data: InactiveMachine[] }) {
    const b714    = data.filter(m => m.inactiveDays >= 7  && m.inactiveDays <= 14).length;
    const b1530   = data.filter(m => m.inactiveDays >= 15 && m.inactiveDays <= 30).length;
    const b30plus = data.filter(m => m.inactiveDays > 30).length;

    return (
        <div className="space-y-4">
            {/* Row 1: KPI + status summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 gap-3">
                <InactiveTotalKPI count={data.length} />
                <AvgInactiveDaysKPI data={data} />
                {/*<StatusMiniCard label="7–14d"  count={b714}    color="text-yellow-600 dark:text-yellow-400" />
                <StatusMiniCard label="15–30d" count={b1530}   color="text-orange-600 dark:text-orange-400" />
                <StatusMiniCard label="30+d"   count={b30plus} color="text-red-600 dark:text-red-400" />*/}
            </div>
            {/* Row 2: Donut + Oldest list */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <SeverityDonutChart data={data} />
                <OldestInactiveList data={data} />
                  <InactiveBySiteChart data={data} />
            </div>
            {/* Row 3: Site bar + User bar */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
                {/* <UserOwnershipChart data={data} /> */}
            </div>
            {/* Row 4: Timeline */}
            {/* <LastActiveTimeline data={data} /> */}
        </div>
    );
}

