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
    const positions: { x: number; y: number }[] = [];
    const maxAttempts = 800;

    for (let i = 0; i < radii.length; i++) {
        const r = radii[i];
        let placed = false;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            // Random position inside the container
            const angle = Math.random() * 2 * Math.PI;
            const maxDist = containerR - r - 4;
            const dist = Math.random() * maxDist;
            const cx = Math.cos(angle) * dist;
            const cy = Math.sin(angle) * dist;

            // Check overlap with already-placed circles
            let overlaps = false;
            for (let j = 0; j < positions.length; j++) {
                const dx = cx - positions[j].x;
                const dy = cy - positions[j].y;
                const minDist = radii[j] + r + 8;
                if (Math.sqrt(dx * dx + dy * dy) < minDist) {
                    overlaps = true;
                    break;
                }
            }

            if (!overlaps) {
                positions.push({ x: cx, y: cy });
                placed = true;
                break;
            }
        }

        if (!placed) {
            // Fallback: push to edge
            const angle = (i / radii.length) * 2 * Math.PI;
            const dist = containerR * 0.5;
            positions.push({ x: Math.cos(angle) * dist, y: Math.sin(angle) * dist });
        }
    }

    return positions;
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
    const maxCount = Math.max(...assignees.map((a) => a.count), 1);
    const radii = assignees.map((a) =>
        Math.max(28, Math.min(corpR * 0.42, 28 + (a.count / maxCount) * (corpR * 0.38)))
    );

    const positions = packCircles(radii, corpR - 10);

    return assignees.map((_, i) => ({
        x: positions[i]?.x ?? 0,
        y: positions[i]?.y ?? 0,
        r: radii[i],
        idx: i,
    }));
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
    const packed = useMemo(
        () => packAssigneeCircles(corp.assignees, corpR),
        [corp.assignees, corpR]
    );

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
            }}
        >
            {/* Corp label at top */}
            <div
                style={{
                    position: "absolute",
                    top: "10%",
                    left: 0,
                    right: 0,
                    textAlign: "center",
                    pointerEvents: "none",
                    zIndex: 2,
                }}
            >
                <div
                    style={{
                        fontSize: Math.max(10, corpR * 0.13),
                        fontWeight: 700,
                        color: colorScheme.label,
                        lineHeight: 1.2,
                        padding: "0 8px",
                    }}
                >
                    {corp.corporation}
                </div>
                <div style={{ fontSize: Math.max(9, corpR * 0.1), color: "#b05040", marginTop: 2 }}>
                    {corp.total} Tickets
                </div>
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
                            zIndex: 3,
                            cursor: "default",
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
                                fontSize,
                                fontWeight: 700,
                                color: "#fff",
                                textAlign: "center",
                                lineHeight: 1.2,
                                padding: "0 4px",
                                display: "block",
                                maxWidth: p.r * 1.8,
                                wordBreak: "break-word",
                            }}
                        >
                            {assignee.name}
                        </span>
                        <span
                            style={{
                                fontSize: Math.max(7, fontSize - 1),
                                color: "rgba(255,255,255,0.85)",
                                marginTop: 2,
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
    const mainR = Math.min(containerSize / 2 - 16, 260);
    const totalTickets = corporationData.reduce((s, c) => s + c.total, 0) || 1;

    const corpRadii = useMemo(
        () =>
            corporationData.map((c) => {
                const frac = c.total / totalTickets;
                const minR = mainR * 0.18;
                const maxR = mainR * 0.48;
                return Math.max(minR, Math.min(maxR, minR + frac * (maxR - minR) * corporationData.length));
            }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [corporationData, mainR, totalTickets]
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

    return (
        <div
            ref={containerRef}
            style={{
                background: "#fdf4f2",
                borderRadius: 16,
                padding: 16,
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
                    width: mainR * 2,
                    height: mainR * 2,
                    borderRadius: "50%",
                    background:
                        "radial-gradient(circle at 40% 40%, rgba(255,210,200,0.55), rgba(250,180,170,0.25))",
                    border: "2px solid rgba(220,100,80,0.30)",
                    boxShadow:
                        "0 0 60px rgba(240,100,80,0.12), inset 0 0 40px rgba(240,100,80,0.06)",
                    margin: "0 auto",
                    overflow: "hidden",
                }}
            >
                {/* Corp circles positioned absolutely inside main circle */}
                {corporationData.map((corp, idx) => {
                    const r = corpRadii[idx];
                    const pos = corpPositions[idx] ?? { x: 0, y: 0 };
                    const colorScheme = CORP_COLORS[idx % CORP_COLORS.length];

                    return (
                        <div
                            key={corp.corporation}
                            style={{
                                position: "absolute",
                                left: mainR + pos.x - r,
                                top: mainR + pos.y - r,
                            }}
                        >
                            <CorpCircle
                                corp={corp}
                                corpR={r}
                                colorScheme={colorScheme}
                            />
                        </div>
                    );
                })}
            </div>

            {/* ── Legend ── */}
            <div
                style={{
                    display: "flex",
                    flexWrap: "wrap",
                    justifyContent: "center",
                    gap: "8px 20px",
                    marginTop: 20,
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
            </div>
        </div>
    );
};

export default Circlemember;