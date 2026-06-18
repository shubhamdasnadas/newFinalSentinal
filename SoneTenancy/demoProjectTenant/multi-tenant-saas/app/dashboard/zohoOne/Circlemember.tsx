"use client";

import React, { useMemo, useEffect, useRef, useState } from "react";

type Circletable = {
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

// ─── Coral/salmon palette from image 2 ───────────────────────────────────────
const CORP_COLORS = [
    { bg: "rgba(240,100,80,0.18)", border: "rgba(240,100,80,0.55)", label: "#e8604a" },
    { bg: "rgba(220,80,100,0.15)", border: "rgba(220,80,100,0.50)", label: "#d94f6a" },
    { bg: "rgba(255,130,90,0.16)", border: "rgba(255,130,90,0.50)", label: "#e8724a" },
    { bg: "rgba(200,70,90,0.14)", border: "rgba(200,70,90,0.48)", label: "#c8455a" },
    { bg: "rgba(250,110,80,0.16)", border: "rgba(250,110,80,0.52)", label: "#e05a40" },
];

const ASSIGNEE_COLORS = [
    { from: "#f08060", to: "#e84a3a" },
    { from: "#f09070", to: "#e06050" },
    { from: "#e86060", to: "#d04040" },
    { from: "#f0a080", to: "#e07060" },
    { from: "#e87060", to: "#d05545" },
    { from: "#f07050", to: "#e04030" },
];
// ─────────────────────────────────────────────────────────────────────────────

interface PackedCircle {
    x: number;
    y: number;
    r: number;
    corpIndex: number;
}

/** Simple iterative circle-packing: place each corp circle without overlap */
function packCircles(radii: number[], containerR: number): { x: number; y: number }[] {
    if (radii.length === 1) return [{ x: 0, y: 0 }];

    if (radii.length === 3) {
        return [
            // TJSB
            { x: 0, y: -containerR * 0.55 },

            // Techsec
            { x: -containerR * 0.40, y: containerR * 0.35 },

            // PCPL
            { x: containerR * 0.50, y: containerR * 0.20 },
        ];
    }

    return radii.map((r, i) => {
        const angle = (i / radii.length) * Math.PI * 2;
        const dist = containerR - r - 25;

        return {
            x: Math.cos(angle) * dist,
            y: Math.sin(angle) * dist,
        };
    });
}

interface AssigneePackedCircle {
    x: number;
    y: number;
    r: number;
    idx: number;
}

function packAssigneeCircles(
    assignees: { name: string; count: number }[],
    corpR: number
): AssigneePackedCircle[] {
    const sorted = assignees
        .map((a, idx) => ({ ...a, originalIndex: idx }))
        .sort((a, b) => b.count - a.count);

    const maxCount = Math.max(...sorted.map((a) => a.count), 1);

    const placed: AssigneePackedCircle[] = [];

    sorted.forEach((a, sortedIdx) => {
        const r = Math.max(
            13,
            Math.min(corpR * 0.18, 13 + (a.count / maxCount) * (corpR * 0.10))
        );
        const total = sorted.length;

        // ✅ place bubbles on outer ring / corner side
        const angle = (sortedIdx / total) * Math.PI * 2 - Math.PI / 2;

        // ✅ keep bubble near boundary of parent circle
        const ringRadius = corpR - r - 10;

        const x = Math.cos(angle) * ringRadius;
        const y = Math.sin(angle) * ringRadius;

        placed.push({
            x,
            y,
            r,
            idx: a.originalIndex,
        });
    });

    return placed;
}
// ─── Sub-component: one corporation circle ────────────────────────────────────
const CorpCircle = ({
    corp,
    corpR,
    colorScheme,
}: {
    corp: { corporation: string; total: number; assignees: { name: string; count: number }[] };
    corpR: number;
    colorScheme: typeof CORP_COLORS[0];
}) => {
    const [hoveredAssignee, setHoveredAssignee] = useState<{
        name: string;
        count: number;
        x: number;
        y: number;
    } | null>(null);
    const packed = useMemo(
        () => packAssigneeCircles(corp.assignees, corpR),
        [corp.assignees, corpR]
    );

    const getInitials = (name: string) => {
        if (!name || name === "Unassigned") return "UA";

        return name
            .trim()
            .split(/\s+/)
            .filter(Boolean)
            .map((word) => word[0]?.toUpperCase())
            .join("");
    };
    return (
        <div
            style={{
                width: corpR * 2,
                height: corpR * 2,
                borderRadius: "50%",
                background: colorScheme.bg,
                border: `1.5px solid ${colorScheme.border}`,
                position: "relative",
                flexShrink: 0,
                boxShadow: `0 0 32px ${colorScheme.border}`,
                overflow: "hidden",
            }}
        >
            {/* Corp label at top */}
            <div
                style={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    textAlign: "center",
                    pointerEvents: "none",
                    zIndex: 5,
                    width: corpR * 0.55,
                }}
            >
                <div
                    style={{
                        fontSize: Math.max(11, corpR * 0.11),
                        fontWeight: 700,
                        color: colorScheme.label,
                        lineHeight: 1.2,
                        padding: "0 8px",
                    }}
                >
                    {corp.corporation}
                </div>
                {/* <div style={{ fontSize: Math.max(9, corpR * 0.1), color: "#b05040", marginTop: 2 }}>
                    {corp.total} Tickets
                </div> */}
            </div>

            {/* Assignee bubbles */}
            {packed.map((p) => {
                const assignee = corp.assignees[p.idx];
                const color = ASSIGNEE_COLORS[p.idx % ASSIGNEE_COLORS.length];
                const fontSize = Math.max(8, Math.min(12, p.r * 0.22));

                return (
                    <div
                        key={assignee.name}
                        title={`${assignee.name}: ${assignee.count} Tickets`}
                        style={{
                            position: "absolute",
                            width: p.r * 2,
                            height: p.r * 2,
                            borderRadius: "50%",
                            background: `radial-gradient(circle at 35% 35%, ${color.from}, ${color.to})`,
                            border: "1.5px solid rgba(255,255,255,0.25)",
                            boxShadow: "0 2px 12px rgba(220,80,60,0.35)",
                            left: corpR + p.x - p.r,
                            top: corpR + p.y - p.r,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexDirection: "column",
                            zIndex: 5,
                            cursor: "pointer",
                            transition: "transform 0.18s ease, box-shadow 0.18s ease",
                        }}
                        onMouseEnter={(e) => {
                            (e.currentTarget as HTMLDivElement).style.transform = "scale(1.08)";
                            (e.currentTarget as HTMLDivElement).style.boxShadow =
                                "0 4px 20px rgba(220,80,60,0.55)";
                        }}
                        onMouseLeave={(e) => {
                            (e.currentTarget as HTMLDivElement).style.transform = "scale(1)";
                            (e.currentTarget as HTMLDivElement).style.boxShadow =
                                "0 2px 12px rgba(220,80,60,0.35)";
                        }}
                    >
                        <span
                            style={{
                                fontSize: Math.max(12, Math.min(22, p.r * 0.45)),
                                fontWeight: 800,
                                color: "#fff",
                                textAlign: "center",
                                lineHeight: 1,
                            }}
                        >
                            {getInitials(assignee.name)}
                        </span>
                        <span
                            style={{
                                fontSize: Math.max(7, Math.min(10, p.r * 0.18)),
                                color: "rgba(255,255,255,0.9)",
                                marginTop: 4,
                                textAlign: "center",
                                maxWidth: p.r * 1.6,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                            }}
                        >
                            {assignee.count} Tickets
                        </span>
                    </div>
                );
            })}
        </div>
    );
};

