"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";

interface Report {
  _id: string;
  title: string;
  description?: string;
  type: string;
  status: string;
  createdBy?: string;
  createdAt: string;
}

const TYPE_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  sales:      { label: "Sales",      bg: "bg-green-100 dark:bg-green-900/30",   text: "text-green-700 dark:text-green-400" },
  finance:    { label: "Finance",    bg: "bg-blue-100 dark:bg-blue-900/30",     text: "text-blue-700 dark:text-blue-400" },
  hr:         { label: "HR",         bg: "bg-purple-100 dark:bg-purple-900/30", text: "text-purple-700 dark:text-purple-400" },
  operations: { label: "Operations", bg: "bg-orange-100 dark:bg-orange-900/30", text: "text-orange-700 dark:text-orange-400" },
  custom:     { label: "Custom",     bg: "bg-[var(--muted-bg)]",               text: "text-[var(--muted)]" },
};

const STATUS_CONFIG: Record<string, { bg: string; text: string; dot: string }> = {
  published: { bg: "bg-green-100 dark:bg-green-900/30",  text: "text-green-700 dark:text-green-400",  dot: "bg-green-500" },
  draft:     { bg: "bg-yellow-100 dark:bg-yellow-900/30", text: "text-yellow-700 dark:text-yellow-400", dot: "bg-yellow-500" },
  archived:  { bg: "bg-[var(--muted-bg)]",               text: "text-[var(--muted)]",                  dot: "bg-gray-400" },
};

export default function ReportsPage() {
  const { user, activeOrgSlug, activeOrgName } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [form, setForm] = useState({ title: "", description: "", type: "custom", status: "draft" });

  const canManage = user?.role === "super_admin" || user?.role === "org_admin";

  const fetchReports = () => {
    if (!activeOrgSlug) { setLoading(false); return; }
    fetch("/api/reports", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setReports(d.reports || []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchReports(); }, [activeOrgSlug]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || "Failed"); return; }
      setForm({ title: "", description: "", type: "custom", status: "draft" });
      setShowModal(false);
      fetchReports();
    } catch { setError("Network error."); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this report?")) return;
    await fetch("/api/reports", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id }),
    });
    fetchReports();
  };

  const filtered = filter === "all" ? reports : reports.filter((r) => r.status === filter);

  if (!activeOrgSlug) return (
    <div className="p-8">
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-6">
        <h3 className="font-semibold text-amber-800 dark:text-amber-300">No Organization Selected</h3>
        <p className="text-amber-700 dark:text-amber-400 mt-1 text-sm">Select an organization to view reports.</p>
      </div>
    </div>
  );

  return (
    <div className="p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Reports</h1>
          <p className="text-[var(--muted)] text-sm mt-1">{activeOrgName} — {reports.length} reports</p>
        </div>
        {canManage && (
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Report
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-5 bg-[var(--muted-bg)] p-1 rounded-xl w-fit">
        {["all", "published", "draft", "archived"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${
              filter === f
                ? "bg-[var(--card-bg)] text-[var(--foreground)] shadow-sm"
                : "text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-16 text-center">
          <div className="text-5xl mb-4">📊</div>
          <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">No reports found</h3>
          <p className="text-[var(--muted)] text-sm">
            {filter !== "all" ? `No ${filter} reports.` : `Create your first report for ${activeOrgName}.`}
          </p>
        </div>
      ) : (
        <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-[var(--muted-bg)] border-b border-[var(--card-border)]">
              <tr>
                <th className="text-left px-6 py-3.5 text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">Title</th>
                <th className="text-left px-6 py-3.5 text-xs font-semibold text-[var(--muted)] uppercase tracking-wider hidden sm:table-cell">Type</th>
                <th className="text-left px-6 py-3.5 text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">Status</th>
                <th className="text-left px-6 py-3.5 text-xs font-semibold text-[var(--muted)] uppercase tracking-wider hidden md:table-cell">Created By</th>
                <th className="text-left px-6 py-3.5 text-xs font-semibold text-[var(--muted)] uppercase tracking-wider hidden lg:table-cell">Date</th>
                {canManage && <th className="px-6 py-3.5" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--card-border)]">
              {filtered.map((r) => {
                const tc = TYPE_CONFIG[r.type] || TYPE_CONFIG.custom;
                const sc = STATUS_CONFIG[r.status] || STATUS_CONFIG.draft;
                return (
                  <tr key={r._id} className="hover:bg-[var(--muted-bg)] transition-colors">
                    <td className="px-6 py-4">
                      <p className="text-sm font-semibold text-[var(--foreground)]">{r.title}</p>
                      {r.description && (
                        <p className="text-xs text-[var(--muted)] mt-0.5 line-clamp-1">{r.description}</p>
                      )}
                    </td>
                    <td className="px-6 py-4 hidden sm:table-cell">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${tc.bg} ${tc.text}`}>
                        {tc.label}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${sc.bg} ${sc.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                        {r.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-[var(--muted)] hidden md:table-cell">{r.createdBy || "—"}</td>
                    <td className="px-6 py-4 text-sm text-[var(--muted)] hidden lg:table-cell">
                      {new Date(r.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                    </td>
                    {canManage && (
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleDelete(r._id)}
                          className="text-[var(--muted)] hover:text-red-500 transition-colors"
                          aria-label="Delete report"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl shadow-2xl w-full max-w-md p-8">
            <button onClick={() => setShowModal(false)} className="absolute top-5 right-5 text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <h2 className="text-xl font-bold text-[var(--foreground)] mb-1">New Report</h2>
            <p className="text-sm text-[var(--muted)] mb-6">Create a report for {activeOrgName}</p>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-[var(--foreground)] mb-1.5">Title *</label>
                <input
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  required
                  placeholder="Q4 Security Report"
                  className="w-full px-4 py-2.5 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[var(--foreground)] mb-1.5">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  rows={2}
                  className="w-full px-4 py-2.5 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-[var(--foreground)] mb-1.5">Type</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="custom">Custom</option>
                    <option value="sales">Sales</option>
                    <option value="finance">Finance</option>
                    <option value="hr">HR</option>
                    <option value="operations">Operations</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[var(--foreground)] mb-1.5">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                  </select>
                </div>
              </div>
              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-xl text-sm">
                  {error}
                </div>
              )}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2.5 border border-[var(--card-border)] rounded-xl text-sm font-medium text-[var(--foreground)] hover:bg-[var(--muted-bg)] transition-colors">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">{saving ? "Creating..." : "Create Report"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
