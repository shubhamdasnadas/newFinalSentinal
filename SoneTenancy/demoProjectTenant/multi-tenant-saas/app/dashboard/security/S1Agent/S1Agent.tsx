"use client";

import React, { useEffect, useState } from "react";
import { InactiveDashboardWidgets } from "../Agent/inactive/Inactive";
import { UserDeviceDashboardWidgets } from "../Agent/userdevice/UserDevice";

// ─── Raw agent shape from /api/sentinelone/sentinalone_agentinfo ───────────────
interface RawAgent {
    id?: string;
    computerName?: string;
    lastLoggedInUserName?: string;
    siteName?: string;
    groupName?: string;
    osName?: string;
    machineType?: string;
    lastIpToMgmt?: string;
    externalIp?: string;
    isActive?: boolean;
    isUpToDate?: boolean;
    firewallEnabled?: boolean;
    networkStatus?: string;
    agentVersion?: string;
    activeThreats?: number;
    infected?: boolean;
    mitigationMode?: string;
    lastActiveDate?: string;
    lastSuccessfulScanDate?: string;
    scanStatus?: string;
}

// ─── Derived view types ────────────────────────────────────────────────────────
interface InactiveMachine {
    computerName: string;
    user: string;
    site: string;
    lastActiveDate: string;
    inactiveDays: number;
}
interface OldAgentMachine {
    computerName: string;
    user: string;
    site: string;
    agentVersion: string;
    latestVersion: string;
}
interface FirewallDisabledMachine {
    computerName: string;
    user: string;
    site: string;
    firewallEnabled: boolean;
    lastIp: string;
}
interface ActiveThreatMachine {
    computerName: string;
    user: string;
    site: string;
    activeThreats: number;
    mitigationMode: string;
}
interface OldScanMachine {
    computerName: string;
    user: string;
    lastSuccessfulScanDate: string | null;
    scanAgeDays: number | null;
    scanStatus: string;
}
interface UserDeviceMapping {
    user: string;
    totalDevices: number;
    active: number;
    inactive: number;
    devices: string[];
}
interface SiteHealthScore {
    site: string;
    totalAgents: number;
    active: number;
    inactive: number;
    threats: number;
    outdated: number;
    healthScore: number;
}
interface OsOutdated {
    osName: string;
    total: number;
    outdated: number;
    upToDate: number;
}
interface NetworkStatus {
    status: string;
    count: number;
    percentage?: string;
}
interface RiskyEndpoint {
    rank?: number;
    computerName: string;
    user: string;
    site: string;
    riskScore: number;
    reasons: string[];
}
interface AdvancedViews {
    inactiveOlderThan7Days: InactiveMachine[];
    oldAgentVersionMachines: OldAgentMachine[];
    firewallDisabledMachines: FirewallDisabledMachine[];
    activeThreatMachines: ActiveThreatMachine[];
    oldScanMachines: OldScanMachine[];
    userWiseDeviceMapping: UserDeviceMapping[];
    siteWiseSecurityHealthScore: SiteHealthScore[];
    osWiseOutdatedSystems: OsOutdated[];
    networkStatusDistribution: NetworkStatus[];
    topRiskyEndpoints: RiskyEndpoint[];
}

// ─── Transform raw agents → all 10 views ──────────────────────────────────────
function LATEST_VERSION(agents: RawAgent[]): string {
    // Pick the most common/latest version seen in the dataset as the "latest"
    const freq: Record<string, number> = {};
    agents.forEach(a => { if (a.agentVersion) freq[a.agentVersion] = (freq[a.agentVersion] || 0) + 1; });
    return Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
}

function daysDiff(dateStr: string | null | undefined): number | null {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return Math.floor((Date.now() - d.getTime()) / 86_400_000);
}

