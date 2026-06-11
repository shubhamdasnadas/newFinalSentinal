"use client";

import React, { useMemo, useState } from "react";

type hourTicket = {
    id?: string | number;
    ticketNumber?: string | number;
    ticket_no?: string | number;
    subject?: string;
    status?: string;
    createdTime?: string;
    created_at?: string;
};

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

const CELL_SIZE = 40;
const LABEL_WIDTH = 70;

const Hourbasedset = ({ tickets }: { tickets: hourTicket[] }) => {
    const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

    const heatmapData = useMemo(() => {
        const matrix = Array.from({ length: 7 }, () =>
            Array.from({ length: 24 }, () => ({
                count: 0,
                tickets: [] as hourTicket[],
            }))
        );

        tickets?.forEach((ticket) => {
            const dateValue =
                ticket.createdTime || ticket.created_at;

            if (!dateValue) return;

            const date = new Date(dateValue);

            if (isNaN(date.getTime())) return;

            let day = date.getDay();

            // Monday First
            day = day === 0 ? 6 : day - 1;

            const hour = date.getHours();

            matrix[day][hour].count += 1;
            matrix[day][hour].tickets.push(ticket);
        });

        return matrix;
    }, [tickets]);

    const maxCount = Math.max(
        ...heatmapData.flat().map((item) => item.count),
        1
    );

    const getColor = (count: number) => {
        if (count === 0) return "#F5EFE6";

        const intensity = count / maxCount;

        if (intensity <= 0.2) return "#F8D48B";
        if (intensity <= 0.4) return "#F3BE52";
        if (intensity <= 0.6) return "#EDA41B";
        if (intensity <= 0.8) return "#C97A05";

        return "#000000";
    };

    const formatHour = (hour: number) => {
        const suffix = hour >= 12 ? "PM" : "AM";
        const displayHour = hour % 12 === 0 ? 12 : hour % 12;

        return `${displayHour} ${suffix}`;
    };

    const formatDate = (dateString?: string) => {
        if (!dateString) return "-";

        const date = new Date(dateString);

        return date.toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        });
    };

    const formatTime = (dateString?: string) => {
        if (!dateString) return "-";

        const date = new Date(dateString);

        return date.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
        });
    };

    return (
        <div className="w-full bg-white rounded-xl shadow-sm border p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-6">
                Ticket Creation Heatmap
            </h2>

            <div className="overflow-x-auto overflow-y-visible" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div
                    style={{
                        minWidth:
                            LABEL_WIDTH +
                            HOURS.length * (CELL_SIZE + 4),
                    }}
                >
                    {/* Header */}
                    <div className="flex mb-4">
                        <div
                            style={{
                                width: LABEL_WIDTH,
                            }}
                        />

                        <div
                            className="grid gap-1"
                            style={{
                                gridTemplateColumns: `repeat(24, ${CELL_SIZE}px)`,
                            }}
                        >
                            {HOURS.map((hour) => (
                                <div
                                    key={hour}
                                    className="text-[11px] font-medium text-center text-gray-600"
                                    style={{
                                        width: CELL_SIZE,
                                    }}
                                >
                                    {formatHour(hour)}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Days */}
                    {DAYS.map((day, dayIndex) => (
                        <div
                            key={day}
                            className="flex items-center mb-2"
                        >
                            <div
                                className="font-semibold text-gray-700 flex items-center"
                                style={{
                                    width: LABEL_WIDTH,
                                    height: CELL_SIZE,
                                }}
                            >
                                {day}
                            </div>

                            <div
                                className="grid gap-1"
                                style={{
                                    gridTemplateColumns: `repeat(24, ${CELL_SIZE}px)`,
                                }}
                            >
                                {HOURS.map((hour) => {
                                    const bucket =
                                        heatmapData[dayIndex][hour];

                                    const count =
                                        bucket.count;

                                    const tooltipText =
                                        count > 0
                                            ? bucket.tickets
                                                .slice(0, 5)
                                                .map((ticket) => {
                                                    const created =
                                                        ticket.createdTime ||
                                                        ticket.created_at;

                                                    return [
                                                        `Ticket : ${ticket.ticketNumber ||
                                                        ticket.ticket_no ||
                                                        "-"
                                                        }`,
                                                        `Date : ${formatDate(
                                                            created
                                                        )}`,
                                                        `Time : ${formatTime(
                                                            created
                                                        )}`,
                                                        `Subject : ${ticket.subject ||
                                                        "-"
                                                        }`,
                                                    ].join("\n");
                                                })
                                                .join(
                                                    "\n------------------------\n"
                                                )
                                            : "No Tickets";
                                    const tooltipKey = `${dayIndex}-${hour}`;
                                    return (
                                        <div
                                            key={tooltipKey}
                                            className="relative"
                                        >
                                            {/* Heatmap Cell */}
                                            <div
                                                onClick={() =>
                                                    setActiveTooltip(
                                                        activeTooltip === tooltipKey
                                                            ? null
                                                            : tooltipKey
                                                    )
                                                }
                                                className="
                rounded-md
                border
                border-white
                hover:scale-105
                transition-all
                duration-200
                cursor-pointer
            "
                                                style={{
                                                    width: CELL_SIZE,
                                                    height: CELL_SIZE,
                                                    backgroundColor: getColor(count),
                                                }}
                                            />

                                            {/* Click Tooltip */}
                                            {activeTooltip === tooltipKey && count > 0 && (
                                                <div
                                                    className="
                    absolute
                    z-[99999]
                    top-0
                    left-full
                    ml-3

                    w-[450px]
                    max-h-[450px]

                    overflow-y-auto

                    rounded-lg
                    bg-slate-900
                    text-white
                    text-xs

                    shadow-2xl
                    border
                    border-slate-700

                    p-4

                    [scrollbar-width:thin]
                    [scrollbar-color:#475569_#0f172a]
                "
                                                >
                                                    {/* Header */}
                                                    <div className="flex justify-between items-center mb-3">
                                                        <div className="font-semibold text-sm text-yellow-300">
                                                            {day} • {formatHour(hour)}
                                                        </div>

                                                        <button
                                                            onClick={() =>
                                                                setActiveTooltip(null)
                                                            }
                                                            className="
                            text-gray-400
                            hover:text-white
                            text-lg
                            leading-none
                        "
                                                        >
                                                            ×
                                                        </button>
                                                    </div>

                                                    <div className="mb-3">
                                                        <strong>Total Tickets:</strong> {count}
                                                    </div>

                                                    {bucket.tickets.map((ticket, index) => {
                                                        const created =
                                                            ticket.createdTime ||
                                                            ticket.created_at;

                                                        return (
                                                            <div
                                                                key={index}
                                                                className="
                                border-t
                                border-slate-700
                                pt-2
                                mt-2
                            "
                                                            >
                                                                <div>
                                                                    <strong>Ticket:</strong>{" "}
                                                                    {ticket.ticketNumber ||
                                                                        ticket.ticket_no ||
                                                                        "-"}
                                                                </div>

                                                                <div>
                                                                    <strong>Date:</strong>{" "}
                                                                    {formatDate(created)}
                                                                </div>

                                                                <div>
                                                                    <strong>Time:</strong>{" "}
                                                                    {formatTime(created)}
                                                                </div>

                                                                <div className="break-words">
                                                                    <strong>Subject:</strong>{" "}
                                                                    {ticket.subject || "-"}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}

                    {/* Legend */}
                    <div className="flex justify-end items-center gap-2 mt-6">
                        <span className="text-sm text-gray-500">
                            Less
                        </span>

                        {[
                            "#F5EFE6",
                            "#F8D48B",
                            "#F3BE52",
                            "#EDA41B",
                            "#000000",
                        ].map((color, index) => (
                            <div
                                key={index}
                                className="rounded"
                                style={{
                                    width: 18,
                                    height: 18,
                                    backgroundColor: color,
                                }}
                            />
                        ))}

                        <span className="text-sm text-gray-500">
                            More
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Hourbasedset;