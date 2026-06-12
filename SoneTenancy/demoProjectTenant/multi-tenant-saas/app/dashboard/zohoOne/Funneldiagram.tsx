"use client";

import React, { useEffect, useMemo, useState } from "react";

// ── Status order (top → bottom of funnel) ─────────────────────────────────────
const FUNNEL_STATUSES = [
    "Open",
    "Re-Open",
    "Acknowledge",
    "WIP",
    "On Hold",
    "On Hold by Customer",
    "Revert Awaited - Customer",
    "Revert Awaited - OEM",
    "Revert Awaited - Vendor",
    "Escalated",
    "Technically Closed",

    "Duplicate",

    "Closed",
];

const SLICE_COLORS = [
    "#F6D365", // Open
    "#F4A460", // Re-Open
    "#C8A2C8", // Acknowledge
    "#B0C4DE", // WIP
    "#9B7FC7", // On Hold
    "#8470A8", // On Hold by Customer
    "#6B8E6B", // Revert Awaited - Customer
    "#4CAF50", // Revert Awaited - OEM
    "#3E9C42", // Revert Awaited - Vendor
    "#2E7D32", // Escalated
    "#E57373", // Technically Closed

    "#880E4F", // Duplicate
  
    "#D32F2F", // Closed
];

type ZohoTicket = {
    id?: string | number;
    ticketNumber?: string | number;
    subject?: string;
    status?: string;
    createdTime?: string;
    department?: { name?: string };
    departmentName?: string;
    assignee?: { firstName?: string; lastName?: string };
};

type TicketApiResponse = {
    responseData?: ZohoTicket[];
    tickets?: { data?: ZohoTicket[] };
    data?: ZohoTicket[];
    error?: string;
};

const normalizeText = (value: unknown) => String(value || "").trim();

const normalizeTicketList = (data: TicketApiResponse): ZohoTicket[] => {
    const list = data?.responseData || data?.tickets?.data || data?.data || [];
    return Array.isArray(list) ? list : [];
};

const mergeTickets = (...groups: ZohoTicket[][]): ZohoTicket[] => {
    const seen = new Set<string>();
    const merged: ZohoTicket[] = [];
    groups.flat().forEach((t) => {
        const key = normalizeText(t?.id || t?.ticketNumber);
        if (key && seen.has(key)) return;
        if (key) seen.add(key);
        merged.push(t);
    });
    return merged;
};

// ── SVG layout constants ──────────────────────────────────────────────────────
// Total canvas: 900 wide so labels have plenty of room on both sides
const SVG_W = 900;
const SVG_H = 680;

const FUNNEL_TOP_Y = 30;
const FUNNEL_BOT_Y = 490;   // bottom of funnel body
const FUNNEL_TOP_HALF_W = 180;   // half-width at widest (top)
const FUNNEL_NECK_HALF_W = 40;   // half-width at narrowest (neck)
const STEM_H = 130;   // height of rectangular stem
const STEM_HALF_W = 40;
const CX = SVG_W / 2; // 450

// Label columns: how far from center the elbow line extends
const LABEL_MARGIN = 20;  // gap between funnel edge and start of connector
const LABEL_COL_X_R = CX + FUNNEL_TOP_HALF_W + LABEL_MARGIN + 80;  // right text anchor
const LABEL_COL_X_L = CX - FUNNEL_TOP_HALF_W - LABEL_MARGIN - 80;  // left  text anchor

/** Funnel half-width at a given Y */
function edgeX(y: number): number {
    const t = (y - FUNNEL_TOP_Y) / (FUNNEL_BOT_Y - FUNNEL_TOP_Y);
    return FUNNEL_TOP_HALF_W - t * (FUNNEL_TOP_HALF_W - FUNNEL_NECK_HALF_W);
}

interface SliceData {
    status: string;
    count: number;
    color: string;
    y1: number;
    y2: number;
}

function buildSlices(counts: { status: string; count: number }[]): SliceData[] {
    const active = counts.filter((c) => c.count > 0);
    if (active.length === 0) return [];

    const total = active.reduce((s, c) => s + c.count, 0);
    const funnelH = FUNNEL_BOT_Y - FUNNEL_TOP_Y;

    const slices: SliceData[] = [];
    let currentY = FUNNEL_TOP_Y;

    active.forEach((item) => {
        const sliceH = (item.count / total) * funnelH;
        const statusIdx = FUNNEL_STATUSES.indexOf(item.status);
        slices.push({
            status: item.status,
            count: item.count,
            color: SLICE_COLORS[statusIdx] ?? "#aaa",
            y1: currentY,
            y2: currentY + sliceH,
        });
        currentY += sliceH;
    });

    return slices;
}