function buildAdvancedViews(agents: RawAgent[]): AdvancedViews {
    const latestVersion = LATEST_VERSION(agents);
    const now = Date.now();

    // 1. Inactive > 7 days
    const inactiveOlderThan7Days: InactiveMachine[] = agents
        .filter(a => !a.isActive)
        .map(a => {
            const days = daysDiff(a.lastActiveDate) ?? 0;
            return {
                computerName: a.computerName ?? "—",
                user: a.lastLoggedInUserName ?? "—",
                site: a.siteName ?? "—",
                lastActiveDate: a.lastActiveDate
                    ? new Date(a.lastActiveDate).toISOString().split("T")[0]
                    : "—",
                inactiveDays: days,
            };
        })
        .filter(a => a.inactiveDays > 7)
        .sort((a, b) => b.inactiveDays - a.inactiveDays);

    // 2. Old agent version (not on latest)
    const oldAgentVersionMachines: OldAgentMachine[] = agents
        .filter(a => !a.isUpToDate || (a.agentVersion && a.agentVersion !== latestVersion))
        .map(a => ({
            computerName: a.computerName ?? "—",
            user: a.lastLoggedInUserName ?? "—",
            site: a.siteName ?? "—",
            agentVersion: a.agentVersion ?? "—",
            latestVersion,
        }));

    // 3. Firewall disabled
    const firewallDisabledMachines: FirewallDisabledMachine[] = agents
        .filter(a => a.firewallEnabled === false)
        .map(a => ({
            computerName: a.computerName ?? "—",
            user: a.lastLoggedInUserName ?? "—",
            site: a.siteName ?? "—",
            firewallEnabled: false,
            lastIp: a.lastIpToMgmt ?? a.externalIp ?? "—",
        }));

    // 4. Active threats
    const activeThreatMachines: ActiveThreatMachine[] = agents
        .filter(a => (a.activeThreats ?? 0) > 0)
        .map(a => ({
            computerName: a.computerName ?? "—",
            user: a.lastLoggedInUserName ?? "—",
            site: a.siteName ?? "—",
            activeThreats: a.activeThreats ?? 0,
            mitigationMode: a.mitigationMode ?? "—",
        }))
        .sort((a, b) => b.activeThreats - a.activeThreats);

    // 5. Old / pending scans (no scan in last 90 days or scanStatus pending)
    const oldScanMachines: OldScanMachine[] = agents
        .filter(a => {
            const age = daysDiff(a.lastSuccessfulScanDate);
            return (age === null || age > 90) || a.scanStatus === "pending";
        })
        .map(a => {
            const age = daysDiff(a.lastSuccessfulScanDate);
            return {
                computerName: a.computerName ?? "—",
                user: a.lastLoggedInUserName ?? "—",
                lastSuccessfulScanDate: a.lastSuccessfulScanDate
                    ? new Date(a.lastSuccessfulScanDate).toISOString().split("T")[0]
                    : null,
                scanAgeDays: age,
                scanStatus: a.scanStatus ?? "unknown",
            };
        });

    // 6. User → devices mapping
    const userMap: Record<string, { active: number; inactive: number; devices: string[] }> = {};
    agents.forEach(a => {
        const user = a.lastLoggedInUserName || "unknown";
        if (!userMap[user]) userMap[user] = { active: 0, inactive: 0, devices: [] };
        if (a.isActive) userMap[user].active++;
        else userMap[user].inactive++;
        if (a.computerName) userMap[user].devices.push(a.computerName);
    });
    const userWiseDeviceMapping: UserDeviceMapping[] = Object.entries(userMap)
        .map(([user, v]) => ({
            user,
            totalDevices: v.devices.length,
            active: v.active,
            inactive: v.inactive,
            devices: v.devices,
        }))
        .sort((a, b) => b.totalDevices - a.totalDevices);

    // 7. Site-wise health score
    const siteMap: Record<string, { totalAgents: number; active: number; inactive: number; threats: number; outdated: number }> = {};
    agents.forEach(a => {
        const site = a.siteName || "Unknown";
        if (!siteMap[site]) siteMap[site] = { totalAgents: 0, active: 0, inactive: 0, threats: 0, outdated: 0 };
        siteMap[site].totalAgents++;
        if (a.isActive) siteMap[site].active++; else siteMap[site].inactive++;
        if ((a.activeThreats ?? 0) > 0) siteMap[site].threats += a.activeThreats ?? 0;
        if (!a.isUpToDate) siteMap[site].outdated++;
    });
    const siteWiseSecurityHealthScore: SiteHealthScore[] = Object.entries(siteMap).map(([site, v]) => {
        // Health formula: deduct for inactive %, threats, outdated %
        let score = 100;
        if (v.totalAgents > 0) {
            score -= Math.round((v.inactive / v.totalAgents) * 30);   // up to -30 for inactive
            score -= Math.round((v.outdated / v.totalAgents) * 25);   // up to -25 for outdated
        }
        score -= Math.min(v.threats * 5, 25);                        // up to -25 for threats
        return { site, ...v, healthScore: Math.max(score, 0) };
    }).sort((a, b) => b.totalAgents - a.totalAgents);

    // 8. OS-wise outdated
    const osMap: Record<string, { total: number; outdated: number; upToDate: number }> = {};
    agents.forEach(a => {
        const os = a.osName || "Unknown";
        if (!osMap[os]) osMap[os] = { total: 0, outdated: 0, upToDate: 0 };
        osMap[os].total++;
        if (!a.isUpToDate) osMap[os].outdated++; else osMap[os].upToDate++;
    });
    const osWiseOutdatedSystems: OsOutdated[] = Object.entries(osMap)
        .map(([osName, v]) => ({ osName, ...v }))
        .sort((a, b) => b.total - a.total);

    // 9. Network status distribution
    const netMap: Record<string, number> = {};
    agents.forEach(a => {
        const s = a.networkStatus || "unknown";
        netMap[s] = (netMap[s] || 0) + 1;
    });
    const netTotal = agents.length;
    const networkStatusDistribution: NetworkStatus[] = Object.entries(netMap)
        .map(([status, count]) => ({
            status,
            count,
            percentage: `${((count / netTotal) * 100).toFixed(1)}%`,
        }))
        .sort((a, b) => b.count - a.count);

    // 10. Top risky endpoints (risk score formula)
    function riskScore(a: RawAgent): { score: number; reasons: string[] } {
        let score = 0;
        const reasons: string[] = [];
        if ((a.activeThreats ?? 0) > 0) { score += 40; reasons.push("Active Threats"); }
        if (a.firewallEnabled === false) { score += 20; reasons.push("Firewall Disabled"); }
        if (!a.isUpToDate) { score += 15; reasons.push("Outdated Agent"); }
        if (!a.isActive) { score += 15; reasons.push("Inactive"); }
        const scanAge = daysDiff(a.lastSuccessfulScanDate);
        if (scanAge === null || scanAge > 90) { score += 10; reasons.push("Old/No Scan"); }
        if (a.networkStatus !== "connected") { score += 5; reasons.push("Not Connected"); }
        return { score, reasons };
    }

    const topRiskyEndpoints: RiskyEndpoint[] = agents
        .map(a => {
            const { score, reasons } = riskScore(a);
            return {
                computerName: a.computerName ?? "—",
                user: a.lastLoggedInUserName ?? "—",
                site: a.siteName ?? "—",
                riskScore: score,
                reasons,
            };
        })
        .filter(e => e.riskScore > 0)
        .sort((a, b) => b.riskScore - a.riskScore)
        .slice(0, 20)
        .map((e, i) => ({ ...e, rank: i + 1 }));

    return {
        inactiveOlderThan7Days,
        oldAgentVersionMachines,
        firewallDisabledMachines,
        activeThreatMachines,
        oldScanMachines,
        userWiseDeviceMapping,
        siteWiseSecurityHealthScore,
        osWiseOutdatedSystems,
        networkStatusDistribution,
        topRiskyEndpoints,
    };
}

