"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../../../context/AuthContext";

const PAGE_META: Record<string, { label: string; desc: string; icon: string }> = {
  dashboard:     { label: "Dashboard",      desc: "Main overview with stats and recent activity", icon: "🏠" },
  security:      { label: "Security",      desc: "Main overview with stats and recent activity", icon: "🏠" },
  members:       { label: "Members",        desc: "View and manage organization members",          icon: "👥" },
  projects:      { label: "Projects",       desc: "Create and track projects",                     icon: "📁" },
  reports:       { label: "Reports",        desc: "View and create reports",                       icon: "📊" },
  analytics:     { label: "Analytics",      desc: "Usage analytics and event tracking",            icon: "📈" },
  billing:       { label: "Billing",        desc: "Subscription plan and invoices",                icon: "💳" },
  notifications: { label: "Notifications",  desc: "System and user notifications",                 icon: "🔔" },
  support:       { label: "Support",        desc: "Support tickets and help desk",                 icon: "🎧" },
  settings:      { label: "Settings",       desc: "Account and organization settings",             icon: "⚙️" },
  checkpoint:      { label: "Check Point",       desc: "Account and organization settings",             icon: "⚙️" },
  zohoOne:      { label: "Zoho One",       desc: "Zoho One integration and management",             icon: "⚙️" },
};

export default function OrgAccessPage() {
  const { isSuperAdmin } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [orgName, setOrgName] = useState("");
  const [allPages, setAllPages] = useState<string[]>([]);
  const [allowed, setAllowed] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!isSuperAdmin) { router.push("/dashboard"); return; }
    // Fetch org name
    fetch(`/api/admin/organizations/${id}`)
      .then((r) => r.json())
      .then((d) => setOrgName(d.org?.name || ""));
    // Fetch pages
    fetch(`/api/admin/organizations/${id}/pages`)
      .then((r) => r.json())
      .then((d) => {
        setAllPages(d.allPages || []);
        setAllowed(d.allowedPages || []);
      })
      .finally(() => setLoading(false));
  }, [id, isSuperAdmin]);

  const toggle = (page: string) => {
    if (page === "dashboard") return; // always required
    setAllowed((prev) =>
      prev.includes(page) ? prev.filter((p) => p !== page) : [...prev, page]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    await fetch(`/api/admin/organizations/${id}/pages`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ allowedPages: allowed }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
    </div>
  );

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <Link href="/dashboard/organizations" className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center gap-1 mb-4">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Back to Organizations
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Page Access Control</h1>
        <p className="text-gray-500 mt-1 text-sm">
          Control which pages <span className="font-semibold text-gray-700">{orgName}</span> members can access.
          Dashboard is always enabled.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-700">
              {allowed.length} of {allPages.length} pages enabled
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setAllowed([...allPages])}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium px-3 py-1 rounded-lg hover:bg-indigo-50 transition-colors"
              >
                Enable All
              </button>
              <button
                onClick={() => setAllowed(["dashboard"])}
                className="text-xs text-gray-500 hover:text-gray-700 font-medium px-3 py-1 rounded-lg hover:bg-gray-100 transition-colors"
              >
                Disable All
              </button>
            </div>
          </div>
        </div>

        <div className="divide-y divide-gray-100">
          {allPages.map((page) => {
            const meta = PAGE_META[page] || { label: page, desc: "", icon: "📄" };
            const isEnabled = allowed.includes(page);
            const isRequired = page === "dashboard";

            return (
              <div key={page} className={`flex items-center justify-between px-6 py-4 ${isRequired ? "bg-gray-50/50" : "hover:bg-gray-50"} transition-colors`}>
                <div className="flex items-center gap-4">
                  <span className="text-2xl">{meta.icon}</span>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {meta.label}
                      {isRequired && <span className="ml-2 text-xs text-gray-400 font-normal">(required)</span>}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">{meta.desc}</p>
                  </div>
                </div>
                <button
                  onClick={() => toggle(page)}
                  disabled={isRequired}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
                    isEnabled ? "bg-indigo-600" : "bg-gray-300"
                  } ${isRequired ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    isEnabled ? "translate-x-6" : "translate-x-1"
                  }`} />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors text-sm"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
        {saved && (
          <span className="flex items-center gap-2 text-green-600 text-sm font-medium">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Saved successfully
          </span>
        )}
      </div>
    </div>
  );
}
