"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import TicketVolcanoGraph from "./TicketVolcanoGraph";

type ZohoTicket = {
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

type TicketApiResponse = {
  responseData?: ZohoTicket[];
  tickets?: {
    data?: ZohoTicket[];
  };
  data?: ZohoTicket[];
  error?: string;
};

const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const agingBuckets = ["<1h", "1-4h", "4-24h", "1-3d", "3+d"] as const;
const barColors = [
  "#2563eb",
  "#16a34a",
  "#f59e0b",
  "#dc2626",
  "#7c3aed",
  "#0891b2",
  "#db2777",
];
const closedStatuses = new Set(["closed", "technically closed", "duplicate"]);

const normalizeTicketList = (data: TicketApiResponse) => {
  const ticketList = data?.responseData || data?.tickets?.data || data?.data || [];
  return Array.isArray(ticketList) ? ticketList : [];
};

const normalizeText = (value: unknown) => String(value || "").trim();

const getTicketNo = (ticket: ZohoTicket) =>
  normalizeText(ticket.ticket_no) || normalizeText(ticket.ticketNumber) || "-";

const getCreatedAt = (ticket: ZohoTicket) =>
  normalizeText(ticket.created_at) || normalizeText(ticket.createdTime);

const getClosedAt = (ticket: ZohoTicket) =>
  normalizeText(ticket.closed_at) ||
  normalizeText(ticket.closedTime) ||
  normalizeText(ticket.closedAt) ||
  normalizeText(ticket.closeTime) ||
  normalizeText(ticket.closedDate);

const getCustomerResponseTime = (ticket: ZohoTicket) =>
  normalizeText(ticket.customerResponseTime) ||
  normalizeText(ticket.customer_response_time) ||
  normalizeText(ticket.customer_responseTime) ||
  normalizeText(ticket.responseTime) ||
  "-";

const getAssigneeName = (ticket: ZohoTicket) => {
  const firstName = normalizeText(ticket.assignee?.firstName);
  const lastName = normalizeText(ticket.assignee?.lastName);
  return `${firstName} ${lastName}`.trim() || "Unassigned";
};

const getDepartmentName = (ticket: ZohoTicket) =>
  normalizeText(ticket.department?.name) ||
  normalizeText(ticket.departmentName) ||
  "Unknown Department";

const isClosedTicket = (ticket: ZohoTicket) =>
  closedStatuses.has(normalizeText(ticket.status).toLowerCase());

const getResolutionTimeBucket = (ticket: ZohoTicket) => {
  if (!isClosedTicket(ticket)) return null;

  const createdAt = getCreatedAt(ticket);
  const closedAt = getClosedAt(ticket);
  const createdDate = new Date(createdAt);
  const closedDate = new Date(closedAt);

  if (
    !createdAt ||
    !closedAt ||
    Number.isNaN(createdDate.getTime()) ||
    Number.isNaN(closedDate.getTime()) ||
    closedDate.getTime() < createdDate.getTime()
  ) {
    return null;
  }

  const resolutionHours = (closedDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60);

  if (resolutionHours < 1) return "<1h";
  if (resolutionHours < 4) return "1-4h";
  if (resolutionHours < 24) return "4-24h";
  if (resolutionHours < 72) return "1-3d";
  return "3+d";
};

const formatDateTime = (date?: string) => {
  if (!date) return "-";

  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "-";

  return parsed.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatResolutionTime = (ticket: ZohoTicket) => {
  const createdAt = getCreatedAt(ticket);
  const closedAt = getClosedAt(ticket);
  const createdDate = new Date(createdAt);
  const closedDate = new Date(closedAt);

  if (
    !createdAt ||
    !closedAt ||
    Number.isNaN(createdDate.getTime()) ||
    Number.isNaN(closedDate.getTime()) ||
    closedDate.getTime() < createdDate.getTime()
  ) {
    return "-";
  }

  const totalMinutes = Math.round((closedDate.getTime() - createdDate.getTime()) / (1000 * 60));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

const pageSize = 10;

const getTicketKey = (ticket: ZohoTicket, index: number) =>
  normalizeText(ticket.id) || normalizeText(ticket.ticketNumber) || normalizeText(ticket.ticket_no) || String(index);

function TicketTracking({ ticket }: { ticket: ZohoTicket }) {
  const createdTime = formatDateTime(getCreatedAt(ticket));
  const customerResponseTime = getCustomerResponseTime(ticket);
  const closedTime = formatDateTime(getClosedAt(ticket));
  const hasCreatedTime = createdTime !== "-";
  const hasCustomerResponseTime = customerResponseTime !== "-";
  const hasClosedTime = closedTime !== "-";
  const progress = hasClosedTime ? 100 : hasCustomerResponseTime ? 50 : hasCreatedTime ? 8 : 0;
  const steps = [
    { label: "Created Time", value: createdTime, complete: hasCreatedTime },
    { label: "Customer Response Time", value: customerResponseTime, complete: hasCustomerResponseTime },
    { label: "Closed Time", value: closedTime, complete: hasClosedTime },
  ];

  return (
    <div className="rounded-md bg-[var(--card-bg)] px-4 py-5">
      <div className="relative mx-1 pb-2">
        <div className="absolute left-0 right-0 top-4 h-2 rounded-full bg-slate-200" />
        <div
          className="absolute left-0 top-4 h-2 rounded-full bg-indigo-600 transition-all duration-700 ease-out"
          style={{ width: `${progress}%` }}
        />

        <div className="relative grid grid-cols-3 gap-3">
          {steps.map((step, index) => (
            <div
              key={step.label}
              className={`flex ${index === 0 ? "items-start" : index === 1 ? "items-center" : "items-end"} flex-col`}
            >
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all duration-500 ${
                  step.complete
                    ? "border-indigo-600 bg-indigo-600 text-white shadow-[0_0_0_6px_rgba(79,70,229,0.12)]"
                    : "border-indigo-500 bg-[var(--card-bg)] text-indigo-600"
                }`}
              >
                {step.complete ? (
                  <span className="text-sm leading-none">✓</span>
                ) : (
                  <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-indigo-500" />
                )}
              </span>

              <div
                className={`mt-4 max-w-[180px] text-sm ${
                  index === 0 ? "text-left" : index === 1 ? "text-center" : "text-right"
                }`}
              >
                <div className="text-xs font-bold uppercase text-[var(--muted)]">{step.label}</div>
                <div className="mt-1 font-medium text-[var(--foreground)]">{step.value}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TicketListCard({ tickets, loading }: { tickets: ZohoTicket[]; loading: boolean }) {
  const [assignee, setAssignee] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  const assignees = useMemo(
    () =>
      Array.from(new Set(tickets.map(getAssigneeName)))
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b)),
    [tickets]
  );

  const filteredTickets = useMemo(() => {
    const from = fromDate ? new Date(`${fromDate}T00:00:00`) : null;
    const to = toDate ? new Date(`${toDate}T23:59:59`) : null;

    return tickets.filter((ticket) => {
      if (assignee !== "all" && getAssigneeName(ticket) !== assignee) return false;

      const createdAt = getCreatedAt(ticket);
      const createdDate = new Date(createdAt);

      if ((from || to) && (!createdAt || Number.isNaN(createdDate.getTime()))) return false;
      if (from && createdDate < from) return false;
      if (to && createdDate > to) return false;

      return true;
    });
  }, [assignee, fromDate, tickets, toDate]);

  const pageCount = Math.max(Math.ceil(filteredTickets.length / pageSize), 1);
  const safePage = Math.min(page, pageCount);
  const startIndex = filteredTickets.length ? (safePage - 1) * pageSize : 0;
  const endIndex = Math.min(startIndex + pageSize, filteredTickets.length);
  const visibleTickets = filteredTickets.slice(startIndex, endIndex);

  const paginationPages = Array.from({ length: pageCount }, (_, index) => index + 1).filter(
    (pageNumber) =>
      pageNumber === 1 ||
      pageNumber === pageCount ||
      Math.abs(pageNumber - safePage) <= 1
  );

  const goToPage = (pageNumber: number) => setPage(Math.min(Math.max(pageNumber, 1), pageCount));
  const resetTable = () => {
    setPage(1);
    setExpandedRows({});
  };

  return (
    <section className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-5 shadow-sm">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-xl font-bold text-[var(--foreground)]">Ticket Details</h2>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[620px]">
          <label className="text-sm font-medium text-[var(--foreground)]">
            <span className="mb-1 block">Assignee</span>
            <select
              value={assignee}
              onChange={(event) => {
                setAssignee(event.target.value);
                resetTable();
              }}
              className="h-10 w-full rounded-md border border-[var(--card-border)] bg-[var(--muted-bg)] px-3 text-sm text-[var(--foreground)] outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All assignees</option>
              {assignees.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium text-[var(--foreground)]">
            <span className="mb-1 block">From</span>
            <input
              type="date"
              value={fromDate}
              onChange={(event) => {
                setFromDate(event.target.value);
                resetTable();
              }}
              className="h-10 w-full rounded-md border border-[var(--card-border)] bg-[var(--muted-bg)] px-3 text-sm text-[var(--foreground)] outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </label>

          <label className="text-sm font-medium text-[var(--foreground)]">
            <span className="mb-1 block">To</span>
            <input
              type="date"
              value={toDate}
              onChange={(event) => {
                setToDate(event.target.value);
                resetTable();
              }}
              className="h-10 w-full rounded-md border border-[var(--card-border)] bg-[var(--muted-bg)] px-3 text-sm text-[var(--foreground)] outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </label>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-[var(--card-border)] bg-[var(--muted-bg)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] border-collapse text-sm">
            <thead>
              <tr className="bg-[var(--card-bg)]">
                <th className="w-12 px-4 py-3 text-left font-semibold text-[var(--foreground)]" />
                <th className="px-4 py-3 text-left font-semibold text-[var(--foreground)]">Subject</th>
              </tr>
            </thead>
            <tbody>
              {visibleTickets.map((ticket, index) => {
                const key = getTicketKey(ticket, startIndex + index);
                const isExpanded = Boolean(expandedRows[key]);

                return (
                  <React.Fragment key={key}>
                    <tr className="border-t border-[var(--card-border)]">
                      <td className="px-4 py-3 align-top">
                        <button
                          type="button"
                          aria-expanded={isExpanded}
                          aria-label={`${isExpanded ? "Hide" : "Show"} timing details`}
                          onClick={() =>
                            setExpandedRows((current) => ({
                              ...current,
                              [key]: !current[key],
                            }))
                          }
                          className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--card-border)] bg-[var(--card-bg)] text-sm font-bold text-[var(--foreground)] transition-colors hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          {isExpanded ? "^" : "v"}
                        </button>
                      </td>
                      <td className="px-4 py-3 font-medium text-[var(--foreground)]">
                        {ticket.subject || "-"}
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr className="border-t border-[var(--card-border)] bg-[var(--card-bg)]">
                        <td className="px-4 py-3" />
                        <td className="px-4 py-3">
                          <TicketTracking ticket={ticket} />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}

              {!visibleTickets.length && (
                <tr>
                  <td colSpan={2} className="px-4 py-8 text-center text-[var(--muted)]">
                    {loading ? "Loading..." : "No tickets found"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-[var(--card-border)] bg-[var(--card-bg)] px-4 py-3 text-sm text-[var(--muted)] sm:flex-row sm:items-center sm:justify-between">
          <div>
            Showing {filteredTickets.length ? startIndex + 1 : 0} to {endIndex} of {filteredTickets.length} entries
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => goToPage(1)}
              disabled={safePage === 1}
              className="rounded-md border border-[var(--card-border)] px-3 py-1.5 font-medium text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              First
            </button>
            <button
              type="button"
              onClick={() => goToPage(safePage - 1)}
              disabled={safePage === 1}
              className="rounded-md border border-[var(--card-border)] px-3 py-1.5 font-medium text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Prev
            </button>

            {paginationPages.map((pageNumber, index) => {
              const previousPage = paginationPages[index - 1];
              const showGap = previousPage && pageNumber - previousPage > 1;

              return (
                <React.Fragment key={pageNumber}>
                  {showGap && <span className="px-1">...</span>}
                  <button
                    type="button"
                    onClick={() => goToPage(pageNumber)}
                    className={`h-9 min-w-9 rounded-md border border-[var(--card-border)] px-3 font-semibold ${
                      safePage === pageNumber
                        ? "bg-indigo-600 text-white"
                        : "text-[var(--foreground)]"
                    }`}
                  >
                    {pageNumber}
                  </button>
                </React.Fragment>
              );
            })}

            <button
              type="button"
              onClick={() => goToPage(safePage + 1)}
              disabled={safePage === pageCount}
              className="rounded-md border border-[var(--card-border)] px-3 py-1.5 font-medium text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
            <button
              type="button"
              onClick={() => goToPage(pageCount)}
              disabled={safePage === pageCount}
              className="rounded-md border border-[var(--card-border)] px-3 py-1.5 font-medium text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Last
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function TicketHoverTable({
  title,
  tickets,
  onMouseEnter,
  onMouseLeave,
  inline = false,
}: {
  title: string;
  tickets: ZohoTicket[];
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  inline?: boolean;
}) {
  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={
        inline
          ? "mb-5 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-3 text-[var(--foreground)] shadow-sm"
          : "fixed left-1/2 top-24 z-50 w-[min(92vw,780px)] -translate-x-1/2 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-3 text-[var(--foreground)] shadow-xl"
      }
    >
      <p className="mb-2 text-sm font-semibold">{title}</p>
      <div className="max-h-72 overflow-auto">
        <table className="w-full min-w-[900px] border-collapse text-xs">
          <thead>
            <tr className="bg-[var(--muted-bg)]">
              <th className="border border-[var(--card-border)] px-2 py-2 text-left">ticket_no</th>
              <th className="border border-[var(--card-border)] px-2 py-2 text-left">subject</th>
              <th className="border border-[var(--card-border)] px-2 py-2 text-left">createdTime</th>
              <th className="border border-[var(--card-border)] px-2 py-2 text-left">closedTime</th>
              <th className="border border-[var(--card-border)] px-2 py-2 text-left">resolve_time</th>
              <th className="border border-[var(--card-border)] px-2 py-2 text-left">assignee</th>
              <th className="border border-[var(--card-border)] px-2 py-2 text-left">status</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((ticket, index) => (
              <tr key={`${getTicketNo(ticket)}-${ticket.id || index}`}>
                <td className="border border-[var(--card-border)] px-2 py-2">{getTicketNo(ticket)}</td>
                <td className="border border-[var(--card-border)] px-2 py-2">{ticket.subject || "-"}</td>
                <td className="border border-[var(--card-border)] px-2 py-2">{formatDateTime(getCreatedAt(ticket))}</td>
                <td className="border border-[var(--card-border)] px-2 py-2">{formatDateTime(getClosedAt(ticket))}</td>
                <td className="border border-[var(--card-border)] px-2 py-2">{formatResolutionTime(ticket)}</td>
                <td className="border border-[var(--card-border)] px-2 py-2">{getAssigneeName(ticket)}</td>
                <td className="border border-[var(--card-border)] px-2 py-2">{ticket.status || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function HoverCount({
  title,
  count,
  tickets,
}: {
  title: string;
  count: number;
  tickets: ZohoTicket[];
}) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearCloseTimer = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  const showTooltip = () => {
    clearCloseTimer();
    setOpen(true);
  };

  const hideTooltip = () => {
    clearCloseTimer();
    closeTimer.current = setTimeout(() => setOpen(false), 180);
  };

  useEffect(() => {
    return () => clearCloseTimer();
  }, []);

  return (
    <span
      className="relative inline-flex min-w-10 justify-end"
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
    >
      <span className={count ? "cursor-pointer font-semibold text-indigo-600" : "text-[var(--muted)]"}>
        {count}
      </span>
      {open && count > 0 && (
        <TicketHoverTable
          title={title}
          tickets={tickets}
          onMouseEnter={clearCloseTimer}
          onMouseLeave={hideTooltip}
        />
      )}
    </span>
  );
}

const Zohoone = () => {
  const [tickets, setTickets] = useState<ZohoTicket[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeDay, setActiveDay] = useState<string | null>(null);

  const fetchTickets = async () => {
    try {
      setLoading(true);

      const response = await fetch("/api/zoho/tickets-db", {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Failed to fetch tickets");
      }

      const dbTickets = normalizeTicketList(data);
      setTickets(dbTickets);
    } catch (err) {
      console.error(err);
      setTickets([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchTickets();
  }, []);

  const ticketTrend = useMemo(() => {
    const grouped = weekdays.map((day) => ({ day, tickets: [] as ZohoTicket[] }));

    tickets.forEach((ticket) => {
      const createdAt = getCreatedAt(ticket);
      const date = new Date(createdAt);
      if (!createdAt || Number.isNaN(date.getTime())) return;

      const mondayFirstIndex = (date.getDay() + 6) % 7;
      grouped[mondayFirstIndex].tickets.push(ticket);
    });

    return grouped;
  }, [tickets]);

  const engineerPerformance = useMemo(() => {
    const grouped: Record<string, { engineer: string; open: ZohoTicket[]; closed: ZohoTicket[] }> = {};

    tickets.forEach((ticket) => {
      const engineer = getAssigneeName(ticket);
      if (engineer === "Unassigned") return;

      if (!grouped[engineer]) grouped[engineer] = { engineer, open: [], closed: [] };

      if (isClosedTicket(ticket)) {
        grouped[engineer].closed.push(ticket);
      } else {
        grouped[engineer].open.push(ticket);
      }
    });

    return Object.values(grouped).sort((a, b) => {
      const closedDiff = b.closed.length - a.closed.length;
      return closedDiff || a.engineer.localeCompare(b.engineer);
    });
  }, [tickets]);

  const activeTrend = ticketTrend.find((row) => row.day === activeDay);
  const maxTicketCount = Math.max(...ticketTrend.map((row) => row.tickets.length), 1);

  const departmentAgingMatrix = useMemo(() => {
    const grouped: Record<string, Record<(typeof agingBuckets)[number], ZohoTicket[]>> = {};

    tickets.forEach((ticket) => {
      const department = getDepartmentName(ticket);
      const bucket = getResolutionTimeBucket(ticket);
      if (!bucket) return;

      if (!grouped[department]) {
        grouped[department] = {
          "<1h": [],
          "1-4h": [],
          "4-24h": [],
          "1-3d": [],
          "3+d": [],
        };
      }

      grouped[department][bucket].push(ticket);
    });

    return Object.entries(grouped)
      .map(([department, buckets]) => ({ department, buckets }))
      .sort((a, b) => {
        const aTotal = agingBuckets.reduce((total, bucket) => total + a.buckets[bucket].length, 0);
        const bTotal = agingBuckets.reduce((total, bucket) => total + b.buckets[bucket].length, 0);
        return bTotal - aTotal || a.department.localeCompare(b.department);
      });
  }, [tickets]);

  const monthDepartmentMatrix = useMemo(() => {
    const monthMap = new Map<string, string>();
    const departmentMap: Record<string, Record<string, ZohoTicket[]>> = {};

    tickets.forEach((ticket) => {
      const createdAt = getCreatedAt(ticket);
      const date = new Date(createdAt);
      if (!createdAt || Number.isNaN(date.getTime())) return;

      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const monthLabel = date.toLocaleString("en-US", { month: "short" });
      const department = getDepartmentName(ticket);

      monthMap.set(monthKey, monthLabel);
      if (!departmentMap[department]) departmentMap[department] = {};
      if (!departmentMap[department][monthKey]) departmentMap[department][monthKey] = [];

      departmentMap[department][monthKey].push(ticket);
    });

    const months = Array.from(monthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-5)
      .map(([key, label]) => ({ key, label }));

    const rows = Object.entries(departmentMap)
      .map(([department, monthTickets]) => ({ department, monthTickets }))
      .sort((a, b) => {
        const aTotal = months.reduce((total, month) => total + (a.monthTickets[month.key]?.length || 0), 0);
        const bTotal = months.reduce((total, month) => total + (b.monthTickets[month.key]?.length || 0), 0);
        return bTotal - aTotal || a.department.localeCompare(b.department);
      });

    return { months, rows };
  }, [tickets]);

  const maxAgingCount = Math.max(
    ...departmentAgingMatrix.flatMap((row) =>
      agingBuckets.map((bucket) => row.buckets[bucket].length)
    ),
    1
  );

  const maxMonthDepartmentCount = Math.max(
    ...monthDepartmentMatrix.rows.flatMap((row) =>
      monthDepartmentMatrix.months.map((month) => row.monthTickets[month.key]?.length || 0)
    ),
    1
  );
  const monthGridStyle = {
    "--month-grid": `minmax(150px, 1.4fr) repeat(${Math.max(
      monthDepartmentMatrix.months.length,
      1
    )}, minmax(72px, 1fr))`,
  } as React.CSSProperties;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Zoho One</h1>
          <p className="text-sm text-[var(--muted)]">Ticket analytics from stored Zoho data.</p>
        </div>
        <div className="text-sm text-[var(--muted)]">
          {loading ? "Loading tickets..." : `${tickets.length} tickets`}
        </div>
      </div>

      <TicketListCard tickets={tickets} loading={loading} />
      <TicketVolcanoGraph tickets={tickets} />

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-5 shadow-sm">
          <div className="mb-5">
            <h2 className="text-xl font-bold text-[var(--foreground)]">Ticket Trend</h2>
            {/* <p className="mt-2 text-sm text-[var(--muted)]">All tickets by weekday.</p> */}
          </div>

          <div
            className="rounded-lg border border-[var(--card-border)] bg-[var(--muted-bg)] p-4 sm:p-6"
          >
            {activeTrend && activeTrend.tickets.length > 0 && (
              <TicketHoverTable
                inline
                title={`${activeTrend.day} tickets (${activeTrend.tickets.length})`}
                tickets={activeTrend.tickets}
              />
            )}

            <div className="flex h-32 items-end gap-3 overflow-x-auto pb-2 sm:gap-5">
              {ticketTrend.map((row, index) => {
                const count = row.tickets.length;
                const height = Math.max((count / maxTicketCount) * 100, count ? 10 : 3);
                const isSelected = activeDay === row.day;

                return (
                  <div
                    key={row.day}
                    className="flex min-w-16 flex-1 flex-col items-center justify-end gap-2"
                  >
                    <button
                      type="button"
                      onClick={() => setActiveDay((current) => (current === row.day ? null : row.day))}
                      className={`rounded px-1.5 py-0.5 text-sm font-bold transition-colors ${
                        isSelected
                          ? "bg-indigo-600 text-white"
                          : count
                            ? "text-[var(--foreground)] hover:bg-[var(--card-bg)]"
                            : "text-[var(--foreground)]"
                      }`}
                    >
                      {count}
                    </button>
                    <button
                      type="button"
                      aria-label={`${row.day}: ${count} tickets`}
                      className="w-full min-w-12 rounded-t-md transition-all hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      style={{
                        height: `${height}%`,
                        backgroundColor: barColors[index],
                      }}
                      onClick={() => setActiveDay((current) => (current === row.day ? null : row.day))}
                    />
                    <div className="text-xs font-semibold text-[var(--muted)]">{row.day}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* <p className="mt-4 text-sm text-[var(--muted)]">Shows ticket spikes across all stored data.</p> */}
        </section>

        <section className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-5 shadow-sm">
          <div className="mb-5">
            <h2 className="text-xl font-bold text-[var(--foreground)]">Engineer Performance</h2>
            {/* <p className="mt-2 text-sm text-[var(--muted)]">Using assignee.</p> */}
          </div>

          <div className="overflow-x-auto rounded-lg border border-[var(--card-border)] bg-[var(--muted-bg)] p-4">
            <table className="w-full min-w-[360px] text-sm">
              <thead>
                <tr>
                  <th className="pb-3 text-left font-semibold text-[var(--foreground)]">Engineer</th>
                  <th className="pb-3 text-right font-semibold text-[var(--foreground)]">Open</th>
                  <th className="pb-3 text-right font-semibold text-[var(--foreground)]">Closed</th>
                </tr>
              </thead>
              <tbody>
                {engineerPerformance.map((row) => (
                  <tr key={row.engineer}>
                    <td className="py-1.5 pr-6 font-medium text-[var(--foreground)]">{row.engineer}</td>
                    <td className="py-1.5 text-right">
                      <HoverCount
                        title={`${row.engineer} open tickets`}
                        count={row.open.length}
                        tickets={row.open}
                      />
                    </td>
                    <td className="py-1.5 text-right">
                      <HoverCount
                        title={`${row.engineer} closed tickets`}
                        count={row.closed.length}
                        tickets={row.closed}
                      />
                    </td>
                  </tr>
                ))}

                {!engineerPerformance.length && (
                  <tr>
                    <td colSpan={3} className="py-6 text-center text-[var(--muted)]">
                      {loading ? "Loading..." : "No tickets found"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-5 shadow-sm">
          <div className="mb-5">
            <h2 className="text-xl font-bold text-[var(--foreground)]">Department Based Resolution Time Heatmap</h2>
            {/* <p className="mt-2 text-sm text-[var(--muted)]">Closed tickets by resolution time.</p> */}
          </div>

          <div className="rounded-lg border border-[var(--card-border)] bg-[var(--muted-bg)] p-4">
            {departmentAgingMatrix.length ? (
              <div className="space-y-4">
                <div className="hidden grid-cols-[minmax(150px,1.4fr)_repeat(5,minmax(72px,1fr))] gap-2 text-xs font-semibold text-[var(--muted)] md:grid">
                  <div>Department</div>
                  {agingBuckets.map((bucket) => (
                    <div key={bucket} className="text-center">
                      {bucket}
                    </div>
                  ))}
                </div>

                {departmentAgingMatrix.map((row) => (
                  <div
                    key={row.department}
                    className="grid gap-2 md:grid-cols-[minmax(150px,1.4fr)_repeat(5,minmax(72px,1fr))]"
                  >
                    <div className="flex items-center rounded-md bg-[var(--card-bg)] px-3 py-2 text-sm font-semibold text-[var(--foreground)]">
                      {row.department}
                    </div>

                    {agingBuckets.map((bucket) => {
                      const bucketTickets = row.buckets[bucket];
                      const count = bucketTickets.length;
                      const intensity = count / maxAgingCount;

                      return (
                        <div
                          key={bucket}
                          className="rounded-md border border-[var(--card-border)] px-3 py-2"
                          style={{
                            backgroundColor: count
                              ? `rgba(79, 70, 229, ${0.12 + intensity * 0.45})`
                              : "var(--card-bg)",
                          }}
                        >
                          <div className="mb-1 flex items-center justify-between gap-2 md:hidden">
                            <span className="text-xs font-semibold text-[var(--muted)]">{bucket}</span>
                          </div>
                          <div className="flex items-center justify-between gap-2 md:justify-center">
                            <span className="h-2 w-2 rounded-full bg-indigo-500" />
                            <HoverCount
                              title={`${row.department} ${bucket} tickets`}
                              count={count}
                              tickets={bucketTickets}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center text-sm text-[var(--muted)]">
                {loading ? "Loading..." : "No tickets found"}
              </div>
            )}
          </div>
        </section>

        <section className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-5 shadow-sm">
          <div className="mb-5">
            <h2 className="text-xl font-bold text-[var(--foreground)]">Department Based Monthly Ticket Volume</h2>
            {/* <p className="mt-2 text-sm text-[var(--muted)]">Ticket volume by department over recent months.</p> */}
          </div>

          <div className="rounded-lg border border-[var(--card-border)] bg-[var(--muted-bg)] p-4">
            {monthDepartmentMatrix.rows.length ? (
              <div className="space-y-4">
                <div
                  className="hidden gap-2 text-xs font-semibold text-[var(--muted)] md:grid md:[grid-template-columns:var(--month-grid)]"
                  style={monthGridStyle}
                >
                  <div>Department</div>
                  {monthDepartmentMatrix.months.map((month) => (
                    <div key={month.key} className="text-center">
                      {month.label}
                    </div>
                  ))}
                </div>

                {monthDepartmentMatrix.rows.map((row) => (
                  <div
                    key={row.department}
                    className="grid gap-2 md:[grid-template-columns:var(--month-grid)]"
                    style={monthGridStyle}
                  >
                    <div className="flex items-center rounded-md bg-[var(--card-bg)] px-3 py-2 text-sm font-semibold text-[var(--foreground)]">
                      {row.department}
                    </div>

                    {monthDepartmentMatrix.months.map((month) => {
                      const monthTickets = row.monthTickets[month.key] || [];
                      const count = monthTickets.length;
                      const intensity = count / maxMonthDepartmentCount;

                      return (
                        <div
                          key={month.key}
                          className="rounded-md border border-[var(--card-border)] px-3 py-2"
                          style={{
                            backgroundColor: count
                              ? `rgba(8, 145, 178, ${0.12 + intensity * 0.45})`
                              : "var(--card-bg)",
                          }}
                        >
                          <div className="mb-1 flex items-center justify-between gap-2 md:hidden">
                            <span className="text-xs font-semibold text-[var(--muted)]">{month.label}</span>
                          </div>
                          <div className="flex items-center justify-between gap-2 md:justify-center">
                            <span className="h-2 w-2 rounded-full bg-cyan-600" />
                            <HoverCount
                              title={`${row.department} ${month.label} tickets`}
                              count={count}
                              tickets={monthTickets}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center text-sm text-[var(--muted)]">
                {loading ? "Loading..." : "No tickets found"}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default Zohoone;
