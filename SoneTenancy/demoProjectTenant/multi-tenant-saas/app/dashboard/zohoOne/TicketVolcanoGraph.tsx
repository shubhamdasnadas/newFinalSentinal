"use client";

import React, { useMemo } from "react";

type VolcanoTicket = {
  createdTime?: string;
  created_at?: string;
  closedTime?: string;
  closed_at?: string;
  closedAt?: string;
  closeTime?: string;
  closedDate?: string;
};

type Bucket = {
  label: string;
  min: number;
  max: number;
  color: string;
};

const buckets: Bucket[] = [
  { label: "0 - 3h", min: 0, max: 3, color: "#2563eb" },
  { label: "3 - 7h", min: 3, max: 7, color: "#22c55e" },
  { label: "7 - 15h", min: 7, max: 15, color: "#eab308" },
  { label: "15 - 30h", min: 15, max: 30, color: "#f97316" },
  { label: "> 30h", min: 30, max: Number.POSITIVE_INFINITY, color: "#ef4444" },
];

const normalizeText = (value: unknown) => String(value || "").trim();

const getCreatedAt = (ticket: VolcanoTicket) =>
  normalizeText(ticket.created_at) || normalizeText(ticket.createdTime);

const getClosedAt = (ticket: VolcanoTicket) =>
  normalizeText(ticket.closed_at) ||
  normalizeText(ticket.closedTime) ||
  normalizeText(ticket.closedAt) ||
  normalizeText(ticket.closeTime) ||
  normalizeText(ticket.closedDate);

const getTicketHours = (ticket: VolcanoTicket) => {
  const createdAt = getCreatedAt(ticket);
  const closedAt = getClosedAt(ticket);
  const createdDate = new Date(createdAt);
  const endDate = closedAt ? new Date(closedAt) : new Date();

  if (
    !createdAt ||
    Number.isNaN(createdDate.getTime()) ||
    Number.isNaN(endDate.getTime()) ||
    endDate.getTime() < createdDate.getTime()
  ) {
    return null;
  }

  return (endDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60);
};

