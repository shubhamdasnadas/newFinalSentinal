"use client";

import { useEffect, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface HarmonyEvent {
  eventId: string;
  type: string;
  state: string;
  severity: string;
  description: string;
  senderAddress?: string;
  eventCreated: string;
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

// Widget options the user can add to the dashboard
export interface CheckpointWidgetConfig {
  id: string;
  label: string;
  description: string;
  eventTypes: string[];
}

const WIDGET_OPTIONS: CheckpointWidgetConfig[] = [
  { id: "cp-phishing", label: "Phishing", description: "Phishing event summary card", eventTypes: ["phishing"] },
  { id: "cp-malware", label: "Malware", description: "Malware event summary card", eventTypes: ["malware"] },
  { id: "cp-dlp", label: "DLP", description: "Data loss prevention event card", eventTypes: ["dlp"] },
  { id: "cp-susp-phish", label: "Suspicious Phishing", description: "Suspicious phishing event card", eventTypes: ["suspicious_phishing"] },
  { id: "cp-susp-mal", label: "Suspicious Malware", description: "Suspicious malware event card", eventTypes: ["suspicious_malware"] },
  { id: "cp-all", label: "All Events", description: "Combined summary of all event types", eventTypes: ALL_EVENT_TYPES },
];

function buildSummary(events: HarmonyEvent[], types: string[]): ThreatSummary {
  const filtered = events.filter((e) => types.includes(e.type));
  const total = filtered.length;
  const pending = filtered.filter((e) => e.state === "new" || e.state === "pending").length;
  const remediated = filtered.filter((e) => ["remediated", "closed", "done"].includes(e.state)).length;
  const detected = Math.max(0, total - remediated - pending);
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);
  return { total, pending, remediated, remediatedPct: pct(remediated), detected, detectedPct: pct(detected) };
}

// ─── Mini preview card ────────────────────────────────────────────────────────
function MiniCard({ summary }: { summary: ThreatSummary }) {
  if (summary.total === 0) {
    return <p className="text-xs text-[var(--muted)] text-center py-2">No events</p>;
  }
  return (
    <div className="flex items-center justify-between gap-2 mt-2">
      <div className="text-center">
        <p className="text-lg font-bold text-blue-600 dark:text-blue-400 leading-none">{summary.total}</p>
        <p className="text-[10px] text-[var(--muted)] mt-0.5">Total</p>
      </div>
      <div className="text-center">
        <p className={`text-base font-bold leading-none ${summary.remediatedPct > 0 ? "text-green-600 dark:text-green-400" : "text-[var(--muted)]"}`}>{summary.remediatedPct}%</p>
        <p className="text-[10px] text-[var(--muted)] mt-0.5">Remediated</p>
      </div>
      <div className="text-center">
        <p className={`text-base font-bold leading-none ${summary.pending > 0 ? "text-red-500" : "text-[var(--muted)]"}`}>
          {summary.total > 0 ? Math.round((summary.pending / summary.total) * 100) : 0}%
        </p>
        <p className={`text-[10px] mt-0.5 ${summary.pending > 0 ? "text-red-500" : "text-[var(--muted)]"}`}>Pending</p>
      </div>
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  selected: string[];
  onToggle: (id: string) => void;
  onAdd: (selected: string[]) => void;   // ← new
  onCancel: () => void;
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function CheckpointWidgetPicker({ selected, onToggle, onAdd, onCancel }: Props) {
  const [events, setEvents] = useState<HarmonyEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/harmony/events-db", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d.responseData)) setEvents(d.responseData); })
      .catch(() => { })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <p className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider mb-3">
        Select Checkpoint Widgets to Add
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin w-6 h-6 border-4 border-indigo-500 border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {WIDGET_OPTIONS.map((opt) => {
            const isSelected = selected.includes(opt.id);
            const summary = buildSummary(events, opt.eventTypes);
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onToggle(opt.id)}
                className={`text-left p-3.5 rounded-xl border-2 transition-all ${isSelected
                  ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20"
                  : "border-[var(--card-border)] bg-[var(--card-bg)] hover:border-indigo-300 hover:bg-[var(--muted-bg)]"
                  }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {/* Checkbox indicator */}
                    <span className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${isSelected ? "bg-indigo-600 border-indigo-600" : "border-[var(--card-border)]"
                      }`}>
                      {isSelected && (
                        <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-[var(--foreground)]">{opt.label}</p>
                      <p className="text-[10px] text-[var(--muted)] mt-0.5">{opt.description}</p>
                    </div>
                  </div>
                  {/* Event type pills */}
                  <div className="flex flex-wrap gap-1 justify-end">
                    {opt.eventTypes.slice(0, 2).map((t) => (
                      <span key={t} className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 capitalize">
                        {t.replace(/_/g, " ")}
                      </span>
                    ))}
                    {opt.eventTypes.length > 2 && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-[var(--muted-bg)] text-[var(--muted)]">
                        +{opt.eventTypes.length - 2}
                      </span>
                    )}
                  </div>
                </div>
                {/* Mini data preview */}
                <MiniCard summary={summary} />
              </button>
            );
          })}
        </div>
      )}
      {/* ── Footer ── */}
      <div className="px-5 py-4 border-t border-[var(--card-border)] bg-[var(--muted-bg)] flex items-center justify-end gap-2">
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-lg text-xs font-semibold text-[var(--muted)] hover:bg-[var(--card-border)] transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={() => onAdd(selected)}
          disabled={selected.length === 0}
          className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 dark:disabled:bg-indigo-900 text-white transition-colors shadow-sm disabled:cursor-not-allowed"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          Add {selected.length > 0 ? `${selected.length} Widget${selected.length > 1 ? "s" : ""}` : "Widget"}
        </button>
      </div>
    </div>

  );
}

// Export config type and options for use in dashboard
export { WIDGET_OPTIONS };
export type { CheckpointWidgetConfig as CpWidgetConfig };
