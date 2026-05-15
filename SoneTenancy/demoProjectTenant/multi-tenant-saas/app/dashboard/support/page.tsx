"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";

interface Ticket {
  _id: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  createdBy?: string;
  createdAt: string;
}

const STATUS_CONFIG: Record<string, { bg: string; text: string; dot: string }> = {
  open:        { bg: "bg-blue-100 dark:bg-blue-900/30",   text: "text-blue-700 dark:text-blue-400",   dot: "bg-blue-500" },
  in_progress: { bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-400", dot: "bg-amber-500" },
  resolved:    { bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-700 dark:text-green-400", dot: "bg-green-500" },
  closed:      { bg: "bg-[var(--muted-bg)]",              text: "text-[var(--muted)]",                 dot: "bg-gray-400" },
};

const PRIORITY_CONFIG: Record<string, { bg: string; text: string }> = {
  low:      { bg: "bg-[var(--muted-bg)]",               text: "text-[var(--muted)]" },
  medium:   { bg: "bg-blue-100 dark:bg-blue-900/30",    text: "text-blue-700 dark:text-blue-400" },
  high:     { bg: "bg-orange-100 dark:bg-orange-900/30", text: "text-orange-700 dark:text-orange-400" },
  critical: { bg: "bg-red-100 dark:bg-red-900/30",      text: "text-red-700 dark:text-red-400" },
};

export default function SupportPage() {
  const { user, activeOrgSlug, activeOrgName } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState("all");
  const [form, setForm] = useState({ subject: "", description: "", priority: "medium" });

  const fetchTickets = () => {
    if (!activeOrgSlug) { setLoading(false); return; }
    fetch("/api/support", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setTickets(d.tickets || []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchTickets(); }, [activeOrgSlug]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await fetch("/api/support", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(form),
    });
    setForm({ subject: "", description: "", priority: "medium" });
    setShowModal(false);
    fetchTickets();
    setSaving(false);
  };

  const filtered = filter === "all" ? tickets : tickets.filter((t) => t.status === filter);
  const openCount = tickets.filter((t) => t.status === "open").length;
  const criticalCount = tickets.filter((t) => t.priority === "critical").length;

  if (!activeOrgSlug) return (
    <div className="p-8">
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-6">
        <h3 className="font-semibold text-amber-800 dark:text-amber-300">No Organization Selected</h3>
      </div>
    </div>
  );

  return (
    <div className="p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Support</h1>
          <p className="text-[var(--muted)] text-sm mt-1">{activeOrgName} — {tickets.length} tickets</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Ticket
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Total Tickets", value: tickets.length, color: "text-indigo-600 dark:text-indigo-400" },
          { label: "Open", value: openCount, color: "text-blue-600 dark:text-blue-400" },
          { label: "Critical", value: criticalCount, color: "text-red-600 dark:text-red-400" },
        ].map((s) => (
          <div key={s.label} className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-4">
            <p className="text-xs text-[var(--muted)] mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-5 bg-[var(--muted-bg)] p-1 rounded-xl w-fit">
        {["all", "open", "in_progress", "resolved", "closed"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${
              filter === f
                ? "bg-[var(--card-bg)] text-[var(--foreground)] shadow-sm"
                : "text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            {f.replace("_", " ")}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-16 text-center">
          <div className="w-14 h-14 bg-[var(--muted-bg)] rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-[var(--foreground)] mb-1">No tickets found</h3>
          <p className="text-[var(--muted)] text-sm">Submit a ticket if you need help.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((t) => {
            const sc = STATUS_CONFIG[t.status] || STATUS_CONFIG.open;
            const pc = PRIORITY_CONFIG[t.priority] || PRIORITY_CONFIG.medium;
            return (
              <div key={t._id} className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-5 hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-[var(--foreground)] text-sm">{t.subject}</h4>
                    <p className="text-[var(--muted)] mt-1 text-sm line-clamp-2">{t.description}</p>
                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${sc.bg} ${sc.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                        {t.status.replace("_", " ")}
                      </span>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${pc.bg} ${pc.text}`}>
                        {t.priority}
                      </span>
                      {t.createdBy && (
                        <span className="text-xs text-[var(--muted)] flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          {t.createdBy}
                        </span>
                      )}
                      <span className="text-xs text-[var(--muted)]">
                        {new Date(t.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl shadow-2xl w-full max-w-md p-8">
            <button onClick={() => setShowModal(false)} className="absolute top-5 right-5 text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <h2 className="text-xl font-bold text-[var(--foreground)] mb-1">New Support Ticket</h2>
            <p className="text-sm text-[var(--muted)] mb-6">Describe your issue and we'll get back to you</p>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-[var(--foreground)] mb-1.5">Subject *</label>
                <input value={form.subject} onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))} required placeholder="Brief description of the issue" className="w-full px-4 py-2.5 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[var(--foreground)] mb-1.5">Description *</label>
                <textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} required rows={4} placeholder="Provide detailed information about the issue..." className="w-full px-4 py-2.5 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[var(--foreground)] mb-1.5">Priority</label>
                <select value={form.priority} onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value }))} className="w-full px-4 py-2.5 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2.5 border border-[var(--card-border)] rounded-xl text-sm font-medium text-[var(--foreground)] hover:bg-[var(--muted-bg)] transition-colors">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">{saving ? "Submitting..." : "Submit Ticket"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
