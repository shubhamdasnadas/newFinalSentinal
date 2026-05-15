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

    // Fetch org details from admin API
    fetch("/api/admin/organizations")
      .then((r) => r.json())
      .then((d) => {
        const found = (d.orgs || []).find((o: OrgDetails) => o.slug === activeOrgSlug);
        if (found) {
          setOrg(found);
          setForm(found);
        }
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
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
          <h3 className="font-semibold text-amber-800">No Organization Selected</h3>
          <p className="text-amber-700 mt-1">Select an organization to view its details.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Organization</h1>
          <p className="text-gray-500 mt-1">{activeOrgName}</p>
        </div>
        {canEdit && !editing && (
          <button
            onClick={() => setEditing(true)}
            className="bg-indigo-600 text-white px-5 py-2.5 rounded-lg hover:bg-indigo-700 transition-colors font-medium"
          >
            Edit Details
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
        </div>
      ) : !org ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-500">Organization details not found.</p>
        </div>
      ) : editing ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8">
          <form onSubmit={handleSave} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Organization Name</label>
                <input
                  value={form.name || ""}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={form.email || ""}
                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  value={form.phone || ""}
                  onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
                <input
                  value={form.website || ""}
                  onChange={(e) => setForm((p) => ({ ...p, website: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Industry</label>
                <input
                  value={form.industry || ""}
                  onChange={(e) => setForm((p) => ({ ...p, industry: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <textarea
                  value={form.address || ""}
                  onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
                  rows={2}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>
            </div>
            <div className="flex gap-4">
              <button type="submit" disabled={saving} className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                {saving ? "Saving..." : "Save Changes"}
              </button>
              <button type="button" onClick={() => setEditing(false)} className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors">
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center text-3xl">
                🏢
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">{org.name}</h2>
                <div className="flex items-center gap-3 mt-1">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 capitalize">
                    {org.plan}
                  </span>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    org.isActive ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                  }`}>
                    {org.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <InfoRow label="Database" value={`saas_org_${org.slug}`} mono />
            <InfoRow label="Created" value={new Date(org.createdAt).toLocaleDateString()} />
            <InfoRow label="Email" value={org.email || "—"} />
            <InfoRow label="Phone" value={org.phone || "—"} />
            <InfoRow label="Website" value={org.website || "—"} />
            <InfoRow label="Industry" value={org.industry || "—"} />
            <InfoRow label="Address" value={org.address || "—"} />
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`mt-1 text-gray-900 ${mono ? "font-mono text-sm bg-gray-100 px-2 py-1 rounded inline-block" : "font-medium"}`}>
        {value}
      </p>
    </div>
  );
}
