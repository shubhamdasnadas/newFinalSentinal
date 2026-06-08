"use client";

import React, { useEffect, useMemo, useState } from "react";

const listStatus = [
  "Open",
  "On Hold",
  "Escalated",
  "Technically Closed",
  "Closed",
  "Duplicate",
  "On Hold by Customer",
  "Acknowledge",
  "WIP",
  "Re-Open",
  "Revert Awaited - Customer",
  "Revert Awaited - OEM",
  "Revert Awaited - Vendor",
];

const statusColors: Record<string, string> = {
  Open: "#6b8df7",
  "On Hold": "#ff9f43",
  Escalated: "#ef6c57",
  "Technically Closed": "#2fb344",
  Closed: "#2fb344",
  Duplicate: "#2fb344",
  "On Hold by Customer": "#ff9f43",
  Acknowledge: "#111827",
  WIP: "#111827",
  "Re-Open": "#111827",
  "Revert Awaited - Customer": "#ff9f43",
  "Revert Awaited - OEM": "#ff9f43",
  "Revert Awaited - Vendor": "#ff9f43",
};

type ZohoTicket = {
  id?: string | number;
  ticketNumber?: string | number;
  subject?: string;
  status?: string;
  createdTime?: string;
  department?: {
    name?: string;
  };
  departmentName?: string;
  assignee?: {
    firstName?: string;
    lastName?: string;
  };
};

type DepartmentStatusRow = {
  departmentName: string;
  statuses: Record<string, ZohoTicket[]>;
};

type TicketApiResponse = {
  responseData?: ZohoTicket[];
  tickets?: {
    data?: ZohoTicket[];
  };
  data?: ZohoTicket[];
  error?: string;
};

const normalizeText = (value: unknown) => String(value || "").trim();

const normalizeTicketList = (data: TicketApiResponse) => {
  const ticketList =
    data?.responseData || data?.tickets?.data || data?.data || [];

  return Array.isArray(ticketList) ? ticketList : [];
};

const mergeTickets = (...ticketGroups: ZohoTicket[][]) => {
  const seen = new Set<string>();
  const merged: ZohoTicket[] = [];

  ticketGroups.flat().forEach((ticket) => {
    const ticketKey = normalizeText(ticket?.id || ticket?.ticketNumber);

    if (ticketKey && seen.has(ticketKey)) return;
    if (ticketKey) seen.add(ticketKey);

    merged.push(ticket);
  });

  return merged;
};

const formatDateTime = (date?: string) => {
  if (!date) return "-";

  return new Date(date).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
};

