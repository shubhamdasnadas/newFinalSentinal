"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import CreateOrgModal from "../../components/CreateOrgModal";

interface Org {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  color?: string;
  industry?: string;
  plan: string;
  isActive: boolean;
  allowedPages?: string[];
  memberCount: number;
  projectCount: number;
  createdAt: string;
}

const PLAN_CONFIG: Record<string, { bg: string; text: string }> = {
  free:       { bg: "bg-[var(--muted-bg)]",               text: "text-[var(--muted)]" },
  starter:    { bg: "bg-sky-100 dark:bg-sky-900/30",      text: "text-sky-700 dark:text-sky-400" },
  pro:        { bg: "bg-violet-100 dark:bg-violet-900/30", text: "text-violet-700 dark:text-violet-400" },
  enterprise: { bg: "bg-amber-100 dark:bg-amber-900/30",  text: "text-amber-700 dark:text-amber-400" },
};

export default function OrganizationsPage() {
  const { isSuperAdmin, loading, refreshUser, refreshOrgs } = useAuth();
  const router = useRouter();
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [fetching, setFetching] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !isSuperAdmin) router.push("/dashboard");
  }, [loading, isSuperAdmin, router]);

  const fetchOrgs = () => {
    setFetching(true);
    fetch("/api/admin/organizations", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setOrgs(d.orgs || []))
      .finally(() => setFetching(false));
  };

  useEffect(() => { fetchOrgs(); }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Deactivate this organization? This will prevent all members from logging in.")) return;
    setDeletingId(id);
    await fetch(`/api/admin/organizations/${id}`, { method: "DELETE", credentials: "include" });
    setDeletingId(null);
    fetchOrgs();
    refreshOrgs();
  };

  const handleSwitch = async (orgId: string) => {
    await fetch("/api/admin/switch-org", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ orgId }),
    });
    window.location.href = "/dashboard";
  };

  const handleOrgCreated = () => {
    setShowCreate(false);
    fetchOrgs();
    refreshOrgs();
  };

  if (fetching) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
    </div>
  );

  return (
    <div className="p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Organizations</h1>
          <p className="text-[var(--muted)] mt-1 text-sm">
            {orgs.length} organization{orgs.length !== 1 ? "s" : ""} — each with an isolated PostgreSQL database
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Organization
        </button>
      </div>

      {orgs.length === 0 ? (
        <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-16 text-center">
          <div className="w-16 h-16 bg-[var(--muted-bg)] rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">No organizations yet</h3>
          <p className="text-[var(--muted)] text-sm mb-6">Create your first organization to get started.</p>
          <button
            onClick={() => setShowCreate(true)}
            className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            Create Organization
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {orgs.map((org) => {
            const pc = PLAN_CONFIG[org.plan] || PLAN_CONFIG.free;
            return (
              <div
                key={org._id}
                className={`bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-6 flex flex-col gap-4 hover:shadow-md transition-shadow ${!org.isActive ? "opacity-60" : ""}`}
              >
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
                      style={{ backgroundColor: org.color || "#6366f1" }}
                    >
                      {org.name[0]?.toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-semibold text-[var(--foreground)] leading-tight">{org.name}</h3>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-xs text-[var(--muted)]">{org.industry || "—"}</span>
                        <span className="text-[var(--muted)]">·</span>
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium capitalize ${pc.bg} ${pc.text}`}>
                          {org.plan}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(org._id)}
                    disabled={deletingId === org._id}
                    className="text-[var(--muted)] hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    aria-label="Deactivate organization"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>

                {/* Description */}
                <p className="text-sm text-[var(--muted)] line-clamp-2 min-h-[40px]">
                  {org.description || "No description provided."}
                </p>

                {/* Stats */}
                <div className="flex items-center gap-4 text-xs text-[var(--muted)]">
                  <span className="flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {org.memberCount} members
                  </span>
                  <span className="flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" />
                    </svg>
                    {org.projectCount} projects
                  </span>
                  <span className="flex items-center gap-1 ml-auto">
                    <span className={`w-2 h-2 rounded-full ${org.isActive ? "bg-green-500" : "bg-gray-400"}`} />
                    {org.isActive ? "Active" : "Inactive"}
                  </span>
                </div>

                {/* DB slug */}
                <div className="flex items-center gap-1.5 text-xs text-[var(--muted)] font-mono bg-[var(--muted-bg)] px-3 py-2 rounded-xl">
                  <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582 4-8 4" />
                  </svg>
                  <span className="truncate">saas_org_{org.slug}</span>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSwitch(org._id)}
                    className="flex-1 py-2 border border-[var(--card-border)] rounded-xl text-sm font-medium text-[var(--foreground)] hover:bg-[var(--muted-bg)] transition-colors"
                  >
                    Switch to org
                  </button>
                  <Link
                    href={`/dashboard/organizations/${org._id}/access`}
                    className="flex items-center gap-1.5 px-3 py-2 border border-indigo-200 dark:border-indigo-800 rounded-xl text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    Access
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCreate && (
        <CreateOrgModal onClose={() => setShowCreate(false)} onCreated={handleOrgCreated} />
      )}
    </div>
  );
}
