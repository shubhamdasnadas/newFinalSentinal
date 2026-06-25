"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";

interface PendingOrg {
  _id: string;
  name: string;
  color?: string;
  plan: string;
}

export default function SelectOrg() {
  const { user, loading, orgs, orgsLoading, switchOrg, switching } = useAuth();
  const [pendingOrgs, setPendingOrgs] = useState<PendingOrg[] | null>(null);
  const [confirming, setConfirming] = useState(false);

  // Read pending orgs from sessionStorage (set by login page for multi-org members)
  useEffect(() => {
    const raw = sessionStorage.getItem("pendingOrgs");
    if (raw) {
      try {
        setPendingOrgs(JSON.parse(raw));
      } catch {
        // malformed — ignore
      }
      sessionStorage.removeItem("pendingOrgs");
    }
  }, []);

  // Redirect non-pending, non-super_admin users straight to dashboard
  useEffect(() => {
    if (!loading && user && user.role !== "super_admin" && !user.pendingOrgIds?.length) {
      window.location.href = "/dashboard";
    }
  }, [loading, user]);

  const confirmOrg = async (orgId: string) => {
    setConfirming(true);
    try {
      const res = await fetch("/api/auth/confirm-org", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ orgId }),
      });
      if (res.ok) {
        window.location.href = "/dashboard";
      } else {
        const data = await res.json();
        alert(data.message || "Failed to select organization.");
        setConfirming(false);
      }
    } catch {
      alert("Network error. Please try again.");
      setConfirming(false);
    }
  };

  // Still loading or about to redirect
  const isPendingMember = !loading && user && user.pendingOrgIds?.length;
  const isSuperAdmin = !loading && user?.role === "super_admin";

  if (loading || (!isSuperAdmin && !isPendingMember && !pendingOrgs)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-indigo-700 via-indigo-600 to-violet-600">
        <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  // ── Pending member path ────────────────────────────────────────────────────
  if (isPendingMember || pendingOrgs) {
    const displayOrgs = pendingOrgs ?? [];
    return (
      <OrgPickerCard
        orgs={displayOrgs}
        onSelect={(id) => confirmOrg(id)}
        selecting={confirming}
        subtitle="Your credentials match multiple organizations. Choose one to continue."
      />
    );
  }

  // ── Super admin path ───────────────────────────────────────────────────────
  const liveOrgs = orgs.filter((o) => o.isActive).map((o) => ({
    _id: o._id,
    name: o.name,
    color: o.color,
    plan: o.plan,
  }));

  return (
    <OrgPickerCard
      orgs={liveOrgs}
      onSelect={(id) => switchOrg(id)}
      selecting={switching}
      loading={orgsLoading}
      subtitle="Choose the organization you want to manage"
    />
  );
}

// ── Shared card UI ─────────────────────────────────────────────────────────

function OrgPickerCard({
  orgs,
  onSelect,
  selecting,
  loading = false,
  subtitle,
}: {
  orgs: PendingOrg[];
  onSelect: (id: string) => void;
  selecting: boolean;
  loading?: boolean;
  subtitle: string;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-indigo-700 via-indigo-600 to-violet-600 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-white/5 rounded-full" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-white/5 rounded-full" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-white/[0.03] rounded-full" />
      </div>

      <div className="relative w-full max-w-md mx-4 bg-white rounded-3xl shadow-2xl p-10">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <p className="font-bold text-gray-900 text-lg leading-tight">SecureHub</p>
            <p className="text-gray-400 text-xs">Enterprise Security Platform</p>
          </div>
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Select organization</h1>
          <p className="text-gray-500 text-sm">{subtitle}</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : orgs.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">
            No active organizations found.
          </div>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {orgs.map((org) => (
              <button
                key={org._id}
                onClick={() => onSelect(org._id)}
                disabled={selecting}
                className="w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-all text-left group disabled:opacity-60"
              >
                <span
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-base font-bold flex-shrink-0"
                  style={{ backgroundColor: org.color || "#6366f1" }}
                >
                  {org.name[0]?.toUpperCase()}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate group-hover:text-indigo-700 transition-colors">
                    {org.name}
                  </p>
                  <p className="text-xs text-gray-400 capitalize">{org.plan}</p>
                </div>
                {selecting ? (
                  <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                ) : (
                  <svg className="w-4 h-4 text-gray-300 group-hover:text-indigo-500 transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        )}

        <div className="mt-6 pt-5 border-t border-gray-100">
          <button
            onClick={() => { window.location.href = "/login"; }}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            Sign in with a different account
          </button>
        </div>
      </div>
    </div>
  );
}
