"use client";

import React, { useEffect, useMemo, useState } from "react";

type ZohoTicket = {
  id?: string | number;
  ticketNumber?: string | number;
  status?: string;
  closedTime?: string;
  closed_at?: string;
  closedAt?: string;
  closeTime?: string;
  closedDate?: string;
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

const getClosedDate = (ticket: ZohoTicket) =>
  ticket.closedTime ||
  ticket.closed_at ||
  ticket.closedAt ||
  ticket.closeTime ||
  ticket.closedDate ||
  "";

const isSameMonth = (date: Date, monthDate: Date) =>
  date.getMonth() === monthDate.getMonth() &&
  date.getFullYear() === monthDate.getFullYear();

const getMonthName = (date: Date) =>
  date.toLocaleString("en-IN", { month: "short" });

const Zohoticketcount = () => {
  const [tickets, setTickets] = useState<ZohoTicket[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchTickets = async () => {
    try {
      setLoading(true);

      const res = await fetch("/api/zoho/tickets-db", {
        cache: "no-store",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Failed to fetch tickets");
      }

      setTickets(normalizeTicketList(data));
    } catch (error) {
      console.error("Ticket fetch error:", error);
      setTickets([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchTickets();
  }, []);

  const counts = useMemo(() => {
    let open = 0;
    let wip = 0;
    let onHold = 0;
    let revertAwaited = 0;
    let closed = 0;

    let currentMonthClosed = 0;
    let previousMonthClosed = 0;

    const now = new Date();
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    tickets.forEach((ticket) => {
      const status = normalizeText(ticket.status).toLowerCase();

      if (status === "open" || status === "re-open") open++;
      if (status === "wip") wip++;
      if (status === "on hold" || status === "on hold by customer") onHold++;

      if (
        status === "revert awaited - customer" ||
        status === "revert awaited - oem" ||
        status === "revert awaited - vendor"
      ) {
        revertAwaited++;
      }

      if (status === "closed" || status === "technically closed") {
        closed++;

        const closedDateValue = getClosedDate(ticket);
        const closedDate = new Date(closedDateValue);

        if (!Number.isNaN(closedDate.getTime())) {
          if (isSameMonth(closedDate, currentMonth)) currentMonthClosed++;
          if (isSameMonth(closedDate, previousMonth)) previousMonthClosed++;
        }
      }
    });

    const closedDifference = currentMonthClosed - previousMonthClosed;

    const closedPercentage =
      previousMonthClosed > 0
        ? (closedDifference / previousMonthClosed) * 100
        : currentMonthClosed > 0
        ? 100
        : 0;

    return {
      open,
      wip,
      onHold,
      revertAwaited,
      closed,
      currentMonthClosed,
      previousMonthClosed,
      closedDifference,
      closedPercentage,
      currentMonthName: getMonthName(currentMonth),
      previousMonthName: getMonthName(previousMonth),
    };
  }, [tickets]);

  const cards = [
    {
      title: "Open",
      count: counts.open,
      color: "#2563eb",
      bg: "#dbeafe",
    },
    {
      title: "WIP",
      count: counts.wip,
      color: "#d97706",
      bg: "#fef3c7",
    },
    {
      title: "On Hold",
      count: counts.onHold,
      color: "#f59e0b",
      bg: "#fef3c7",
    },
    {
      title: "Revert Awaited",
      count: counts.revertAwaited,
      color: "#7c3aed",
      bg: "#ede9fe",
    },
    {
      title: "Closed",
      count: counts.closed,
      color: "#16a34a",
      bg: "#dcfce7",
      isClosedCard: true,
    },
  ];

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {cards.map((card) => {
          const isIncrease = counts.closedDifference > 0;
          const isDecrease = counts.closedDifference < 0;

          return (
            <div
              key={card.title}
              className="rounded-2xl border shadow-sm p-4 relative overflow-hidden"
              style={{
                backgroundColor: card.bg,
                borderColor: card.color,
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <p
                  className="text-sm font-semibold mb-2"
                  style={{ color: card.color }}
                >
                  {card.title}
                </p>

                {card.isClosedCard && (
                  <div
                    className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs font-bold ${
                      isIncrease
                        ? "bg-green-100 text-green-700"
                        : isDecrease
                        ? "bg-red-100 text-red-700"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    <span>{isIncrease ? "↑" : isDecrease ? "↓" : "→"}</span>
                    <span>{Math.abs(counts.closedDifference)}</span>
                    <span>
                      ({Math.abs(counts.closedPercentage).toFixed(1)}%)
                    </span>
                  </div>
                )}
              </div>

              <h2 className="text-3xl font-bold" style={{ color: card.color }}>
                {loading ? "..." : card.count}
              </h2>

              {card.isClosedCard && (
                <div className="mt-2 text-[11px] font-medium text-green-700">
                  {counts.currentMonthName}: {counts.currentMonthClosed} |{" "}
                  {counts.previousMonthName}: {counts.previousMonthClosed}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Zohoticketcount;