"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";

export interface AuthUser {
  userId: string;
  email: string;
  name?: string;
  role: "super_admin" | "org_admin" | "org_user";
  orgId?: string;
  orgSlug?: string;
  orgName?: string;
  orgColor?: string;
  activeOrgId?: string;
  activeOrgSlug?: string;
  activeOrgName?: string;
  activeOrgColor?: string;
  allowedPages?: string[];
}

export interface OrgItem {
  _id: string;
  name: string;
  slug: string;
  plan: string;
  color?: string;
  description?: string;
  industry?: string;
  email?: string;
  website?: string;
  isActive: boolean;
  allowedPages?: string[];
  memberCount?: number;
  projectCount?: number;
  createdAt?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  isSuperAdmin: boolean;
  isOrgUser: boolean;
  activeOrgSlug: string | null;
  activeOrgName: string | null;
  activeOrgColor: string | null;
  allowedPages: string[];
  canAccess: (page: string) => boolean;
  orgs: OrgItem[];
  orgsLoading: boolean;
  refreshOrgs: () => Promise<void>;
  switchOrg: (orgId: string | null) => Promise<void>;
  switching: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null, loading: true,
  logout: async () => {}, refreshUser: async () => {},
  isSuperAdmin: false, isOrgUser: false,
  activeOrgSlug: null, activeOrgName: null, activeOrgColor: null,
  allowedPages: [], canAccess: () => false,
  orgs: [], orgsLoading: false, refreshOrgs: async () => {},
  switchOrg: async () => {}, switching: false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [orgs, setOrgs] = useState<OrgItem[]>([]);
  const [orgsLoading, setOrgsLoading] = useState(false);
  const [switching, setSwitching] = useState(false);
  const router = useRouter();
  const orgsLoadedForRole = useRef<string | null>(null);

  const refreshUser = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshOrgs = useCallback(async () => {
    setOrgsLoading(true);
    try {
      const res = await fetch("/api/admin/organizations", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setOrgs(data.orgs || []);
      }
    } catch {
      // ignore
    } finally {
      setOrgsLoading(false);
    }
  }, []);

  // Load user on mount
  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  // Load orgs ONLY for super_admin, and only once per role change
  useEffect(() => {
    if (!user) {
      orgsLoadedForRole.current = null;
      setOrgs([]);
      return;
    }
    if (user.role === "super_admin" && orgsLoadedForRole.current !== "super_admin") {
      orgsLoadedForRole.current = "super_admin";
      refreshOrgs();
    } else if (user.role !== "super_admin") {
      orgsLoadedForRole.current = null;
      setOrgs([]);
    }
  }, [user?.role, refreshOrgs]);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    setUser(null);
    setOrgs([]);
    orgsLoadedForRole.current = null;
    window.location.href = "/login";
  };

  const switchOrg = async (orgId: string | null) => {
    setSwitching(true);
    try {
      await fetch("/api/admin/switch-org", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ orgId }),
      });
      // Hard reload so the new token cookie is picked up
      window.location.href = "/dashboard";
    } catch {
      setSwitching(false);
    }
  };

  const isSuperAdmin = user?.role === "super_admin";
  const isOrgUser = user?.role === "org_admin" || user?.role === "org_user";

  // Derive active org info from token payload
  const activeOrgSlug = user?.activeOrgSlug || user?.orgSlug || null;
  const activeOrgName = user?.activeOrgName || user?.orgName || null;
  const activeOrgColor =
    user?.activeOrgColor ||
    user?.orgColor ||
    orgs.find((o) => o.slug === activeOrgSlug)?.color ||
    null;

  // Allowed pages: super admin gets everything, org users get what's in their token
  const allowedPages: string[] = isSuperAdmin
    ? ["dashboard", "organizations", "members", "projects", "reports", "analytics", "billing", "notifications", "support", "settings"]
    : user?.allowedPages || [];

  // canAccess: super admin always yes; org users check their allowedPages
  const canAccess = (page: string): boolean => {
    if (isSuperAdmin) return true;
    if (!user) return false;
    return allowedPages.includes(page);
  };

  return (
    <AuthContext.Provider
      value={{
        user, loading, logout, refreshUser,
        isSuperAdmin, isOrgUser,
        activeOrgSlug, activeOrgName, activeOrgColor,
        allowedPages, canAccess,
        orgs, orgsLoading, refreshOrgs,
        switchOrg, switching,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
