"use client";

import { useState } from "react";
import useSWR from "swr";

interface Project {
  id: string;
  name: string;
  key: string;
  description?: string;
  status: string;
  created_by?: string;
  created_at: string;
}

interface Props {
  initialProjects: Project[];
  orgSlug: string;
  orgName: string;
  canManage: boolean;
}

const STATUS_CONFIG: Record<string, { bg: string; text: string; dot: string }> = {
  active:   { bg: "bg-green-100 dark:bg-green-900/30",  text: "text-green-700 dark:text-green-400",  dot: "bg-green-500" },
  inactive: { bg: "bg-[var(--muted-bg)]",               text: "text-[var(--muted)]",                  dot: "bg-gray-400" },
  archived: { bg: "bg-red-100 dark:bg-red-900/30",      text: "text-red-600 dark:text-red-400",       dot: "bg-red-400" },
};

const fetcher = (url: string) =>
  fetch(url, { credentials: "include" }).then((r) => r.json());

export default function ProjectsClient({ initialProjects, orgSlug, orgName, canManage }: Props) {
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [form, setForm] = useState({ name: "", key: "", description: "", status: "active" });

  const { data, mutate } = useSWR("/api/projects", fetcher, {
    fallbackData: { projects: initialProjects },
    revalidateOnFocus: false,
  });
  const projects: Project[] = data?.projects ?? initialProjects;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.message || "Failed to create project"); return; }
      setForm({ name: "", key: "", description: "", status: "active" });
      setShowModal(false);
      mutate();
    } catch {
      setError("Network error.");
    } finally {
      setSaving(false);
    }
  };

  const activeCount = projects.filter((p) => p.status === "active").length;

  return (
    <div className="p-6 lg:p-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Projects</h1>
          <p className="text-[var(--muted)] text-sm mt-1">
            {orgName} — {activeCount} active of {projects.length} total
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-[var(--muted-bg)] rounded-xl p-1 border border-[var(--card-border)]">
            <button onClick={() => setView("grid")} className={`p-1.5 rounded-lg transition-colors ${view === "grid" ? "bg-[var(--card-bg)] text-[var(--foreground)] shadow-sm" : "text-[var(--muted)]"}`} aria-label="Grid view">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
            </button>
            <button onClick={() => setView("list")} className={`p-1.5 rounded-lg transition-colors ${view === "list" ? "bg-[var(--card-bg)] text-[var(--foreground)] shadow-sm" : "text-[var(--muted)]"}`} aria-label="List view">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
            </button>
          </div>
          {canManage && (
            <button onClick={() => setShowModal(true)} className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              New Project
            </button>
          )}
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-16 text-center">
          <div className="w-14 h-14 bg-[var(--muted-bg)] rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" /></svg>
          </div>
          <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">No projects yet</h3>
          <p className="text-[var(--muted)] text-sm mb-6">Create your first project for {orgName}.</p>
          {canManage && (
            <button onClick={() => setShowModal(true)} className="inline-flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors">Create Project</button>
          )}
        </div>
      ) : view === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {projects.map((p) => {
            const sc = STATUS_CONFIG[p.status] || STATUS_CONFIG.inactive;
            return (
              <div key={p.id} className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-indigo-100 dark:bg-indigo-900/40 rounded-xl flex items-center justify-center text-sm font-bold text-indigo-600 dark:text-indigo-400 flex-shrink-0">{p.key?.slice(0, 2)}</div>
                    <div>
                      <h3 className="font-semibold text-[var(--foreground)] text-sm">{p.name}</h3>
                      <p className="text-xs text-[var(--muted)] font-mono">{p.key}</p>
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium capitalize ${sc.bg} ${sc.text}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />{p.status}
                  </span>
                </div>
                {p.description && <p className="text-sm text-[var(--muted)] mb-3 line-clamp-2">{p.description}</p>}
                <div className="flex items-center justify-between text-xs text-[var(--muted)] pt-3 border-t border-[var(--card-border)]">
                  <span className="truncate max-w-[120px]">{p.created_by || "—"}</span>
                  <span>{new Date(p.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-[var(--muted-bg)] border-b border-[var(--card-border)]">
              <tr>
                <th className="text-left px-6 py-3.5 text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">Project</th>
                <th className="text-left px-6 py-3.5 text-xs font-semibold text-[var(--muted)] uppercase tracking-wider hidden sm:table-cell">Key</th>
                <th className="text-left px-6 py-3.5 text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">Status</th>
                <th className="text-left px-6 py-3.5 text-xs font-semibold text-[var(--muted)] uppercase tracking-wider hidden md:table-cell">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--card-border)]">
              {projects.map((p) => {
                const sc = STATUS_CONFIG[p.status] || STATUS_CONFIG.inactive;
                return (
                  <tr key={p.id} className="hover:bg-[var(--muted-bg)] transition-colors">
                    <td className="px-6 py-4">
                      <p className="text-sm font-semibold text-[var(--foreground)]">{p.name}</p>
                      {p.description && <p className="text-xs text-[var(--muted)] mt-0.5 line-clamp-1">{p.description}</p>}
                    </td>
                    <td className="px-6 py-4 hidden sm:table-cell"><span className="text-xs font-mono bg-[var(--muted-bg)] text-[var(--muted)] px-2 py-1 rounded-lg">{p.key}</span></td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${sc.bg} ${sc.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />{p.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-[var(--muted)] hidden md:table-cell">{new Date(p.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</td>
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
            <h2 className="text-xl font-bold text-[var(--foreground)] mb-1">New Project</h2>
            <p className="text-sm text-[var(--muted)] mb-6">Create a project in {orgName}</p>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-[var(--foreground)] mb-1.5">Project Name *</label>
                <input value={form.name} onChange={(e) => { const name = e.target.value; setForm((p) => ({ ...p, name, key: p.key || name.slice(0, 6).toUpperCase().replace(/\s+/g, "") })); }} required placeholder="My Project"
                  className="w-full px-4 py-2.5 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[var(--foreground)] mb-1.5">Key</label>
                <input value={form.key} onChange={(e) => setForm((p) => ({ ...p, key: e.target.value.toUpperCase() }))} placeholder="MYPROJ"
                  className="w-full px-4 py-2.5 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-sm font-mono text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[var(--foreground)] mb-1.5">Description</label>
                <textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} rows={3}
                  className="w-full px-4 py-2.5 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[var(--foreground)] mb-1.5">Status</label>
                <select value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
              {error && <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-xl text-sm">{error}</div>}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2.5 border border-[var(--card-border)] rounded-xl text-sm font-medium text-[var(--foreground)] hover:bg-[var(--muted-bg)] transition-colors">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">{saving ? "Creating..." : "Create Project"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
