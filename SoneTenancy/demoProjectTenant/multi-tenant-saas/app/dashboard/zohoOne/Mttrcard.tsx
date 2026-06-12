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

const getCreatedDate = (ticket: Mttr) =>
  ticket.createdTime || ticket.created_at || "";

const getClosedDate = (ticket: Mttr) =>
  ticket.closedTime ||
  ticket.closed_at ||
  ticket.closedAt ||
  ticket.closeTime ||
  ticket.closedDate ||
  "";

const getMttrScore = (hours: number) => {
  if (hours < 12) return 100;
  if (hours < 24) return 90;
  if (hours < 36) return 75;
  if (hours < 48) return 60;
  if (hours < 60) return 40;
  return 20;
};

const getScoreColor = (score: number) => {
  if (score >= 80) return "#22c55e";
  if (score >= 60) return "#84cc16";
  if (score >= 40) return "#eab308";
  return "#ef4444";
};

const MttrGauge = ({
  title,
  score,
  hours,
  subtitle,
  small = false,
}: {
  title: string;
  score: number;
  hours: number;
  subtitle: string;
  small?: boolean;
}) => {
  const rotation = (score / 100) * 180 - 90;
  const scoreColor = getScoreColor(score);

  return (
    <div className="flex flex-col items-center rounded-xl border border-slate-700 bg-slate-950/40 p-4">
      <h3 className="mb-3 text-sm font-bold text-white">{title}</h3>

      <div className={`relative ${small ? "h-[120px] w-[220px]" : "h-[180px] w-[320px]"}`}>
        <svg viewBox="0 0 320 180" className="absolute inset-0">
          <path d="M40 150 A120 120 0 0 1 90 60" stroke="#ef4444" strokeWidth="28" fill="none" strokeLinecap="round" />
          <path d="M90 60 A120 120 0 0 1 145 35" stroke="#f59e0b" strokeWidth="28" fill="none" strokeLinecap="round" />
          <path d="M145 35 A120 120 0 0 1 175 35" stroke="#eab308" strokeWidth="28" fill="none" strokeLinecap="round" />
          <path d="M175 35 A120 120 0 0 1 230 60" stroke="#84cc16" strokeWidth="28" fill="none" strokeLinecap="round" />
          <path d="M230 60 A120 120 0 0 1 280 150" stroke="#22c55e" strokeWidth="28" fill="none" strokeLinecap="round" />
        </svg>

        <div
          className="absolute left-1/2 bottom-[28px] origin-bottom"
          style={{
            transform: `translateX(-50%) rotate(${rotation}deg)`,
          }}
        >
          <div
            className={`${small ? "h-[75px]" : "h-[110px]"} w-[4px] rounded-full`}
            style={{ backgroundColor: scoreColor }}
          />
        </div>

        <div className="absolute bottom-[15px] left-1/2 h-8 w-8 -translate-x-1/2 rounded-full bg-slate-200 shadow-lg" />
      </div>

      <div className="text-center">
        <div
          className={`${small ? "text-3xl" : "text-5xl"} font-bold`}
          style={{ color: scoreColor }}
        >
          {score}
        </div>

        <div className="mt-1 text-xs text-slate-400">MTTR Score</div>

        <div className="mt-2 text-base font-semibold text-white">
          {hours.toFixed(2)} Hours
        </div>

        <div className="text-xs text-slate-400">{subtitle}</div>
      </div>
    </div>
  );
};

const Mttrcard = ({ tickets }: { tickets: Mttr[] }) => {
  const { avgResolutionTime, minResolutionTime, maxResolutionTime, avgScore, minScore, maxScore } =
    useMemo(() => {
      const resolutionTimes = tickets
        .map((ticket) => {
          const created = new Date(getCreatedDate(ticket));
          const closed = new Date(getClosedDate(ticket));

          if (
            isNaN(created.getTime()) ||
            isNaN(closed.getTime()) ||
            closed < created
          ) {
            return null;
          }

          return (closed.getTime() - created.getTime()) / (1000 * 60 * 60);
        })
        .filter((time): time is number => time !== null);

      const avg =
        resolutionTimes.length > 0
          ? resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length
          : 0;

      const min = resolutionTimes.length > 0 ? Math.min(...resolutionTimes) : 0;
      const max = resolutionTimes.length > 0 ? Math.max(...resolutionTimes) : 0;
        console.log("Resolution Times:", resolutionTimes);
        console.log("Average Resolution Time:", avg);
        console.log("Minimum Resolution Time:", min);
        console.log("Maximum Resolution Time:", max);
      return {
        avgResolutionTime: avg,
        minResolutionTime: min,
        maxResolutionTime: max,
        avgScore: getMttrScore(avg),
        minScore: getMttrScore(min),
        maxScore: getMttrScore(max),
      };
    }, [tickets]);

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-lg">
      <h2 className="mb-6 text-xl font-bold text-white">MTTR Score</h2>

      <MttrGauge
        title="Average MTTR"
        score={avgScore}
        hours={avgResolutionTime}
        subtitle="Mean Time To Resolution"
      />

      {/* <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <MttrGauge
          title="Minimum MTTR"
          score={minScore}
          hours={minResolutionTime}
          subtitle="Fastest Ticket Resolution"
          small
        />

        <MttrGauge
          title="Maximum MTTR"
          score={maxScore}
          hours={maxResolutionTime}
          subtitle="Slowest Ticket Resolution"
          small
        />
      </div> */}
    </div>
  );
};

export default Mttrcard;