// ─── Main component ───────────────────────────────────────────────────────────
const Circlemember = ({ tickets }: { tickets: Circletable[] }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [containerSize, setContainerSize] = useState(700);

    useEffect(() => {
        const update = () => {
            if (containerRef.current) {
                const w = containerRef.current.offsetWidth;
                setContainerSize(Math.max(320, w));
            }
        };
        update();
        const ro = new ResizeObserver(update);
        if (containerRef.current) ro.observe(containerRef.current);
        return () => ro.disconnect();
    }, []);

    // ── Group tickets by department → assignee ────────────────────────────────
    const corporationData = useMemo(() => {
        const grouped: Record<string, Record<string, number>> = {};

        tickets.forEach((ticket) => {
            const corporation =
                ticket?.department?.name || ticket?.departmentName || "Unknown Department";
            const assigneeName =
                `${ticket?.assignee?.firstName ?? ""} ${ticket?.assignee?.lastName ?? ""}`.trim() ||
                "Unassigned";

            if (!grouped[corporation]) grouped[corporation] = {};
            grouped[corporation][assigneeName] = (grouped[corporation][assigneeName] || 0) + 1;
        });

        return Object.entries(grouped).map(([corporation, assignees]) => ({
            corporation,
            total: Object.values(assignees).reduce((a, b) => a + b, 0),
            assignees: Object.entries(assignees).map(([name, count]) => ({ name, count })),
        }));
    }, [tickets]);

    // ── Compute corp circle radii proportional to ticket count ────────────────
    const mainR = Math.min(containerSize * 0.34, 220);
    const totalTickets = corporationData.reduce((s, c) => s + c.total, 0) || 1;

    const corpRadii = useMemo(
        () =>
            corporationData.map((c) => {
                const assigneeCount = c.assignees.length;

                if (assigneeCount >= 8) return 78;
                if (assigneeCount >= 3) return 72;

                return 62;
            }),
        [corporationData]
    );

    // ── Pack corp circles inside main circle ──────────────────────────────────
    const corpPositions = useMemo(
        () => packCircles(corpRadii, mainR),
        [corpRadii, mainR]
    );

    if (corporationData.length === 0) {
        return (
            <div
                style={{
                    background: "#fdf4f2",
                    borderRadius: 16,
                    padding: 40,
                    textAlign: "center",
                    color: "#c06050",
                    fontFamily: "sans-serif",
                }}
            >
                No ticket data available
            </div>
        );
    }
    const circleR = mainR * 0.75;
    return (
        <div
        className="w-full rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-5 shadow-sm"
            ref={containerRef}
            style={{
                // height: "90%",
                // width: "60%",
                background: "#fdf4f2",
                borderRadius: 16,
                padding: 10,
                textAlign: "center",
                // color: "#c06050",
                fontFamily: "'Inter', 'Segoe UI', sans-serif",
                userSelect: "none",
            }}
        >
            <h2
                style={{
                    textAlign: "center",
                    color: "#c04030",
                    fontWeight: 700,
                    fontSize: 18,
                    marginBottom: 16,
                    letterSpacing: 0.3,
                }}
            >
                Corporation Assignee Distribution
            </h2>

            {/* ── Main container circle ── */}
            <div
                style={{
                    position: "relative",
                    width: circleR * 2,
                    height: circleR * 2,
                    borderRadius: "50%",
                    background:
                        "radial-gradient(circle at 40% 40%, rgba(255,210,200,0.55), rgba(250,180,170,0.25))",
                    border: "2px solid rgba(220,100,80,0.30)",
                    boxShadow:
                        "0 0 60px rgba(240,100,80,0.12), inset 0 0 40px rgba(240,100,80,0.06)",
                    margin: "10px auto 0",
                    overflow: "hidden",
                }}
            >
                {corporationData.map((corp, idx) => {
                    const r = corpRadii[idx];
                    const pos = packCircles(corpRadii, circleR)[idx] ?? { x: 0, y: 0 };
                    const colorScheme = CORP_COLORS[idx % CORP_COLORS.length];

                    return (
                        <div
                            key={corp.corporation}
                            style={{
                                position: "absolute",
                                left: circleR + pos.x - r,
                                top: circleR + pos.y - r,
                            }}
                        >
                            <CorpCircle corp={corp} corpR={r} colorScheme={colorScheme} />
                        </div>
                    );
                })}
            </div>

            {/* ── Legend ──
            <div
                style={{
                    display: "flex",
                    flexWrap: "wrap",
                    justifyContent: "center",
                    gap: "8px 8px",
                    // marginTop: 20,
                }}
            >
                {corporationData.map((corp, idx) => (
                    <div
                        key={corp.corporation}
                        style={{ display: "flex", alignItems: "center", gap: 6 }}
                    >
                        <div
                            style={{
                                width: 12,
                                height: 12,
                                borderRadius: "50%",
                                background: CORP_COLORS[idx % CORP_COLORS.length].label,
                                flexShrink: 0,
                            }}
                        />
                        <span style={{ fontSize: 12, color: "#8b3020", fontWeight: 500 }}>
                            {corp.corporation} ({corp.total})
                        </span>
                    </div>
                ))}
            </div> */}
        </div>
    );
};

export default Circlemember;