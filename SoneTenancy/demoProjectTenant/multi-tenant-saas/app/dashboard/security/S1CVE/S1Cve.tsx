"use client";

import React, { useEffect, useMemo, useState } from "react";

type S1ApplicationCve = {
    name?: string;
    vendor?: string;
    cveCount?: number;
    estimate?: boolean;
    daysDetected?: number;
    applicationId?: string;
    detectionDate?: string;
    endpointCount?: number;
    highestSeverity?: string | null;
    highestNvdBaseScore?: string | null;
};

const formatDateTime = (value?: string | null) => {
    if (!value) return "-";

    return new Date(value).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
};

const getSeverityClass = (severity?: string | null) => {
    switch ((severity || "").toUpperCase()) {
        case "CRITICAL":
            return "bg-purple-100 text-purple-700 border-purple-300";
        case "HIGH":
            return "bg-red-100 text-red-700 border-red-300";
        case "MEDIUM":
            return "bg-yellow-100 text-yellow-700 border-yellow-300";
        case "LOW":
            return "bg-blue-100 text-blue-700 border-blue-300";
        default:
            return "bg-gray-100 text-gray-700 border-gray-300";
    }
};

const S1Cve = () => {
    const [rawCves, setRawCves] = useState<S1ApplicationCve[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

    useEffect(() => {
        setLoading(true);
        setError("");

        fetch("/api/sentinelone/db/application-cve", {
            credentials: "include",
        })
            .then(async (r) => {
                const j = await r.json();

                if (!r.ok) {
                    throw new Error(j.message || "Failed to fetch CVE data");
                }

                setRawCves(Array.isArray(j.data) ? j.data : []);
                setLastSyncedAt(j.lastSyncedAt || null);
            })
            .catch((e) => setError(e.message || "Network error"))
            .finally(() => setLoading(false));
    }, []);

    const stats = useMemo(() => {
        const totalApplications = rawCves.length;

        const totalCves = rawCves.reduce(
            (sum, item) => sum + Number(item.cveCount || 0),
            0
        );

        const totalEndpoints = rawCves.reduce(
            (sum, item) => sum + Number(item.endpointCount || 0),
            0
        );

        const high = rawCves.filter(
            (item) => item.highestSeverity?.toUpperCase() === "HIGH"
        ).length;

        const medium = rawCves.filter(
            (item) => item.highestSeverity?.toUpperCase() === "MEDIUM"
        ).length;

        const low = rawCves.filter(
            (item) => item.highestSeverity?.toUpperCase() === "LOW"
        ).length;

        const avgScore =
            rawCves.length > 0
                ? (
                    rawCves.reduce(
                        (sum, item) => sum + Number(item.highestNvdBaseScore || 0),
                        0
                    ) / rawCves.length
                ).toFixed(2)
                : "0";

        return {
            totalApplications,
            totalCves,
            totalEndpoints,
            high,
            medium,
            low,
            avgScore,
        };
    }, [rawCves]);

    return (
        <div className="w-full min-h-screen p-6 bg-slate-950 text-slate-100">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-white">
                    SentinelOne Application CVE Dashboard
                </h1>

                <p className="text-sm text-slate-400">
                    Application vulnerability records from SentinelOne
                </p>

                {lastSyncedAt && (
                    <p className="mt-1 text-xs text-slate-500">
                        Last synced: {formatDateTime(lastSyncedAt)}
                    </p>
                )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-4 mb-6">
                <div className="rounded-xl border border-slate-700 p-4 bg-slate-900">
                    <p className="text-xs text-slate-400">Applications</p>
                    <h2 className="text-2xl font-bold text-white">
                        {stats.totalApplications}
                    </h2>
                </div>

                <div className="rounded-xl border border-slate-700 p-4 bg-slate-900">
                    <p className="text-xs text-slate-400">Total CVEs</p>
                    <h2 className="text-2xl font-bold text-white">{stats.totalCves}</h2>
                </div>

                <div className="rounded-xl border border-red-800 p-4 bg-red-950/40">
                    <p className="text-xs text-red-300">High Apps</p>
                    <h2 className="text-2xl font-bold text-red-400">{stats.high}</h2>
                </div>

                <div className="rounded-xl border border-yellow-800 p-4 bg-yellow-950/40">
                    <p className="text-xs text-yellow-300">Medium Apps</p>
                    <h2 className="text-2xl font-bold text-yellow-400">
                        {stats.medium}
                    </h2>
                </div>

                <div className="rounded-xl border border-blue-800 p-4 bg-blue-950/40">
                    <p className="text-xs text-blue-300">Low Apps</p>
                    <h2 className="text-2xl font-bold text-blue-400">{stats.low}</h2>
                </div>

                <div className="rounded-xl border border-slate-700 p-4 bg-slate-900">
                    <p className="text-xs text-slate-400">Affected Endpoints</p>
                    <h2 className="text-2xl font-bold text-white">
                        {stats.totalEndpoints}
                    </h2>
                </div>

                <div className="rounded-xl border border-slate-700 p-4 bg-slate-900">
                    <p className="text-xs text-slate-400">Avg Score</p>
                    <h2 className="text-2xl font-bold text-white">{stats.avgScore}</h2>
                </div>
            </div>

            {loading && (
                <div className="rounded-xl border border-slate-700 bg-slate-900 p-6 text-center text-sm text-slate-300">
                    Loading CVE data...
                </div>
            )}

            {!loading && error && (
                <div className="rounded-xl border border-red-700 bg-red-950/40 p-4 text-red-300">
                    {error}
                </div>
            )}

            {!loading && !error && rawCves.length === 0 && (
                <div className="rounded-xl border border-slate-700 bg-slate-900 p-6 text-center text-sm text-slate-400">
                    No CVE records found.
                </div>
            )}

            {!loading && !error && rawCves.length > 0 && (
                <div className="rounded-xl border border-slate-700 bg-slate-900 shadow-sm overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-700">
                        <h2 className="text-lg font-semibold text-white">
                            Application CVE Records
                        </h2>
                    </div>

                    <div className="overflow-auto max-h-[650px]">
                        <table className="min-w-[1200px] w-full text-sm">
                            <thead className="sticky top-0 z-10 bg-slate-800">
                                <tr className="text-slate-200">
                                    <th className="px-4 py-3 text-left">Application</th>
                                    <th className="px-4 py-3 text-left">Vendor</th>
                                    <th className="px-4 py-3 text-left">CVEs</th>
                                    <th className="px-4 py-3 text-left">Highest Severity</th>
                                    <th className="px-4 py-3 text-left">Base Score</th>
                                    <th className="px-4 py-3 text-left">Endpoints</th>
                                    <th className="px-4 py-3 text-left">Days Detected</th>
                                    <th className="px-4 py-3 text-left">Detection Date</th>
                                    <th className="px-4 py-3 text-left">Estimate</th>
                                    <th className="px-4 py-3 text-left">Application ID</th>
                                </tr>
                            </thead>

                            <tbody>
                                {rawCves.map((item, index) => (
                                    <tr
                                        key={item.applicationId || index}
                                        className="border-t border-slate-800 hover:bg-slate-800/70"
                                    >
                                        <td className="px-4 py-3 font-semibold text-blue-300 max-w-[320px]">
                                            {item.name || "-"}
                                        </td>

                                        <td className="px-4 py-3 text-slate-300">
                                            {item.vendor || "-"}
                                        </td>

                                        <td className="px-4 py-3 font-bold text-white">
                                            {item.cveCount ?? 0}
                                        </td>

                                        <td className="px-4 py-3">
                                            <span
                                                className={`px-2 py-1 rounded-full text-xs font-bold border ${getSeverityClass(
                                                    item.highestSeverity
                                                )}`}
                                            >
                                                {item.highestSeverity || "-"}
                                            </span>
                                        </td>

                                        <td className="px-4 py-3 font-semibold text-slate-100">
                                            {item.highestNvdBaseScore || "-"}
                                        </td>

                                        <td className="px-4 py-3 text-slate-300">
                                            {item.endpointCount ?? 0}
                                        </td>

                                        <td className="px-4 py-3 text-slate-300">
                                            {item.daysDetected ?? "-"}
                                        </td>

                                        <td className="px-4 py-3 text-slate-300 whitespace-nowrap">
                                            {formatDateTime(item.detectionDate)}
                                        </td>

                                        <td className="px-4 py-3">
                                            <span
                                                className={`px-2 py-1 rounded-full text-xs font-semibold ${item.estimate
                                                        ? "bg-orange-100 text-orange-700"
                                                        : "bg-green-100 text-green-700"
                                                    }`}
                                            >
                                                {item.estimate ? "Yes" : "No"}
                                            </span>
                                        </td>

                                        <td className="px-4 py-3 text-slate-400">
                                            {item.applicationId || "-"}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default S1Cve;