export default function TicketVolcanoGraph({ tickets }: { tickets: VolcanoTicket[] }) {
  const graphBuckets = useMemo(() => {
    const counts = buckets.map((bucket) => ({ ...bucket, count: 0 }));

    tickets.forEach((ticket) => {
      const hours = getTicketHours(ticket);
      if (hours === null) return;

      const bucket = counts.find((item) => hours >= item.min && hours < item.max);
      if (bucket) bucket.count += 1;
    });

    return counts;
  }, [tickets]);

  const maxCount = Math.max(...graphBuckets.map((bucket) => bucket.count), 1);
  const totalCount = graphBuckets.reduce((total, bucket) => total + bucket.count, 0);
  const axisValues = Array.from({ length: 5 }, (_, index) =>
    Math.round((maxCount / 4) * (4 - index))
  );
  const colorBands = useMemo(() => {
    const activeBuckets = graphBuckets.filter((bucket) => bucket.count > 0);

    return activeBuckets.map((bucket, index) => ({
      ...bucket,
      start: index / activeBuckets.length,
      end: (index + 1) / activeBuckets.length,
      share: 1 / activeBuckets.length,
    }));
  }, [graphBuckets]);
  const volcanoPoints = useMemo(() => {
    const points: Array<{
      id: string;
      left: number;
      bottom: number;
      size: number;
      color: string;
      opacity: number;
      delay: number;
      glow: number;
    }> = [];
    const columns = 46;
    const rows = 24;
    const ticketWeight = Math.min(totalCount / Math.max(tickets.length, 1), 1);

    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const x = column / (columns - 1);
        const y = row / (rows - 1);
        const centerDistance = Math.abs(x - 0.5) * 2;
        const depthDistance = Math.abs(y - 0.42) * 1.15;
        const ridge =
          Math.sin(column * 0.85 + row * 0.42) * 0.08 +
          Math.cos(column * 0.37 - row * 0.9) * 0.06;
        const mound = Math.max(0, 1 - centerDistance * 0.9 - depthDistance * 0.68 + ridge);
        const sidePeaks =
          Math.max(0, 1 - Math.abs(x - 0.2) * 9 - Math.abs(y - 0.45) * 2) * 0.42 +
          Math.max(0, 1 - Math.abs(x - 0.78) * 8 - Math.abs(y - 0.5) * 2) * 0.34;
        const heightScore = Math.min(1, mound + sidePeaks + ticketWeight * 0.1);

        if (heightScore <= 0.06 && (column + row) % 3 !== 0) continue;

        const bandPosition = heightScore;
        // const colorBand =
        //   colorBands.find(
        //     (band) =>
        //       bandPosition >= band.start &&
        //       bandPosition < band.end
        //   ) || colorBands[colorBands.length - 1];
        // const color = colorBand?.color || buckets[0].color;
        // const share = colorBand?.share || 0.2;
        const MIN_SHARE = 0.08;

        const shares = graphBuckets.map((bucket) =>
          bucket.count > 0
            ? Math.max(bucket.count / Math.max(totalCount, 1), MIN_SHARE)
            : 0
        );

        const normalizedTotal = shares.reduce((sum, share) => sum + share, 0);

        const normalizedShares = shares.map(
          (share) => share / Math.max(normalizedTotal, 1)
        );

        const blueEnd = normalizedShares[0];
        const greenEnd = blueEnd + normalizedShares[1];
        const yellowEnd = greenEnd + normalizedShares[2];
        const orangeEnd = yellowEnd + normalizedShares[3];

        const position = heightScore;

        let color = "#2563eb";

        if (position <= blueEnd) {
          color = "#2563eb"; // 0-3h
        } else if (position <= greenEnd) {
          color = "#22c55e"; // 3-7h
        } else if (position <= yellowEnd) {
          color = "#eab308"; // 7-15h
        } else if (position <= orangeEnd) {
          color = "#f97316"; // 15-30h
        } else {
          color = "#ef4444"; // >30h
        }
        const perspective = 1 - y * 0.36;
        const bottom = 8 + row * 5.2 + heightScore * 238 * perspective;
        const left = 4 + x * 92;
        const size = 4 + heightScore * 6;
        const share = 1;

        points.push({
          id: `${row}-${column}`,
          left,
          bottom,
          size: Math.max(size + 1.5, 4),
          color,
          opacity: 0.75 + heightScore * 0.25,
          delay: (row * 12 + column * 9) % 520,
          glow: 2.5,
        });
      }
    }

    return points;
  }, [colorBands, tickets.length, totalCount]);

  return (
    <section className="w-full rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-5 shadow-sm">
      <div className="mb-5 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-[var(--foreground)]">Ticket Volcano Graph</h2>
          <p className="text-sm text-[var(--muted)]">Hours on the left, ticket count scale on the right.</p>
        </div>
        <div className="text-sm font-semibold text-[var(--muted)]">{tickets.length} tickets</div>
      </div>

      <div className="relative min-h-[540px] overflow-hidden rounded-lg border border-slate-800 bg-[#06101e] p-5 text-slate-200">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_10%,rgba(239,68,68,0.28),transparent_18%),linear-gradient(125deg,rgba(37,99,235,0.11),transparent_34%),linear-gradient(180deg,#08162a_0%,#050b15_100%)]" />
        <div className="absolute left-1/2 top-0 h-52 w-44 -translate-x-1/2 rounded-full bg-red-500/20 blur-3xl" />
        <div className="absolute left-[48%] top-4 h-44 w-28 -translate-x-1/2 animate-pulse rounded-full bg-orange-500/20 blur-2xl" />

        <div className="absolute left-5 top-8 z-20 space-y-3 text-sm">
          <div className="text-xs font-bold uppercase tracking-wide text-slate-300">Hours</div>
          {graphBuckets
            .slice()
            .reverse()
            .map((bucket) => (
              <div key={bucket.label} className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: bucket.color }} />
                <span className="font-semibold text-slate-300">{bucket.label}</span>
              </div>
            ))}
        </div>

        <div className="absolute right-5 top-8 z-20 flex h-[360px] flex-col justify-between text-right text-xs font-semibold text-slate-400">
          <div className="max-w-20 text-xs font-bold uppercase leading-tight text-slate-300">
            Number of Tickets
          </div>
          {axisValues.map((value) => (
            <div key={value}>{value}</div>
          ))}
        </div>

        <div className="absolute inset-x-14 bottom-24 top-28 z-0 skew-x-[-18deg] border-b border-l border-slate-600/30">
          <div className="h-full w-full bg-[linear-gradient(90deg,rgba(148,163,184,0.13)_1px,transparent_1px),linear-gradient(0deg,rgba(148,163,184,0.13)_1px,transparent_1px)] bg-[size:54px_38px]" />
        </div>

        <div className="absolute inset-x-[9%] bottom-24 top-16 z-10">
          <div className="absolute left-1/2 top-0 h-32 w-20 -translate-x-1/2 rounded-full bg-red-500/30 blur-2xl" />
          <div className="absolute left-1/2 top-10 h-28 w-8 -translate-x-1/2 bg-gradient-to-b from-red-500/50 to-transparent blur-xl" />
          {volcanoPoints.map((point) => (
            <span
              key={point.id}
              className="absolute animate-[volcano-rise_780ms_ease-out_both] rounded-full"
              style={{
                left: `${point.left}%`,
                bottom: `${point.bottom}px`,
                height: `${point.size}px`,
                width: `${point.size}px`,
                backgroundColor: point.color,
                boxShadow: `
    0 0 12px ${point.color},
    0 0 24px ${point.color},
    0 0 36px ${point.color}
  `,
                opacity: point.opacity,
                animationDelay: `${point.delay}ms`,
              }}
            />
          ))}
        </div>

        {/* <div className="absolute inset-x-6 bottom-5 z-20 grid grid-cols-3 gap-3 text-center text-xs font-semibold text-slate-400 sm:grid-cols-6">
          {["Network", "Access", "Application", "Security", "Hardware", "Code"].map((category) => (
            <div key={category} className="flex flex-col items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-500/50 bg-slate-900/80 text-slate-300 shadow-lg">
                {category.slice(0, 1)}
              </span>
              <span>{category}</span>
            </div>
          ))}
        </div> */}

        <div className="absolute bottom-24 left-[10%] right-[10%] z-10 h-32 bg-gradient-to-t from-blue-500/20 to-transparent blur-2xl" />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-5">
        {graphBuckets.map((bucket) => (
          <div key={bucket.label} className="rounded-md border border-[var(--card-border)] bg-[var(--muted-bg)] px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: bucket.color }} />
              <span className="text-xs font-bold uppercase text-[var(--muted)]">{bucket.label}</span>
            </div>
            <div className="mt-1 text-lg font-bold text-[var(--foreground)]">{bucket.count}</div>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes volcano-rise {
          from {
            transform: translateY(18px) scale(0.35);
            opacity: 0;
          }
          to {
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </section>
  );
}