// ─── Shared UI components ───────────────────────────────────────────────────────
function Spin() {
    return (
        <div className="flex items-center justify-center py-16">
            <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
        </div>
    );
}

function SectionCard({
    title,
    subtitle,
    icon,
    children,
    footer,
}: {
    title: string;
    subtitle?: string;
    icon: React.ReactNode;
    children: React.ReactNode;
    footer?: React.ReactNode;
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
            <div className="overflow-x-auto">{children}</div>
            {footer}
        </div>
    );
}

function Th({ children }: { children: React.ReactNode }) {
    return (
        <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--muted)] border-b border-[var(--card-border)] bg-[var(--muted-bg)] whitespace-nowrap uppercase tracking-wide">
            {children}
        </th>
    );
}

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
    return (
        <td className={`px-4 py-3 text-xs text-[var(--foreground)] border-b border-[var(--card-border)] whitespace-nowrap ${className}`}>
            {children}
        </td>
    );
}

function Badge({
    color,
    children,
}: {
    color: "red" | "green" | "yellow" | "blue" | "gray" | "orange";
    children: React.ReactNode;
}) {
    const cls: Record<string, string> = {
        red: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
        green: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
        yellow: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
        blue: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
        gray: "bg-[var(--muted-bg)] text-[var(--muted)]",
        orange: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
    };
    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${cls[color]}`}>
            {children}
        </span>
    );
}

function HealthBar({ score }: { score: number }) {
    const color = score >= 90 ? "#10b981" : score >= 75 ? "#f59e0b" : "#ef4444";
    return (
        <div className="flex items-center gap-2 min-w-[120px]">
            <div className="flex-1 bg-[var(--muted-bg)] rounded-full h-2">
                <div className="h-2 rounded-full transition-all" style={{ width: `${score}%`, backgroundColor: color }} />
            </div>
            <span className="text-xs font-semibold" style={{ color }}>{score}%</span>
        </div>
    );
}

function RiskScoreBadge({ score }: { score: number }) {
    const color = score >= 55
        ? "text-red-600 dark:text-red-400"
        : score >= 35
            ? "text-orange-600 dark:text-orange-400"
            : "text-yellow-600 dark:text-yellow-400";
    return <span className={`text-sm font-bold ${color}`}>{score}</span>;
}

// ─── Empty state ───────────────────────────────────────────────────────────────
function Empty({ msg }: { msg: string }) {
    return (
        <div className="flex items-center justify-center py-12">
            <p className="text-sm text-[var(--muted)]">{msg}</p>
        </div>
    );
}

// ─── Table Pagination ──────────────────────────────────────────────────────────
function TablePagination({
    totalItems,
    itemsPerPage,
    currentPage,
    onPageChange,
}: {
    totalItems: number;
    itemsPerPage: number;
    currentPage: number;
    onPageChange: (page: number) => void;
}) {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    if (totalPages <= 1) return null;

    const startItem = (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, totalItems);

    const getPageNumbers = () => {
        const delta = 1;
        const range = [];
        const rangeWithDots = [];
        let l;

        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= currentPage - delta && i <= currentPage + delta)) {
                range.push(i);
            }
        }

        for (let i of range) {
            if (l) {
                if (i - l === 2) {
                    rangeWithDots.push(l + 1);
                } else if (i - l > 2) {
                    rangeWithDots.push("...");
                }
            }
            rangeWithDots.push(i);
            l = i;
        }

        return rangeWithDots;
    };

    return (
        <div className="px-5 py-3 border-t border-[var(--card-border)] bg-[var(--muted-bg)] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <span className="text-[var(--muted)] font-medium">
                Showing <span className="font-semibold text-[var(--foreground)]">{startItem}</span> to{" "}
                <span className="font-semibold text-[var(--foreground)]">{endItem}</span> of{" "}
                <span className="font-semibold text-[var(--foreground)]">{totalItems}</span> entries
            </span>
            <div className="flex items-center gap-1.5">
                <button
                    disabled={currentPage === 1}
                    onClick={() => onPageChange(currentPage - 1)}
                    className="px-2.5 py-1.5 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--foreground)] hover:bg-[var(--muted-bg)] disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium flex items-center gap-1"
                >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Prev
                </button>
                <div className="flex items-center gap-1">
                    {getPageNumbers().map((p, idx) => {
                        if (p === "...") {
                            return (
                                <span key={`dots-${idx}`} className="px-2 text-[var(--muted)] font-medium">
                                    ...
                                </span>
                            );
                        }
                        const isCurrent = p === currentPage;
                        return (
                            <button
                                key={p}
                                onClick={() => onPageChange(p as number)}
                                className={`w-8 h-8 rounded-lg text-xs font-semibold transition-all ${isCurrent
                                    ? "bg-indigo-600 text-white shadow-sm"
                                    : "border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--foreground)] hover:bg-[var(--muted-bg)]"
                                    }`}
                            >
                                {p}
                            </button>
                        );
                    })}
                </div>
                <button
                    disabled={currentPage === totalPages}
                    onClick={() => onPageChange(currentPage + 1)}
                    className="px-2.5 py-1.5 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--foreground)] hover:bg-[var(--muted-bg)] disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium flex items-center gap-1"
                >
                    Next
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                </button>
            </div>
        </div>
    );
}

// ─── 10 View Tables ────────────────────────────────────────────────────────────

function InactiveMachinesTable({ data }: { data: InactiveMachine[] }) {
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
    const paginatedData = data.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    return (
        <SectionCard
            title="Inactive Machines (>7 Days)"
            subtitle={`${data.length} machine${data.length !== 1 ? "s" : ""} inactive`}
            icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
            footer={
                <TablePagination
                    totalItems={data.length}
                    itemsPerPage={itemsPerPage}
                    currentPage={currentPage}
                    onPageChange={setCurrentPage}
                />
            }
        >
            {data.length === 0 ? (
                <Empty msg="No inactive machines found" />
            ) : (
                <table className="w-full">
                    <thead><tr><Th>Computer Name</Th><Th>User</Th><Th>Site</Th><Th>Last Active Date</Th><Th>Inactive Days</Th></tr></thead>
                    <tbody>
                        {paginatedData.map((row, i) => (
                            <tr key={i} className={i % 2 === 0 ? "bg-[var(--card-bg)]" : "bg-[var(--muted-bg)]"}>
                                <Td><span className="font-medium text-[var(--foreground)]">{row.computerName}</span></Td>
                                <Td>{row.user}</Td>
                                <Td>{row.site}</Td>
                                <Td>{row.lastActiveDate}</Td>
                                <Td><Badge color={row.inactiveDays > 20 ? "red" : "orange"}>{row.inactiveDays}d</Badge></Td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </SectionCard>
    );
}

function OldAgentTable({ data }: { data: OldAgentMachine[] }) {
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
    const paginatedData = data.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    return (
        <SectionCard
            title="Machines with Old Agent Version"
            subtitle={`${data.length} machine${data.length !== 1 ? "s" : ""} need update`}
            icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>}
            footer={
                <TablePagination
                    totalItems={data.length}
                    itemsPerPage={itemsPerPage}
                    currentPage={currentPage}
                    onPageChange={setCurrentPage}
                />
            }
        >
            {data.length === 0 ? (
                <Empty msg="All agents are up to date" />
            ) : (
                <table className="w-full">
                    <thead><tr><Th>Computer Name</Th><Th>User</Th><Th>Site</Th><Th>Current Version</Th><Th>Latest Version</Th></tr></thead>
                    <tbody>
                        {paginatedData.map((row, i) => (
                            <tr key={i} className={i % 2 === 0 ? "bg-[var(--card-bg)]" : "bg-[var(--muted-bg)]"}>
                                <Td><span className="font-medium text-[var(--foreground)]">{row.computerName}</span></Td>
                                <Td>{row.user}</Td>
                                <Td>{row.site}</Td>
                                <Td><Badge color="orange">{row.agentVersion}</Badge></Td>
                                <Td><Badge color="green">{row.latestVersion}</Badge></Td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </SectionCard>
    );
}

function FirewallDisabledTable({ data }: { data: FirewallDisabledMachine[] }) {
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
    const paginatedData = data.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    return (
        <SectionCard
            title="Firewall Disabled Machines"
            subtitle={`${data.length} machine${data.length !== 1 ? "s" : ""} unprotected`}
            icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>}
            footer={
                <TablePagination
                    totalItems={data.length}
                    itemsPerPage={itemsPerPage}
                    currentPage={currentPage}
                    onPageChange={setCurrentPage}
                />
            }
        >
            {data.length === 0 ? (
                <Empty msg="All firewalls are enabled" />
            ) : (
                <table className="w-full">
                    <thead><tr><Th>Computer Name</Th><Th>User</Th><Th>Site</Th><Th>IP Address</Th><Th>Firewall</Th></tr></thead>
                    <tbody>
                        {paginatedData.map((row, i) => (
                            <tr key={i} className={i % 2 === 0 ? "bg-[var(--card-bg)]" : "bg-[var(--muted-bg)]"}>
                                <Td><span className="font-medium text-[var(--foreground)]">{row.computerName}</span></Td>
                                <Td>{row.user}</Td>
                                <Td>{row.site}</Td>
                                <Td><code className="text-xs font-mono">{row.lastIp}</code></Td>
                                <Td><Badge color="red">Disabled</Badge></Td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </SectionCard>
    );
}

function ActiveThreatsTable({ data }: { data: ActiveThreatMachine[] }) {
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
    const paginatedData = data.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    return (
        <SectionCard
            title="Machines with Active Threats"
            subtitle={`${data.length} machine${data.length !== 1 ? "s" : ""} under threat`}
            icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
            footer={
                <TablePagination
                    totalItems={data.length}
                    itemsPerPage={itemsPerPage}
                    currentPage={currentPage}
                    onPageChange={setCurrentPage}
                />
            }
        >
            {data.length === 0 ? (
                <Empty msg="No active threats detected" />
            ) : (
                <table className="w-full">
                    <thead><tr><Th>Computer Name</Th><Th>User</Th><Th>Site</Th><Th>Active Threats</Th><Th>Mitigation Mode</Th></tr></thead>
                    <tbody>
                        {paginatedData.map((row, i) => (
                            <tr key={i} className={i % 2 === 0 ? "bg-[var(--card-bg)]" : "bg-[var(--muted-bg)]"}>
                                <Td><span className="font-medium text-[var(--foreground)]">{row.computerName}</span></Td>
                                <Td>{row.user}</Td>
                                <Td>{row.site}</Td>
                                <Td>
                                    <Badge color={row.activeThreats >= 3 ? "red" : "orange"}>
                                        {row.activeThreats} {row.activeThreats === 1 ? "threat" : "threats"}
                                    </Badge>
                                </Td>
                                <Td>
                                    <Badge color={row.mitigationMode === "protect" ? "green" : "yellow"}>
                                        {row.mitigationMode}
                                    </Badge>
                                </Td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </SectionCard>
    );
}

function OldScanTable({ data }: { data: OldScanMachine[] }) {
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
    const paginatedData = data.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    return (
        <SectionCard
            title="Last Scan Pending / Old Scan"
            subtitle={`${data.length} machine${data.length !== 1 ? "s" : ""} flagged`}
            icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>}
            footer={
                <TablePagination
                    totalItems={data.length}
                    itemsPerPage={itemsPerPage}
                    currentPage={currentPage}
                    onPageChange={setCurrentPage}
                />
            }
        >
            {data.length === 0 ? (
                <Empty msg="All scans are up to date" />
            ) : (
                <table className="w-full">
                    <thead><tr><Th>Computer Name</Th><Th>User</Th><Th>Scan Status</Th><Th>Last Successful Scan</Th><Th>Scan Age (Days)</Th></tr></thead>
                    <tbody>
                        {paginatedData.map((row, i) => (
                            <tr key={i} className={i % 2 === 0 ? "bg-[var(--card-bg)]" : "bg-[var(--muted-bg)]"}>
                                <Td><span className="font-medium text-[var(--foreground)]">{row.computerName}</span></Td>
                                <Td>{row.user}</Td>
                                <Td><Badge color={row.scanStatus === "pending" ? "yellow" : "blue"}>{row.scanStatus}</Badge></Td>
                                <Td>{row.lastSuccessfulScanDate ?? <span className="text-[var(--muted)]">N/A</span>}</Td>
                                <Td>
                                    {row.scanAgeDays != null ? (
                                        <Badge color={row.scanAgeDays > 200 ? "red" : "orange"}>{row.scanAgeDays}d</Badge>
                                    ) : (
                                        <span className="text-[var(--muted)]">N/A</span>
                                    )}
                                </Td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </SectionCard>
    );
}

function UserDeviceTable({ data }: { data: UserDeviceMapping[] }) {
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
    const paginatedData = data.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    const toggle = (user: string) =>
        setExpanded(prev => { const n = new Set(prev); n.has(user) ? n.delete(user) : n.add(user); return n; });

    return (
        <SectionCard
            title="User-wise Device Mapping"
            subtitle={`${data.length} users`}
            icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
            footer={
                <TablePagination
                    totalItems={data.length}
                    itemsPerPage={itemsPerPage}
                    currentPage={currentPage}
                    onPageChange={setCurrentPage}
                />
            }
        >
            {data.length === 0 ? <Empty msg="No user data" /> : (
                <table className="w-full">
                    <thead><tr><Th>User</Th><Th>Total Devices</Th><Th>Active</Th><Th>Inactive</Th><Th>Devices</Th></tr></thead>
                    <tbody>
                        {paginatedData.map((row, i) => (
                            <React.Fragment key={row.user}>
                                <tr className={i % 2 === 0 ? "bg-[var(--card-bg)]" : "bg-[var(--muted-bg)]"}>
                                    <Td>
                                        <button
                                            onClick={() => toggle(row.user)}
                                            className="flex items-center gap-1.5 font-medium text-[var(--foreground)] hover:text-indigo-600 transition-colors"
                                        >
                                            <svg className={`w-3 h-3 transition-transform ${expanded.has(row.user) ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                            {row.user}
                                        </button>
                                    </Td>
                                    <Td><span className="font-semibold">{row.totalDevices}</span></Td>
                                    <Td><Badge color="green">{row.active}</Badge></Td>
                                    <Td>{row.inactive > 0 ? <Badge color="red">{row.inactive}</Badge> : <span className="text-[var(--muted)]">0</span>}</Td>
                                    <Td className="text-[var(--muted)]">
                                        {row.devices.slice(0, 2).join(", ")}{row.devices.length > 2 ? ` +${row.devices.length - 2}` : ""}
                                    </Td>
                                </tr>
                                {expanded.has(row.user) && (
                                    <tr>
                                        <td colSpan={5} className="px-4 py-2 bg-indigo-50 dark:bg-indigo-900/10 border-b border-[var(--card-border)]">
                                            <div className="flex flex-wrap gap-2">
                                                {row.devices.map(d => (
                                                    <span key={d} className="px-2 py-1 rounded-lg text-xs font-mono bg-[var(--card-bg)] border border-[var(--card-border)] text-[var(--foreground)]">{d}</span>
                                                ))}
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </React.Fragment>
                        ))}
                    </tbody>
                </table>
            )}
        </SectionCard>
    );
}

