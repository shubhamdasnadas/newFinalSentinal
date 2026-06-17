"use client";

import React, { useMemo } from "react";

type performanceData = {
    id?: string | number;
    ticketNumber?: string | number;
    ticket_no?: string | number;
    subject?: string;
    status?: string;
    createdTime?: string;
    created_at?: string;
    closedTime?: string;
    closed_at?: string;
    closedAt?: string;
    closeTime?: string;
    closedDate?: string;
    customerResponseTime?: string | number;
    customer_response_time?: string | number;
    customer_responseTime?: string | number;
    responseTime?: string | number;
    department?: {
        name?: string;
    };
    departmentName?: string;
    assignee?: {
        firstName?: string;
        lastName?: string;
    };
};

type EngineerPerformance = {
    engineerName: string;
    totalHours: number;
    ticketCount: number;
};

const getCreatedDate = (ticket: performanceData) =>
    ticket.createdTime || ticket.created_at || "";

const getClosedDate = (ticket: performanceData) =>
    ticket.closedTime ||
    ticket.closed_at ||
    ticket.closedAt ||
    ticket.closeTime ||
    ticket.closedDate ||
    "";

const getAssignee = (ticket: performanceData) => {
    const first = ticket.assignee?.firstName || "";
    const last = ticket.assignee?.lastName || "";
    const name = `${first} ${last}`.trim();

    return name;
};

const isClosedTicket = (ticket: performanceData) => {
    const status = String(ticket.status || "").trim().toLowerCase();

    return (
        status === "closed" ||
        status === "close" ||
        status === "technically closed"
    );
};

const calculateResolvedHours = (ticket: performanceData) => {
    const created = getCreatedDate(ticket);
    const closed = getClosedDate(ticket);

    if (!created || !closed) return null;

    const createdDate = new Date(created);
    const closedDate = new Date(closed);

    if (isNaN(createdDate.getTime()) || isNaN(closedDate.getTime())) return null;

    const diffMs = closedDate.getTime() - createdDate.getTime();

    if (diffMs < 0) return null;

    return diffMs / (1000 * 60 * 60);
};

const Topperformance = ({ tickets }: { tickets: performanceData[] }) => {
    const tableData = useMemo(() => {
        const engineerMap: Record<string, EngineerPerformance> = {};

        tickets.forEach((ticket) => {
            if (!isClosedTicket(ticket)) return;

            const resolvedHours = calculateResolvedHours(ticket);
            if (resolvedHours === null) return;

            const engineerName = getAssignee(ticket);
            if (!engineerName) return;
            // Skip Unassigned tickets
            if (
                !engineerName ||
                engineerName === "Unassigned" ||
                engineerName.trim() === ""
            ) {
                return;
            }

            if (!engineerMap[engineerName]) {
                engineerMap[engineerName] = {
                    engineerName,
                    totalHours: 0,
                    ticketCount: 0,
                };
            }

            engineerMap[engineerName].totalHours += resolvedHours;
            engineerMap[engineerName].ticketCount += 1;
        });

        return Object.values(engineerMap)
            .sort((a, b) => a.totalHours - b.totalHours)
            .slice(0, 10);
    }, [tickets]);

    const getScore = (hours: number, count: number) => {
        console.log(
            "Calculating score for hours:",
            hours.toFixed(2),
            "and count:",
            count
        );

        let score = 100 - Math.floor(hours / 10) * 10;

        // If hours > 100, always keep score at 10
        if (hours > 100) {
            score = 10;
        }

        // Score should never go below 10
        score = Math.max(10, Math.min(100, score));

        return score;
    };

    return (
        <div className="w-full rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--card-border)] bg-[var(--muted-bg)]">
                <h2 className="text-base font-bold text-[var(--foreground)]">
                    Top Lowest 5 Performance
                </h2>
                <p className="text-xs text-[var(--muted)] mt-1">
                    Engineer wise total time taken from created date to closed date
                </p>
            </div>

            <div className="p-4">
                <div className="overflow-hidden rounded-xl border border-[var(--card-border)]">
                    <table className="w-full text-sm border-collapse">
                        <thead className="bg-[var(--muted-bg)]">
                            <tr>
                                <th className="px-5 py-3 text-left border-b border-[var(--card-border)] font-semibold text-[var(--foreground)]">
                                    Engineer Name
                                </th>

                                <th className="px-5 py-3 text-center border-b border-[var(--card-border)] font-semibold text-[var(--foreground)]">
                                    Closed Tickets
                                </th>

                                <th className="px-5 py-3 text-right border-b border-[var(--card-border)] font-semibold text-[var(--foreground)]">
                                    Score Point
                                </th>

                                <th className="px-5 py-3 text-right border-b border-[var(--card-border)] font-semibold text-[var(--foreground)]">
                                    Total Time Taken
                                </th>
                            </tr>
                        </thead>

                        <tbody>
                            {tableData.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={3}
                                        className="px-5 py-8 text-center text-sm text-[var(--muted)]"
                                    >
                                        No closed tickets found
                                    </td>
                                </tr>
                            ) : (
                                tableData.map((row, index) => (
                                    <tr
                                        key={row.engineerName}
                                        className="hover:bg-[var(--muted-bg)] transition-colors"
                                    >
                                        <td className="px-5 py-4 border-b border-[var(--card-border)]">
                                            <div className="flex items-center gap-3">
                                                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-red-100 text-red-700 text-xs font-bold">
                                                    {index + 1}
                                                </span>

                                                <span className="font-semibold text-[var(--foreground)]">
                                                    {row.engineerName}
                                                </span>
                                            </div>
                                        </td>

                                        <td className="px-5 py-4 text-center border-b border-[var(--card-border)] font-semibold text-[var(--foreground)]">
                                            {row.ticketCount}
                                        </td>

                                        <td className="px-5 py-4 text-right border-b border-[var(--card-border)] font-bold whitespace-nowrap text-red-600">
                                            {getScore(row.totalHours, row.ticketCount).toFixed(2)}
                                        </td>

                                        <td className="px-5 py-4 text-right border-b border-[var(--card-border)] font-bold whitespace-nowrap text-red-600">
                                            {row.totalHours.toFixed(2)}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default Topperformance;