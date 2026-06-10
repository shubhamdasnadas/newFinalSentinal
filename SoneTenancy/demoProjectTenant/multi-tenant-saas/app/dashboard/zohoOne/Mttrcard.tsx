"use client";

import React, { useMemo } from "react";

type Mttr = {
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

const Mttrcard = ({ tickets }: { tickets: Mttr[] }) => {
    const { avgResolutionTime, score } = useMemo(() => {
        const resolutionTimes = tickets
            .map((ticket) => {
                const created = new Date(
                    ticket?.createdTime || ticket?.created_at || ""
                );

                const closed = new Date(
                    ticket?.closedTime ||
                    ticket?.closed_at ||
                    ticket?.closedAt ||
                    ticket?.closeTime ||
                    ticket?.closedDate ||
                    ""
                );

                if (
                    isNaN(created.getTime()) ||
                    isNaN(closed.getTime()) ||
                    closed < created
                ) {
                    return null;
                }

                return (
                    (closed.getTime() - created.getTime()) /
                    (1000 * 60 * 60)
                );
            })
            .filter((time): time is number => time !== null);

        const avg =
            resolutionTimes.length > 0
                ? resolutionTimes.reduce((a, b) => a + b, 0) /
                resolutionTimes.length
                : 0;
        console.log("Avg Resolution Time (hours):", avg);
        let mttrScore = 20;

        if (avg < 0.5) mttrScore = 100;
        else if (avg < 1) mttrScore = 90;
        else if (avg < 2) mttrScore = 75;
        else if (avg < 4) mttrScore = 60;
        else if (avg < 8) mttrScore = 40;
        else mttrScore = 20;

        return {
            avgResolutionTime: avg,
            score: mttrScore,
        };
    }, [tickets]);

    const rotation = (score / 100) * 180 - 90;

    const scoreColor =
        score >= 80
            ? "#22c55e"
            : score >= 60
                ? "#84cc16"
                : score >= 40
                    ? "#eab308"
                    : "#ef4444";

    return (
        <div className="rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-lg">
            <h2 className="mb-6 text-xl font-bold text-white">
                MTTR Score
            </h2>

            <div className="flex flex-col items-center">
                <div className="relative h-[180px] w-[320px]">
                    <svg
                        viewBox="0 0 320 180"
                        className="absolute inset-0"
                    >
                        {/* Red */}
                        <path
                            d="M40 150 A120 120 0 0 1 90 60"
                            stroke="#ef4444"
                            strokeWidth="28"
                            fill="none"
                            strokeLinecap="round"
                        />

                        {/* Orange */}
                        <path
                            d="M90 60 A120 120 0 0 1 145 35"
                            stroke="#f59e0b"
                            strokeWidth="28"
                            fill="none"
                            strokeLinecap="round"
                        />

                        {/* Yellow */}
                        <path
                            d="M145 35 A120 120 0 0 1 175 35"
                            stroke="#eab308"
                            strokeWidth="28"
                            fill="none"
                            strokeLinecap="round"
                        />

                        {/* Light Green */}
                        <path
                            d="M175 35 A120 120 0 0 1 230 60"
                            stroke="#84cc16"
                            strokeWidth="28"
                            fill="none"
                            strokeLinecap="round"
                        />

                        {/* Green */}
                        <path
                            d="M230 60 A120 120 0 0 1 280 150"
                            stroke="#22c55e"
                            strokeWidth="28"
                            fill="none"
                            strokeLinecap="round"
                        />
                    </svg>

                    {/* Needle */}
                    <div
                        className="absolute left-1/2 bottom-[28px] origin-bottom"
                        style={{
                            transform: `translateX(-50%) rotate(${rotation}deg)`,
                        }}
                    >
                        <div
                            className="h-[110px] w-[4px] rounded-full"
                            style={{
                                backgroundColor: scoreColor,
                            }}
                        />
                    </div>

                    {/* Center Circle */}
                    <div className="absolute bottom-[15px] left-1/2 h-8 w-8 -translate-x-1/2 rounded-full bg-slate-200 shadow-lg" />
                </div>

                <div className="mt-4 text-center">
                    <div
                        className="text-5xl font-bold"
                        style={{ color: scoreColor }}
                    >
                        {score}
                    </div>

                    <div className="mt-2 text-sm text-slate-400">
                        MTTR Score
                    </div>

                    <div className="mt-3 text-lg font-semibold text-white">
                        {avgResolutionTime.toFixed(2)} Hours
                    </div>

                    <div className="text-sm text-slate-400">
                        Mean Time To Resolution
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Mttrcard;