function SiteHealthTable({ data }: { data: SiteHealthScore[] }) {
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
    const paginatedData = data.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    return (
        <SectionCard
            title="Site-wise Security Health Score"
            subtitle={`${data.length} sites monitored`}
            icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>}
            footer={
                <TablePagination
                    totalItems={data.length}
                    itemsPerPage={itemsPerPage}
                    currentPage={currentPage}
                    onPageChange={setCurrentPage}
                />
            }
        >
            {data.length === 0 ? <Empty msg="No site data" /> : (
                <table className="w-full">
                    <thead><tr><Th>Site</Th><Th>Total Agents</Th><Th>Active</Th><Th>Inactive</Th><Th>Threats</Th><Th>Outdated</Th><Th>Health Score</Th></tr></thead>
                    <tbody>
                        {paginatedData.map((row, i) => (
                            <tr key={i} className={i % 2 === 0 ? "bg-[var(--card-bg)]" : "bg-[var(--muted-bg)]"}>
                                <Td><span className="font-medium text-[var(--foreground)]">{row.site}</span></Td>
                                <Td><span className="font-semibold">{row.totalAgents}</span></Td>
                                <Td><Badge color="green">{row.active}</Badge></Td>
                                <Td>{row.inactive > 0 ? <Badge color="red">{row.inactive}</Badge> : <span className="text-[var(--muted)]">0</span>}</Td>
                                <Td>{row.threats > 0 ? <Badge color="red">{row.threats}</Badge> : <span className="text-[var(--muted)]">0</span>}</Td>
                                <Td>{row.outdated > 0 ? <Badge color="orange">{row.outdated}</Badge> : <span className="text-[var(--muted)]">0</span>}</Td>
                                <Td><HealthBar score={row.healthScore} /></Td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </SectionCard>
    );
}

function OsOutdatedTable({ data }: { data: OsOutdated[] }) {
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
    const paginatedData = data.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    return (
        <SectionCard
            title="OS-wise Outdated Systems"
            subtitle={`${data.length} OS types`}
            icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>}
            footer={
                <TablePagination
                    totalItems={data.length}
                    itemsPerPage={itemsPerPage}
                    currentPage={currentPage}
                    onPageChange={setCurrentPage}
                />
            }
        >
            {data.length === 0 ? <Empty msg="No OS data" /> : (
                <table className="w-full">
                    <thead><tr><Th>Operating System</Th><Th>Total Systems</Th><Th>Outdated</Th><Th>Up To Date</Th><Th>Coverage</Th></tr></thead>
                    <tbody>
                        {paginatedData.map((row, i) => {
                            const pct = row.total > 0 ? Math.round((row.upToDate / row.total) * 100) : 0;
                            return (
                                <tr key={i} className={i % 2 === 0 ? "bg-[var(--card-bg)]" : "bg-[var(--muted-bg)]"}>
                                    <Td><span className="font-medium text-[var(--foreground)]">{row.osName}</span></Td>
                                    <Td><span className="font-semibold">{row.total}</span></Td>
                                    <Td>{row.outdated > 0 ? <Badge color="orange">{row.outdated}</Badge> : <Badge color="green">{row.outdated}</Badge>}</Td>
                                    <Td><Badge color="green">{row.upToDate}</Badge></Td>
                                    <Td><HealthBar score={pct} /></Td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            )}
        </SectionCard>
    );
}

// ─── Network Status Table ───────────────────────────────────────────────────────
function NetworkStatusTable({ data }: { data: NetworkStatus[] }) {
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
    const paginatedData = data.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const total = data.reduce((s, d) => s + d.count, 0);
    const dotColor: Record<string, string> = {
        connected: "bg-green-500",
        disconnected: "bg-red-500",
        connecting: "bg-yellow-500",
        unknown: "bg-gray-400",
    };
    return (
        <SectionCard
            title="Network Status Distribution"
            subtitle={`${total} total agents`}
            icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" /></svg>}
            footer={
                <TablePagination
                    totalItems={data.length}
                    itemsPerPage={itemsPerPage}
                    currentPage={currentPage}
                    onPageChange={setCurrentPage}
                />
            }
        >
            {data.length === 0 ? <Empty msg="No network data" /> : (
                <table className="w-full">
                    <thead><tr><Th>Network Status</Th><Th>Count</Th><Th>Percentage</Th><Th>Distribution</Th></tr></thead>
                    <tbody>
                        {paginatedData.map((row, i) => {
                            const pct = row.percentage ?? `${((row.count / total) * 100).toFixed(1)}%`;
                            const pctNum = parseFloat(pct);
                            const barColor = row.status === "connected" ? "#10b981" : row.status === "disconnected" ? "#ef4444" : row.status === "connecting" ? "#f59e0b" : "#9ca3af";
                            return (
                                <tr key={i} className={i % 2 === 0 ? "bg-[var(--card-bg)]" : "bg-[var(--muted-bg)]"}>
                                    <Td>
                                        <div className="flex items-center gap-2">
                                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor[row.status] ?? "bg-gray-400"}`} />
                                            <span className="font-medium capitalize text-[var(--foreground)]">{row.status}</span>
                                        </div>
                                    </Td>
                                    <Td><span className="font-semibold">{row.count}</span></Td>
                                    <Td><span className="font-medium">{pct}</span></Td>
                                    <Td>
                                        <div className="w-32 bg-[var(--muted-bg)] rounded-full h-2">
                                            <div className="h-2 rounded-full" style={{ width: `${pctNum}%`, backgroundColor: barColor }} />
                                        </div>
                                    </Td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            )}
        </SectionCard>
    );
}

function TopRiskyTable({ data }: { data: RiskyEndpoint[] }) {
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
    const paginatedData = data.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    return (
        <SectionCard
            title="Top Risky Endpoints"
            subtitle={`${data.length} high-risk machines`}
            icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>}
            footer={
                <TablePagination
                    totalItems={data.length}
                    itemsPerPage={itemsPerPage}
                    currentPage={currentPage}
                    onPageChange={setCurrentPage}
                />
            }
        >
            {data.length === 0 ? <Empty msg="No risky endpoints detected" /> : (
                <table className="w-full">
                    <thead><tr><Th>Rank</Th><Th>Computer Name</Th><Th>User</Th><Th>Site</Th><Th>Risk Score</Th><Th>Reasons</Th></tr></thead>
                    <tbody>
                        {paginatedData.map((row, i) => (
                            <tr key={i} className={i % 2 === 0 ? "bg-[var(--card-bg)]" : "bg-[var(--muted-bg)]"}>
                                <Td>
                                    <span className="w-6 h-6 rounded-full bg-[var(--muted-bg)] border border-[var(--card-border)] inline-flex items-center justify-center text-xs font-bold">
                                        {row.rank ?? i + 1}
                                    </span>
                                </Td>
                                <Td><span className="font-medium text-[var(--foreground)]">{row.computerName}</span></Td>
                                <Td>{row.user}</Td>
                                <Td>{row.site}</Td>
                                <Td><RiskScoreBadge score={row.riskScore} /></Td>
                                <Td>
                                    <div className="flex flex-wrap gap-1">
                                        {row.reasons.map((r, ri) => <Badge key={ri} color="red">{r}</Badge>)}
                                    </div>
                                </Td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </SectionCard>
    );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, color }: { label: string; value: string | number; color: string }) {
    return (
        <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4 shadow-sm flex flex-col gap-1">
            <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wide">{label}</p>
            <p className={`text-3xl font-bold ${color}`}>{value}</p>
        </div>
    );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────
const TABS = [
    { key: "inactive", label: "Inactive" },
    // { key: "oldAgent", label: "Old Agent" },
    { key: "firewall", label: "Firewall Off" },
    { key: "threats", label: "Active Threats" },
    // { key: "oldScan", label: "Old Scan" },
    { key: "userDevices", label: "User Devices" },
    { key: "siteHealth", label: "Site Health" },
    // { key: "osOutdated", label: "OS Outdated" },
    // { key: "network", label: "Network Status" },
    { key: "risky", label: "Risky Endpoints" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

// ─── Main Component ────────────────────────────────────────────────────────────
export default function S1Agent() {
    const [rawAgents, setRawAgents] = useState<RawAgent[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [activeTab, setActiveTab] = useState<TabKey>("inactive");

    // ── Fetch real agent data on mount ────────────────────────────────────────
    useEffect(() => {
        setLoading(true);
        setError("");

        fetch("/api/sentinelone/sentinalone_agentinfo", { credentials: "include" })
            .then(async r => {
                const j = await r.json();
                if (!r.ok) throw new Error(j.message || "Failed to fetch agent info");
                // API returns { data: RawAgent[] }
                setRawAgents(Array.isArray(j.data) ? j.data : []);
            })
            .catch(e => setError(e.message || "Network error"))
            .finally(() => setLoading(false));
    }, []);

    // ── Derive all 10 views from raw agents ───────────────────────────────────
    const views = React.useMemo(() => buildAdvancedViews(rawAgents), [rawAgents]);

    // ── KPIs ──────────────────────────────────────────────────────────────────
    const totalAgents = rawAgents.length;
    const totalActive = rawAgents.filter(a => a.isActive).length;
    const totalInactive = rawAgents.filter(a => !a.isActive).length;
    const totalThreats = rawAgents.reduce((s, a) => s + (a.activeThreats ?? 0), 0);
    const totalOutdated = rawAgents.filter(a => !a.isUpToDate).length;
    const avgHealth = views.siteWiseSecurityHealthScore.length
        ? Math.round(views.siteWiseSecurityHealthScore.reduce((s, d) => s + d.healthScore, 0) / views.siteWiseSecurityHealthScore.length)
        : 0;

    if (loading) return <Spin />;

    if (error) return (
        <div className="p-8">
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-6">
                <p className="font-semibold text-red-700 dark:text-red-300">Failed to load agent data</p>
                <p className="text-red-600 dark:text-red-400 mt-1 text-sm">{error}</p>
            </div>
        </div>
    );

    return (
        <div className="p-4 sm:p-6 space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-xl sm:text-2xl font-bold text-[var(--foreground)]">SentinelOne Agent Dashboard</h1>
                <p className="text-xs text-[var(--muted)] mt-0.5">
                    Advanced endpoint security views · {totalAgents} agents monitored
                </p>
            </div>

            {/* KPI Row */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <KpiCard label="Total Agents" value={totalAgents} color="text-[var(--foreground)]" />
                <KpiCard label="Active" value={totalActive} color="text-green-600 dark:text-green-400" />
                <KpiCard label="Inactive" value={totalInactive} color="text-red-600 dark:text-red-400" />
                <KpiCard label="Active Threats" value={totalThreats} color="text-red-600 dark:text-red-400" />
                <KpiCard label="Outdated Agents" value={totalOutdated} color="text-orange-600 dark:text-orange-400" />
                <KpiCard
                    label="Avg Health"
                    value={`${avgHealth}%`}
                    color={avgHealth >= 80 ? "text-green-600 dark:text-green-400" : "text-orange-600 dark:text-orange-400"}
                />
            </div>

            {/* Inactive Machines Widgets — always visible */}

            {/* Tabs */}
            <div className="flex flex-wrap gap-1.5 border-b border-[var(--card-border)] overflow-x-auto">
                {TABS.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`px-3 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition-colors whitespace-nowrap ${activeTab === tab.key
                            ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20"
                            : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--muted-bg)]"
                            }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab content */}
            <div>
                {activeTab === "inactive" && <InactiveMachinesTable data={views.inactiveOlderThan7Days} />}
                {/* {activeTab === "oldAgent" && <OldAgentTable data={views.oldAgentVersionMachines} />} */}
                {activeTab === "firewall" && <FirewallDisabledTable data={views.firewallDisabledMachines} />}
                {activeTab === "threats" && <ActiveThreatsTable data={views.activeThreatMachines} />}
                {/* {activeTab === "oldScan" && <OldScanTable data={views.oldScanMachines} />} */}
                {activeTab === "userDevices" && <UserDeviceTable data={views.userWiseDeviceMapping} />}
                {activeTab === "siteHealth" && <SiteHealthTable data={views.siteWiseSecurityHealthScore} />}
                {/* {activeTab === "osOutdated" && <OsOutdatedTable data={views.osWiseOutdatedSystems} />} */}
                {/* {activeTab === "network" && <NetworkStatusTable data={views.networkStatusDistribution} />} */}
                {activeTab === "risky" && <TopRiskyTable data={views.topRiskyEndpoints} />}
            </div>

            {/* Inactive analytics widgets */}
            <InactiveDashboardWidgets data={views.inactiveOlderThan7Days} />

            {/* User device analytics widgets */}
            <UserDeviceDashboardWidgets data={views.userWiseDeviceMapping} />
        </div>
    );
}