function slicePath(y1: number, y2: number): string {
    const lx1 = CX - edgeX(y1);
    const rx1 = CX + edgeX(y1);
    const lx2 = CX - edgeX(y2);
    const rx2 = CX + edgeX(y2);
    return `M ${lx1} ${y1} L ${rx1} ${y1} L ${rx2} ${y2} L ${lx2} ${y2} Z`;
}

// ── Component ─────────────────────────────────────────────────────────────────
const Funneldiagram = () => {
    const [tickets, setTickets] = useState<ZohoTicket[]>([]);
    const [loading, setLoading] = useState(false);
    const [tooltip, setTooltip] = useState<{
        x: number; y: number; status: string; count: number;
    } | null>(null);

    const fetchTickets = async () => {
        try {
            setLoading(true);
            const zohoCode =
                "1000.04f33ab31de81f3aab2ba867e465f491.450b32689fe2ceda84d00176191074cb";

            const [zohoResponse, ticketsDbResponse] = await Promise.all([
                fetch(`/api/zoho?code=${encodeURIComponent(zohoCode)}`),
                fetch("/api/zoho/tickets-db", { cache: "no-store" }),
            ]);

            const [zohoData, ticketsDbData] = await Promise.all([
                zohoResponse.json(),
                ticketsDbResponse.json(),
            ]);

            if (!zohoResponse.ok && !ticketsDbResponse.ok) {
                throw new Error(zohoData?.error || ticketsDbData?.error || "Failed to fetch");
            }

            const liveTickets = zohoResponse.ok ? normalizeTicketList(zohoData) : [];
            const dbTickets = ticketsDbResponse.ok ? normalizeTicketList(ticketsDbData) : [];
            setTickets(mergeTickets(liveTickets, dbTickets));
        } catch (err) {
            console.error(err);
            setTickets([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { void fetchTickets(); }, []);

    const statusCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        FUNNEL_STATUSES.forEach((s) => (counts[s] = 0));
        tickets.forEach((t) => {
            const raw = normalizeText(t?.status);
            const matched = FUNNEL_STATUSES.find((s) => s.toLowerCase() === raw.toLowerCase());
            if (matched) counts[matched]++;
        });
        return FUNNEL_STATUSES.map((status) => ({ status, count: counts[status] }));
    }, [tickets]);

    const slices = useMemo(() => buildSlices(statusCounts), [statusCounts]);
    const stemColor =
        slices.length > 0
            ? slices[slices.length - 1].color
            : "#D32F2F";
    return (
        <div
            style={{
                background: "#fff",
                borderRadius: 14,
                padding: "24px 12px 20px",
                fontFamily: "'Inter','Segoe UI',sans-serif",
                maxWidth: 960,
                margin: "0 auto",
                boxShadow: "0 2px 20px rgba(0,0,0,0.09)",
            }}
        >
            <h2
                style={{
                    textAlign: "center",
                    fontWeight: 700,
                    fontSize: 20,
                    marginBottom: 12,
                    color: "#1a1a2e",
                    letterSpacing: 0.3,
                }}
            >
                Ticket Status Funnel
            </h2>

            {loading ? (
                <div style={{ textAlign: "center", padding: 80, color: "#888", fontSize: 15 }}>
                    Loading tickets…
                </div>
            ) : (
                <div style={{ position: "relative", width: "100%", overflowX: "auto" }}>
                    <svg
                        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
                        width="100%"
                        style={{ display: "block", minWidth: 600 }}
                    >
                        {/* ── Funnel slices ── */}
                        {slices.map((s) => (
                            <path
                                key={s.status}
                                d={slicePath(s.y1, s.y2)}
                                fill={s.color}
                                stroke="#fff"
                                strokeWidth={1.5}
                                style={{ cursor: "pointer" }}
                                onMouseEnter={(e) => {
                                    const svg = (e.target as SVGPathElement).ownerSVGElement!;
                                    const rect = svg.getBoundingClientRect();
                                    const midY = (s.y1 + s.y2) / 2;
                                    const scaleY = rect.height / SVG_H;
                                    const scaleX = rect.width / SVG_W;
                                    setTooltip({
                                        x: CX * scaleX + rect.left,
                                        y: midY * scaleY + rect.top,
                                        status: s.status,
                                        count: s.count,
                                    });
                                }}
                                onMouseLeave={() => setTooltip(null)}
                            />
                        ))}

                        {/* ── Stem ── */}
                        <rect
                            x={CX - STEM_HALF_W}
                            y={FUNNEL_BOT_Y}
                            width={STEM_HALF_W * 2}
                            height={STEM_H}
                            fill={stemColor}
                            rx={5}
                        />

                        {/* ── Label connector lines & text ── */}
                        {slices.map((s, i) => {
                            const midY = (s.y1 + s.y2) / 2;
                            const isRight = i % 2 === 0;
                            const ex = edgeX(midY);

                            // elbow: from slice edge → horizontal short hop → vertical stub → label column
                            const startX = isRight ? CX + ex : CX - ex;
                            const elbowX = isRight
                                ? CX + FUNNEL_TOP_HALF_W + LABEL_MARGIN
                                : CX - FUNNEL_TOP_HALF_W - LABEL_MARGIN;
                            const textColX = isRight ? LABEL_COL_X_R : LABEL_COL_X_L;
                            const anchor = isRight ? "start" : "end";

                            return (
                                <g key={`lbl-${s.status}`}>
                                    {/* horizontal from slice → elbow */}
                                    <line
                                        x1={startX} y1={midY}
                                        x2={elbowX} y2={midY}
                                        stroke="#888" strokeWidth={1}
                                    />
                                    {/* horizontal from elbow → text column */}
                                    <line
                                        x1={elbowX} y1={midY}
                                        x2={textColX} y2={midY}
                                        stroke="#888" strokeWidth={1}
                                    />
                                    {/* dot at elbow */}
                                    <circle cx={elbowX} cy={midY} r={2.5} fill="#888" />

                                    {/* label text */}
                                    <text
                                        x={isRight ? textColX + 6 : textColX - 6}
                                        y={midY + 5}
                                        fontSize={13}
                                        fontWeight={500}
                                        fill="#222"
                                        textAnchor={anchor}
                                        fontFamily="'Inter','Segoe UI',sans-serif"
                                    >
                                        {s.status} : {s.count}
                                    </text>
                                </g>
                            );
                        })}

                        {/* ── Stem / Dropped label ── */}
                        {(() => {
                            const dropped = statusCounts.find((c) => c.status === "Dropped");
                            if (!dropped || dropped.count === 0) return null;
                            const stemMidY = FUNNEL_BOT_Y + STEM_H / 2;
                            const elbowX = CX + FUNNEL_TOP_HALF_W + LABEL_MARGIN;
                            return (
                                <g>
                                    <line
                                        x1={CX + STEM_HALF_W} y1={stemMidY}
                                        x2={elbowX} y2={stemMidY}
                                        stroke="#888" strokeWidth={1}
                                    />
                                    <line
                                        x1={elbowX} y1={stemMidY}
                                        x2={LABEL_COL_X_R} y2={stemMidY}
                                        stroke="#888" strokeWidth={1}
                                    />
                                    <circle cx={elbowX} cy={stemMidY} r={2.5} fill="#888" />
                                    <text
                                        x={LABEL_COL_X_R + 6}
                                        y={stemMidY + 5}
                                        fontSize={13}
                                        fontWeight={500}
                                        fill="#222"
                                        textAnchor="start"
                                        fontFamily="'Inter','Segoe UI',sans-serif"
                                    >
                                        Dropped : {dropped.count}
                                    </text>
                                </g>
                            );
                        })()}
                    </svg>

                    {/* ── Tooltip ── */}
                    {tooltip && (
                        <div
                            style={{
                                position: "fixed",
                                left: tooltip.x + 14,
                                top: tooltip.y - 22,
                                background: "rgba(15,15,25,0.90)",
                                color: "#fff",
                                padding: "7px 14px",
                                borderRadius: 7,
                                fontSize: 13,
                                fontWeight: 500,
                                pointerEvents: "none",
                                zIndex: 9999,
                                whiteSpace: "nowrap",
                                boxShadow: "0 3px 12px rgba(0,0,0,0.35)",
                            }}
                        >
                            <strong>{tooltip.status}</strong>: {tooltip.count} ticket
                            {tooltip.count !== 1 ? "s" : ""}
                        </div>
                    )}
                </div>
            )}

            {/* ── Legend ── */}
            {!loading && (
                <div
                    style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "8px 18px",
                        marginTop: 22,
                        justifyContent: "center",
                        padding: "0 12px",
                    }}
                >
                    {statusCounts
                        .filter((c) => c.count > 0)
                        .map((c) => {
                            const idx = FUNNEL_STATUSES.indexOf(c.status);
                            return (
                                <div key={c.status} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                    <div
                                        style={{
                                            width: 12, height: 12,
                                            borderRadius: 3,
                                            background: SLICE_COLORS[idx] ?? "#aaa",
                                            flexShrink: 0,
                                        }}
                                    />
                                    <span style={{ fontSize: 13, color: "#333", fontWeight: 500 }}>
                                        {c.status} ({c.count})
                                    </span>
                                </div>
                            );
                        })}
                </div>
            )}
        </div>
    );
};

export default Funneldiagram;