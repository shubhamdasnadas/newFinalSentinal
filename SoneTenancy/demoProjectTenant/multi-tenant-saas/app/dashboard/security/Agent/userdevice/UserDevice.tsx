"use client";

import React, { useMemo } from "react";
import {
    PieChart, Pie, Cell,
    BarChart, Bar, LabelList,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

export interface UserDeviceMapping {
    user: string;
    totalDevices: number;
    active: number;
    inactive: number;
    devices: string[];
}

// ─── Shared mini-components ────────────────────────────────────────────────────

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

// ─── Widget 1: Total Devices KPI ──────────────────────────────────────────────

function TotalDevicesKPI({ total }: { total: number }) {
    return (
        <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-5 shadow-sm flex flex-col gap-1">
            <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wide">Total Devices</p>
            <p className="text-4xl font-bold text-[var(--foreground)]">{total}</p>
            <p className="text-xs text-[var(--muted)] mt-1">Across all users</p>
        </div>
    );
}

// ─── Widget 4: Fleet Health Score KPI ─────────────────────────────────────────

function FleetHealthKPI({ active, total }: { active: number; total: number }) {
    const pct = total === 0 ? 0 : (active / total) * 100;
    const color =
        pct >= 80 ? "text-green-600 dark:text-green-400"
        : pct >= 60 ? "text-orange-600 dark:text-orange-400"
        : "text-red-600 dark:text-red-400";
    return (
        <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-5 shadow-sm flex flex-col gap-1">
            <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wide">Fleet Health</p>
            <p className={`text-4xl font-bold ${color}`}>{pct.toFixed(1)}%</p>
            <p className="text-xs text-[var(--muted)] mt-1">% of active devices</p>
        </div>
    );
}

// ─── Widget 2: Active vs Inactive Donut ───────────────────────────────────────

const DONUT_COLORS = ["#10b981", "#ef4444"];

function ActiveInactiveDonut({ active, inactive }: { active: number; inactive: number }) {
    const chartData = [
        { name: "Active",   value: active },
        { name: "Inactive", value: inactive },
    ].filter(d => d.value > 0);

    const total = active + inactive;

    return (
        <SectionCard
            title="Active vs Inactive"
            subtitle="Device activity breakdown"
            icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
            }
        >
            {total === 0 ? <Empty msg="No device data" /> : (
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
                                {chartData.map((_, i) => (
                                    <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip
                                formatter={(value) => {
                                    const n = Number(value ?? 0);
                                    return [`${n} (${total > 0 ? ((n / total) * 100).toFixed(0) : 0}%)`, "Devices"];
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

// ─── Widget 3: Top 5 Users by Device Count ────────────────────────────────────

function TopUsersByDeviceChart({ data }: { data: UserDeviceMapping[] }) {
    const chartData = useMemo(() =>
        [...data]
            .sort((a, b) => b.totalDevices - a.totalDevices)
            .slice(0, 5)
            .map(u => ({ user: u.user, count: u.totalDevices })),
        [data]
    );

    const barH = Math.max(160, chartData.length * 48);

    return (
        <SectionCard
            title="Top 5 Users by Device Count"
            subtitle="Users with the most devices"
            icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
            }
        >
            {data.length === 0 ? <Empty msg="No user data" /> : (
                <div className="p-4 overflow-x-auto flex items-center justify-center">
                    <ResponsiveContainer width="100%" height={barH}>
                        <BarChart layout="vertical" data={chartData} margin={{ top: 4, right: 48, bottom: 4, left: 4 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                            <YAxis type="category" dataKey="user" tick={{ fontSize: 11 }} width={115} />
                            <Tooltip />
                            <Bar dataKey="count" name="Devices" fill="#6366f1" radius={[0, 4, 4, 0]}>
                                <LabelList dataKey="count" position="right" style={{ fontSize: 11 }} />
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )}
        </SectionCard>
    );
}

// ─── Root export ──────────────────────────────────────────────────────────────

export function UserDeviceDashboardWidgets({ data }: { data: UserDeviceMapping[] }) {
    const totalDevices = useMemo(() => data.reduce((s, u) => s + u.totalDevices, 0), [data]);
    const totalActive  = useMemo(() => data.reduce((s, u) => s + u.active, 0), [data]);
    const totalInactive = useMemo(() => data.reduce((s, u) => s + u.inactive, 0), [data]);

    return (
        <div className="space-y-4">
            {/* Row 2: Donut + Bar chart */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ActiveInactiveDonut active={totalActive} inactive={totalInactive} />
                <TopUsersByDeviceChart data={data} />
                 <TotalDevicesKPI total={totalDevices} />
                <FleetHealthKPI active={totalActive} total={totalDevices} />
            </div>

            {/* Row 1: KPI cards */}
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-2 gap-3 max-w-sm">
               
            </div>
        </div>
    );
}
