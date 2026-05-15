"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";

interface Member {
  _id: string;
  name: string;
  email: string;
  role: string;
  department?: string;
  isActive: boolean;
  createdAt: string;
}

interface AddMemberForm {
  name: string;
  email: string;
  password: string;
  role: string;
  department: string;
}

export default function MembersPage() {
  const { user, activeOrgSlug, activeOrgName } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<AddMemberForm>({
    name: "", email: "", password: "", role: "org_user", department: "",
  });

  const canManage = user?.role === "super_admin" || user?.role === "org_admin";

  const fetchMembers = () => {
    if (!activeOrgSlug) { setLoading(false); return; }
    fetch(`/api/admin/org-users?orgSlug=${activeOrgSlug}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setMembers(d.users || []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchMembers(); }, [activeOrgSlug]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/admin/org-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...form, orgSlug: activeOrgSlug }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || "Failed to add member"); return; }
      setForm({ name: "", email: "", password: "", role: "org_user", department: "" });
      setShowModal(false);
      fetchMembers();
    } catch {
      setError("Network error.");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (m: Member) => {
    await fetch(`/api/admin/org-users/${m._id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ ...m, isActive: !m.isActive, orgSlug: activeOrgSlug }),
    });
    setMembers((prev) => prev.map((x) => (x._id === m._id ? { ...x, isActive: !x.isActive } : x)));
  };

  const filtered = members.filter(
    (m) =>
      m.name?.toLowerCase().includes(search.toLowerCase()) ||
      m.email?.toLowerCase().includes(search.toLowerCase()) ||
      m.department?.toLowerCase().includes(search.toLowerCase())
  );

  const activeCount = members.filter((m) => m.isActive).length;
  const adminCount = members.filter((m) => m.role === "org_admin").length;

  if (!activeOrgSlug) {
    return (
      <div className="p-8">
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-6">
          <h3 className="font-semibold text-amber-800 dark:text-amber-300">No Organization Selected</h3>
          <p className="text-amber-700 dark:text-amber-400 mt-1 text-sm">Select an organization to manage members.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Members</h1>
          <p className="text-[var(--muted)] text-sm mt-1">{activeOrgName}</p>
        </div>
        {canManage && (
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Member
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Total Members", value: members.length, color: "text-indigo-600 dark:text-indigo-400" },
          { label: "Active", value: activeCount, color: "text-green-600 dark:text-green-400" },
          { label: "Admins", value: adminCount, color: "text-violet-600 dark:text-violet-400" },
        ].map((s) => (
          <div key={s.label} className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-4">
            <p className="text-xs text-[var(--muted)] mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search members by name, email or department..."
          className="w-full pl-10 pr-4 py-2.5 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-16 text-center">
          <div className="w-14 h-14 bg-[var(--muted-bg)] rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-[var(--foreground)] mb-1">
            {search ? "No members found" : "No members yet"}
          </h3>
          <p className="text-[var(--muted)] text-sm">
            {search ? "Try a different search term." : "Add the first member to get started."}
          </p>
        </div>
      ) : (
        <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-[var(--muted-bg)] border-b border-[var(--card-border)]">
              <tr>
                <th className="text-left px-6 py-3.5 text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">Member</th>
                <th className="text-left px-6 py-3.5 text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">Role</th>
                <th className="text-left px-6 py-3.5 text-xs font-semibold text-[var(--muted)] uppercase tracking-wider hidden md:table-cell">Department</th>
                <th className="text-left px-6 py-3.5 text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">Status</th>
                <th className="text-left px-6 py-3.5 text-xs font-semibold text-[var(--muted)] uppercase tracking-wider hidden lg:table-cell">Joined</th>
                {canManage && <th className="px-6 py-3.5" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--card-border)]">
              {filtered.map((m) => (
                <tr key={m._id} className="hover:bg-[var(--muted-bg)] transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-indigo-100 dark:bg-indigo-900/40 rounded-xl flex items-center justify-center text-sm font-bold text-indigo-700 dark:text-indigo-300 flex-shrink-0">
                        {m.name?.[0]?.toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[var(--foreground)]">{m.name}</p>
                        <p className="text-xs text-[var(--muted)]">{m.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      m.role === "org_admin"
                        ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300"
                        : "bg-[var(--muted-bg)] text-[var(--muted)]"
                    }`}>
                      {m.role === "org_admin" ? "Admin" : "Member"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-[var(--muted)] hidden md:table-cell">
                    {m.department || "—"}
                  </td>
                  <td className="px-6 py-4">
                    {canManage ? (
                      <button
                        onClick={() => toggleActive(m)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                          m.isActive ? "bg-green-500" : "bg-[var(--muted-bg)]"
                        }`}
                        aria-label={m.isActive ? "Deactivate member" : "Activate member"}
                      >
                        <span
                          className="inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform"
                          style={{ transform: m.isActive ? "translateX(18px)" : "translateX(2px)" }}
                        />
                      </button>
                    ) : (
                      <span className={`text-xs font-medium ${m.isActive ? "text-green-600" : "text-[var(--muted)]"}`}>
                        {m.isActive ? "Active" : "Inactive"}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-[var(--muted)] hidden lg:table-cell">
                    {new Date(m.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                  </td>
                  {canManage && (
                    <td className="px-6 py-4 text-right">
                      <button className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                        </svg>
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Member Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl shadow-2xl w-full max-w-md p-8">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-5 right-5 text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <h2 className="text-xl font-bold text-[var(--foreground)] mb-1">Add Member</h2>
            <p className="text-sm text-[var(--muted)] mb-6">Add a new member to {activeOrgName}</p>

            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-[var(--foreground)] mb-1.5">Full Name *</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  required
                  placeholder="John Doe"
                  className="w-full px-4 py-2.5 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[var(--foreground)] mb-1.5">Email *</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                  required
                  placeholder="john@company.com"
                  className="w-full px-4 py-2.5 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[var(--foreground)] mb-1.5">Password *</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                  required
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-[var(--foreground)] mb-1.5">Role</label>
                  <select
                    value={form.role}
                    onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="org_user">Member</option>
                    <option value="org_admin">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[var(--foreground)] mb-1.5">Department</label>
                  <input
                    value={form.department}
                    onChange={(e) => setForm((p) => ({ ...p, department: e.target.value }))}
                    placeholder="Engineering"
                    className="w-full px-4 py-2.5 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-xl text-sm">
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2.5 border border-[var(--card-border)] rounded-xl text-sm font-medium text-[var(--foreground)] hover:bg-[var(--muted-bg)] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? "Adding..." : "Add Member"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
