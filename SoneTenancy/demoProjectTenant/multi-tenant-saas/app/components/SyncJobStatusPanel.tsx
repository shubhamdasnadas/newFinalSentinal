"use client";

import React, { useEffect, useMemo, useState } from "react";

type SyncJobStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";

type SyncJobSource = "sentinelone" | "harmony" | "crowdstrike" | "defender" | "firewall";

type SyncJob = {
  id: string;
  org_id?: string | null;
  org_slug: string;
  source: SyncJobSource;
  status: SyncJobStatus;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  error: string | null;
  extra?: any;
};

function statusBadge(status: SyncJobStatus) {
  const cls: Record<SyncJobStatus, string> = {
    PENDING: "bg-[var(--muted-bg)] text-[var(--muted)] border border-[var(--card-border)]",
    RUNNING: "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800",
    COMPLETED: "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800",
    FAILED: "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800",
  };
  return cls[status];
}

function fmtTime(v: string | null | undefined) {
  if (!v) return "—";
  try {
    const d = new Date(v);
    return d.toLocaleString();
  } catch {
    return String(v);
  }
}

export default function SyncJobStatusPanel() {
  const sources: { key: SyncJobSource; label: string; help: string }[] = useMemo(
    () => [
      { key: "sentinelone", label: "Sync SentinelOne", help: "Queues a SentinelOne sync job (threats + agents)." },
      { key: "harmony", label: "Sync Harmony", help: "Queues a Checkpoint Harmony sync job (events)." },
      // crowdstrike/defender/firewall may be implemented later
    ],
    []
  );

  const [lastJob, setLastJob] = useState<SyncJob | null>(null);
  const [polling, setPolling] = useState(false);
  const [pollErr, setPollErr] = useState<string | null>(null);

  const [creating, setCreating] = useState<SyncJobSource | null>(null);

  async function createJob(source: SyncJobSource) {
    setCreating(source);
    setPollErr(null);

    try {
      const res = await fetch("/api/sync-jobs/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data?.error || "Failed to create sync job");

      const jobId = data?.jobId as string;
      if (!jobId) throw new Error("Server did not return jobId");

      // Immediately fetch status so UI updates quickly.
      await fetchJob(jobId);

      setPolling(true);
    } catch (e: any) {
      setPollErr(e?.message ?? String(e));
      setLastJob(null);
    } finally {
      setCreating(null);
    }
  }

  async function fetchJob(jobId: string) {
    const res = await fetch(`/api/sync-jobs/${jobId}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || "Failed to fetch job");
    setLastJob(data.job as SyncJob);
    return data.job as SyncJob;
  }

  useEffect(() => {
    if (!polling) return;
    if (!lastJob?.id) return;

    let active = true;

    const interval = setInterval(async () => {
      if (!active) return;
      try {
        const j = await fetchJob(lastJob.id);
        if (j.status === "COMPLETED" || j.status === "FAILED") {
          setPolling(false);
          clearInterval(interval);
        }
      } catch (e: any) {
        setPollErr(e?.message ?? String(e));
        setPolling(false);
        clearInterval(interval);
      }
    }, 2500);

    return () => {
      active = false;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [polling, lastJob?.id]);

  return (
    <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] shadow-sm p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-[var(--foreground)]">Background Sync (Logout-safe)</h3>
          <p className="text-xs text-[var(--muted)] mt-1">
            Creates DB-backed jobs processed by a server worker. Works even if you logout/close the browser.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {sources.map((s) => (
          <button
            key={s.key}
            disabled={creating === s.key}
            onClick={() => createJob(s.key)}
            className="px-3 py-2 rounded-xl text-xs font-medium border border-[var(--card-border)] bg-[var(--card-bg)] hover:bg-[var(--muted-bg)] disabled:opacity-50"
            title={s.help}
          >
            {creating === s.key ? "Queuing…" : s.label}
          </button>
        ))}
      </div>

      {pollErr && (
        <div className="mt-3 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3">
          {pollErr}
        </div>
      )}

      <div className="mt-4">
        <div className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wide">Last Job</div>

        {!lastJob ? (
          <div className="mt-2 text-xs text-[var(--muted)]">No job created yet.</div>
        ) : (
          <div className="mt-2 rounded-xl border border-[var(--card-border)] bg-[var(--muted-bg)] p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs text-[var(--muted)]">Source</div>
                <div className="text-sm font-semibold text-[var(--foreground)] capitalize">{lastJob.source}</div>
              </div>

              <div className="flex-shrink-0">
                <span className={`inline-flex px-2 py-1 rounded-lg text-xs font-semibold ${statusBadge(lastJob.status)}`}
                >
                  {lastJob.status}
                </span>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              <div>
                <div className="text-[var(--muted)]">Job ID</div>
                <div className="break-all font-mono text-[var(--foreground)]">{lastJob.id}</div>
              </div>
              <div>
                <div className="text-[var(--muted)]">Created</div>
                <div className="text-[var(--foreground)]">{fmtTime(lastJob.created_at)}</div>
              </div>
              <div>
                <div className="text-[var(--muted)]">Started</div>
                <div className="text-[var(--foreground)]">{fmtTime(lastJob.started_at)}</div>
              </div>
              <div>
                <div className="text-[var(--muted)]">Completed</div>
                <div className="text-[var(--foreground)]">{fmtTime(lastJob.completed_at)}</div>
              </div>
              <div className="sm:col-span-2">
                <div className="text-[var(--muted)]">Error</div>
                <div className="text-[var(--foreground)] font-mono">
                  {lastJob.error ?? "—"}
                </div>
              </div>
            </div>

            {polling && (
              <div className="mt-3 text-xs text-[var(--muted)]">Worker is processing…</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