const ZohoDashboard = () => {
  const [tickets, setTickets] = useState<ZohoTicket[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchTickets = async () => {
    try {
      setLoading(true);

      const zohoCode =
        "1000.4885c079a13bf19702825bb19e6a8d76.f9da2890313f0757593726703070f315";

      const [zohoResponse, ticketsDbResponse] = await Promise.all([
        fetch(`/api/zoho?code=${encodeURIComponent(zohoCode)}`),
        fetch("/api/zoho/tickets-db", { cache: "no-store" }),
      ]);

      const [zohoData, ticketsDbData] = await Promise.all([
        zohoResponse.json(),
        ticketsDbResponse.json(),
      ]);

      if (!zohoResponse.ok && !ticketsDbResponse.ok) {
        throw new Error(
          zohoData?.error || ticketsDbData?.error || "Failed to fetch tickets"
        );
      }

      const liveTickets = zohoResponse.ok ? normalizeTicketList(zohoData) : [];
      const dbTickets = ticketsDbResponse.ok
        ? normalizeTicketList(ticketsDbData)
        : [];

      setTickets(mergeTickets(liveTickets, dbTickets));
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

  const departmentWiseData = useMemo(() => {
    const map: Record<string, DepartmentStatusRow> = {};

    tickets.forEach((ticket) => {
      const departmentName =
        normalizeText(ticket?.department?.name) ||
        normalizeText(ticket?.departmentName) ||
        "Unknown Department";

      const ticketStatus = normalizeText(ticket?.status);

      const matchedStatus = listStatus.find(
        (status) => status.toLowerCase() === ticketStatus.toLowerCase()
      );

      if (!matchedStatus) return;

      if (!map[departmentName]) {
        map[departmentName] = {
          departmentName,
          statuses: {},
        };

        listStatus.forEach((status) => {
          map[departmentName].statuses[status] = [];
        });
      }

      map[departmentName].statuses[matchedStatus].push(ticket);
    });

    return Object.values(map);
  }, [tickets]);

  return (
    <div className="w-full p-3">
      <h2 className="text-lg font-bold mb-3">Zoho Ticket Dashboard</h2>

      {loading ? (
        <p>Loading tickets...</p>
      ) : (
        <div className="overflow-auto border border-gray-300 rounded-md">
          <table className="w-max min-w-full border-collapse text-xs table-fixed">
            <thead>
              <tr className="bg-gray-100">
                <th className="sticky left-0 z-20 bg-gray-100 text-left px-2 py-2 border-b border-gray-300 w-[180px] min-w-[180px]">
                  Department Name
                </th>

                {listStatus.map((status) => (
                  <th
                    key={status}
                    className="px-2 py-2 border-b border-gray-300 text-left w-[115px] min-w-[115px] max-w-[115px] font-semibold whitespace-nowrap overflow-hidden text-ellipsis"
                    title={status}
                  >
                    {status}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {departmentWiseData.map((row) => (
                <tr key={row.departmentName} className="border-b border-gray-300">
                  <td className="sticky left-0 z-10 bg-white px-2 py-2 font-semibold text-blue-600 w-[180px] min-w-[180px] whitespace-nowrap overflow-hidden text-ellipsis">
                    {row.departmentName}
                  </td>

                  {listStatus.map((status) => {
                    const statusTickets = row.statuses?.[status] || [];
                    const count = statusTickets.length;

                    return (
                      <td
                        key={status}
                        className="relative px-0 py-0 w-[115px] min-w-[115px] max-w-[115px] border-l border-gray-200"
                      >
                        {count > 0 ? (
                          <div className="group relative">
                            <div
                              className="px-2 py-2 font-bold cursor-pointer h-[36px] flex items-center"
                              style={{
                                backgroundColor:
                                  statusColors[status] || "#e5e7eb",
                                color:
                                  status === "Acknowledge" ||
                                  status === "WIP" ||
                                  status === "Re-Open"
                                    ? "#ffffff"
                                    : "#111827",
                              }}
                            >
                              {count}
                            </div>

                            <div className="hidden group-hover:block absolute z-50 top-full left-0 w-[760px] max-h-[360px] overflow-auto bg-white border border-gray-300 rounded-md shadow-xl p-3">
                              <p className="font-bold mb-2 text-black">
                                {row.departmentName} - {status} Tickets
                              </p>

                              <table className="w-full text-xs border-collapse text-black">
                                <thead>
                                  <tr className="bg-gray-100">
                                    <th className="border px-2 py-1 text-left">
                                      Ticket No
                                    </th>
                                    <th className="border px-2 py-1 text-left">
                                      Subject
                                    </th>
                                    <th className="border px-2 py-1 text-left">
                                      Created Time
                                    </th>
                                    <th className="border px-2 py-1 text-left">
                                      Assignee
                                    </th>
                                    <th className="border px-2 py-1 text-left">
                                      Status
                                    </th>
                                  </tr>
                                </thead>

                                <tbody>
                                  {statusTickets.map((ticket) => {
                                    const assigneeName = ticket?.assignee
                                      ? `${ticket.assignee.firstName || ""} ${
                                          ticket.assignee.lastName || ""
                                        }`.trim()
                                      : "-";

                                    return (
                                      <tr key={ticket.id || ticket.ticketNumber}>
                                        <td className="border px-2 py-1">
                                          {ticket.ticketNumber || "-"}
                                        </td>

                                        <td className="border px-2 py-1">
                                          {ticket.subject || "-"}
                                        </td>

                                        <td className="border px-2 py-1">
                                          {formatDateTime(ticket.createdTime)}
                                        </td>

                                        <td className="border px-2 py-1">
                                          {assigneeName || "-"}
                                        </td>

                                        <td className="border px-2 py-1">
                                          {ticket.status || "-"}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        ) : (
                          <div className="px-2 py-2 h-[36px] flex items-center text-gray-400">
                            -
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}

              {!departmentWiseData.length && (
                <tr>
                  <td
                    colSpan={listStatus.length + 1}
                    className="px-4 py-6 text-center text-gray-500"
                  >
                    No tickets found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ZohoDashboard;