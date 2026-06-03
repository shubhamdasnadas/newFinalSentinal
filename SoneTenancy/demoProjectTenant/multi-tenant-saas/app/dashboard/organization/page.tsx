"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";

interface OrgDetails {
  _id: string;
  name: string;
  slug: string;
  email?: string;
  phone?: string;
  address?: string;
  website?: string;
  industry?: string;
  plan: string;
  isActive: boolean;
  createdAt: string;
}

const PLAN_COLORS: Record<string, { bg: string; text: string }> = {
  free:       { bg: "bg-gray-100 dark:bg-gray-800",         text: "text-gray-700 dark:text-gray-300" },
  starter:    { bg: "bg-sky-100 dark:bg-sky-900/30",        text: "text-sky-700 dark:text-sky-400" },
  pro:        { bg: "bg-indigo-100 dark:bg-indigo-900/40",  text: "text-indigo-700 dark:text-indigo-300" },
  enterprise: { bg: "bg-violet-100 dark:bg-violet-900/40",  text: "text-violet-700 dark:text-violet-300" },
};

function InfoCard({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="bg-[var(--muted-bg)] rounded-xl px-5 py-4">
      <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-1.5">{label}</p>
      <p className={`text-sm font-medium text-[var(--foreground)] break-all ${mono ? "font-mono" : ""}`}>{value || "—"}</p>
    </div>
  );
}

export default function OrganizationPage() {
  const { user, isSuperAdmin, activeOrgSlug, activeOrgName } = useAuth();
  const [org, setOrg] = useState<OrgDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<OrgDetails>>({});

  const canEdit = isSuperAdmin || user?.role === "org_admin";

  useEffect(() => {
    if (!activeOrgSlug) { setLoading(false); return; }
    fetch("/api/admin/organizations")
      .then((r) => r.json())
      .then((d) => {
        const found = (d.orgs || []).find((o: OrgDetails) => o.slug === activeOrgSlug);
        if (found) { setOrg(found); setForm(found); }
      })
      .finally(() => setLoading(false));
  }, [activeOrgSlug]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!org) return;
    setSaving(true);
    const res = await fetch(`/api/admin/organizations/${org._id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (data.org) setOrg(data.org);
    setEditing(false);
    setSaving(false);
  };

  if (!activeOrgSlug) {
    return (
      <div className="p-8">
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-6">
          <h3 className="font-semibold text-amber-800 dark:text-amber-300">No Organization Selected</h3>
          <p className="text-amber-700 dark:text-amber-400 mt-1 text-sm">Select an organization to view its details.</p>
        </div>
      </div>
    );
  }

  const planCfg = PLAN_COLORS[org?.plan ?? "free"] ?? PLAN_COLORS.free;

  return (
    <div className="p-6 lg:p-8 max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-xl bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center">
              <svg className="w-4 h-4 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-[var(--foreground)]">Organization</h1>
          </div>
          <p className="text-[var(--muted)] text-sm">{activeOrgName}</p>
        </div>
        {canEdit && !editing && org && (
          <button
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit Details
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
        </div>
      ) : !org ? (
        <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-16 text-center">
          <div className="w-14 h-14 bg-[var(--muted-bg)] rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" />
            </svg>
          </div>
          <p className="text-[var(--muted)] text-sm">Organization details not found.</p>
        </div>
      ) : editing ? (
        <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-[var(--card-border)] bg-[var(--muted-bg)]">
            <h3 className="font-semibold text-[var(--foreground)]">Edit Organization Details</h3>
          </div>
          <form onSubmit={handleSave} className="p-6 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-[var(--foreground)] mb-1.5">Organization Name</label>
                <input value={form.name || ""} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[var(--foreground)] mb-1.5">Email</label>
                <input type="email" value={form.email || ""} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[var(--foreground)] mb-1.5">Phone</label>
                <input value={form.phone || ""} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[var(--foreground)] mb-1.5">Website</label>
                <input value={form.website || ""} onChange={(e) => setForm((p) => ({ ...p, website: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[var(--foreground)] mb-1.5">Industry</label>
                <input value={form.industry || ""} onChange={(e) => setForm((p) => ({ ...p, industry: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-[var(--foreground)] mb-1.5">Address</label>
                <textarea value={form.address || ""} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} rows={2}
                  className="w-full px-4 py-2.5 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setEditing(false)} className="flex-1 px-4 py-2.5 border border-[var(--card-border)] rounded-xl text-sm font-medium text-[var(--foreground)] hover:bg-[var(--muted-bg)] transition-colors">Cancel</button>
              <button type="submit" disabled={saving} className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">{saving ? "Saving..." : "Save Changes"}</button>
            </div>
          </form>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Identity card */}
          <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl overflow-hidden shadow-sm">
            <div className="px-6 py-5 border-b border-[var(--card-border)]">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-gradient-to-br from-orange-400 to-orange-600 rounded-2xl flex items-center justify-center text-white text-2xl font-bold shadow-sm flex-shrink-0">
                  {org.name?.[0]?.toUpperCase() ?? "O"}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-[var(--foreground)]">{org.name}</h2>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${planCfg.bg} ${planCfg.text}`}>
                      {org.plan}
                    </span>
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      org.isActive
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${org.isActive ? "bg-green-500" : "bg-red-500"}`} />
                      {org.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-3">
              <InfoCard label="Database" value={`saas_org_${org.slug}`} mono />
              <InfoCard label="Created" value={new Date(org.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} />
              <InfoCard label="Email" value={org.email || "—"} />
              <InfoCard label="Phone" value={org.phone || "—"} />
              <InfoCard label="Website" value={org.website || "—"} />
              <InfoCard label="Industry" value={org.industry || "—"} />
              {org.address && <InfoCard label="Address" value={org.address} />}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
