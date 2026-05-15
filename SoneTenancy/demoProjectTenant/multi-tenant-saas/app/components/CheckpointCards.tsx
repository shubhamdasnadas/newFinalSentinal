"use client";

import { useEffect, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface HarmonyEvent {
  eventId: string;
  type: string;
  state: string;
  severity: string;
  confidenceIndicator: string;
  description: string;
  senderAddress?: string;
  eventCreated: string;
  actions: string[];
}

interface ThreatSummary {
  total: number;
  pending: number;
  remediated: number;
  remediatedPct: number;
  detected: number;
  detectedPct: number;
}

const ALL_EVENT_TYPES = [
  "phishing",
  "malware",
  "suspicious_malware",
  "suspicious_phishing",
  "dlp",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function buildSummary(events: HarmonyEvent[], types: string[]): ThreatSummary {
  const filtered = events.filter((e) => types.includes(e.type));
  const total = filtered.length;
  const pending = filtered.filter((e) => e.state === "new" || e.state === "pending").length;
  const remediated = filtered.filter(
    (e) => e.state === "remediated" || e.state === "closed" || e.state === "done"
  ).length;
  const detected = Math.max(0, total - remediated - pending);
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);
  return { total, pending, remediated, remediatedPct: pct(remediated), detected, detectedPct: pct(detected) };
}

// ─── ThreatCard ───────────────────────────────────────────────────────────────
interface ThreatCardProps {
  label: string;
  summary: ThreatSummary;
  activeTypes: string[];
  onTypeChange: (types: string[]) => void;
}

function ThreatCard({ label, summary, activeTypes, onTypeChange }: ThreatCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const toggleType = (t: string) => {
    if (activeTypes.includes(t)) {
      if (activeTypes.length === 1) return;
      onTypeChange(activeTypes.filter((x) => x !== t));
    } else {
      onTypeChange([...activeTypes, t]);
    }
  };

  return (
    <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--card-border)]">
        <span className="font-semibold text-[var(--foreground)] text-sm capitalize">{label}</span>
        <div className="relative">
          <button
            onClick={() => setMenuOpen((p) => !p)}
            className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors p-1 rounded-lg hover:bg-[var(--muted-bg)]"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <circle cx="5" cy="12" r="1.5" />
              <circle cx="12" cy="12" r="1.5" />
              <circle cx="19" cy="12" r="1.5" />
            </svg>
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-8 z-40 w-52 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl shadow-xl py-1.5">
                <p className="px-3 py-1 text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">Event Types</p>
                {ALL_EVENT_TYPES.map((t) => (
                  <button
                    key={t}
                    onClick={() => toggleType(t)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--muted-bg)] transition-colors capitalize"
                  >
                    <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${activeTypes.includes(t) ? "bg-indigo-600 border-indigo-600" : "border-[var(--card-border)]"}`}>
                      {activeTypes.includes(t) && (
                        <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </span>
                    {t.replace(/_/g, " ")}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="px-5 py-5">
        {summary.total === 0 ? (
          <p className="text-sm text-[var(--muted)] text-center py-4">No events</p>
        ) : (
          <>
            <div className="mb-4">
              <p className="text-4xl font-bold text-blue-600 dark:text-blue-400 leading-none">{summary.total}</p>
              <p className="text-xs text-[var(--muted)] mt-1.5 font-medium">Total</p>
            </div>
            <div className="flex items-end justify-between">
              {/* Remediated */}
              <div>
                <p className={`text-3xl font-bold leading-none ${summary.remediatedPct === 100 ? "text-green-600 dark:text-green-400" : summary.remediatedPct > 0 ? "text-blue-600 dark:text-blue-400" : "text-[var(--muted)]"}`}>
                  {summary.remediatedPct}%
                </p>
                <p className={`text-xs mt-1.5 font-medium ${summary.remediatedPct === 100 ? "text-green-600 dark:text-green-400" : "text-[var(--muted)]"}`}>Remediated</p>
              </div>
              {/* Detected */}
              <div>
                <p className={`text-3xl font-bold leading-none ${summary.detectedPct > 0 ? "text-orange-500" : "text-[var(--muted)]"}`}>
                  {summary.detectedPct}%
                </p>
                <p className="text-xs text-[var(--muted)] mt-1.5 font-medium">Detected</p>
              </div>
              {/* Pending */}
              <div>
                <p className={`text-3xl font-bold leading-none ${summary.pending > 0 ? "text-red-500" : "text-[var(--muted)]"}`}>
                  {summary.pending > 0 ? `${Math.round((summary.pending / summary.total) * 100)}%` : "0%"}
                </p>
                <p className={`text-xs mt-1.5 font-medium ${summary.pending > 0 ? "text-red-500" : "text-[var(--muted)]"}`}>
                  Pending{summary.pending > 0 && <span className="ml-1 text-red-400">({summary.pending})</span>}
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Exported component ───────────────────────────────────────────────────────
export default function CheckpointCards() {
  const [events, setEvents] = useState<HarmonyEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const [phishingTypes, setPhishingTypes] = useState<string[]>(["phishing"]);
  const [malwareTypes, setMalwareTypes] = useState<string[]>(["malware"]);
  const [dlpTypes, setDlpTypes] = useState<string[]>(["dlp"]);

  useEffect(() => {
    fetch("/api/harmony/events-db", { credentials: "include" })
      .then(async (res) => {
        const data = await res.json();
        if (res.ok && Array.isArray(data.responseData)) setEvents(data.responseData);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl h-40 animate-pulse" />
        ))}
      </div>
    );
  }

  const phishingSummary = buildSummary(events, phishingTypes);
  const malwareSummary  = buildSummary(events, malwareTypes);
  const dlpSummary      = buildSummary(events, dlpTypes);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <ThreatCard
        label={phishingTypes.length === 1 ? phishingTypes[0].replace(/_/g, " ") : "Phishing"}
        summary={phishingSummary}
        activeTypes={phishingTypes}
        onTypeChange={setPhishingTypes}
      />
      <ThreatCard
        label={malwareTypes.length === 1 ? malwareTypes[0].replace(/_/g, " ") : "Malware"}
        summary={malwareSummary}
        activeTypes={malwareTypes}
        onTypeChange={setMalwareTypes}
      />
      <ThreatCard
        label={dlpTypes.length === 1 ? dlpTypes[0].replace(/_/g, " ") : "DLP"}
        summary={dlpSummary}
        activeTypes={dlpTypes}
        onTypeChange={setDlpTypes}
      />
    </div>
  );
}
