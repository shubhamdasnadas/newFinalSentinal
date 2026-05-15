"use client";

import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useEffect, useRef, useState } from "react";
import CreateOrgModal from "./CreateOrgModal";

interface TopBarProps {
  onMenuClick?: () => void;
}

export default function TopBar({ onMenuClick }: TopBarProps) {
  const {
    user,
    isSuperAdmin,
    isOrgUser,
    activeOrgSlug,
    activeOrgName,
    activeOrgColor,
    orgs,
    orgsLoading,
    refreshOrgs,
    switchOrg,
    switching,
  } = useAuth();

  const { theme, toggleTheme } = useTheme();

  const [open, setOpen] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const activeOrg = orgs.find((o) => o.slug === activeOrgSlug) || null;
  const liveOrgs = orgs.filter((o) => o.isActive);

  return (
    <>
      <div className="h-14 bg-[var(--topbar-bg)] border-b border-[var(--topbar-border)] flex items-center justify-between px-4 sm:px-6 flex-shrink-0 z-30 transition-colors duration-200">

        {/* ── Left: hamburger (mobile) + org switcher ── */}
        <div className="flex items-center gap-3">
          {/* Hamburger — mobile only */}
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 rounded-lg hover:bg-[var(--muted-bg)] text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
            aria-label="Open menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Super admin: org switcher dropdown */}
          {isSuperAdmin && (
            <div className="relative" ref={ref}>
              <button
                onClick={() => setOpen((v) => !v)}
                disabled={switching}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg border border-[var(--card-border)] hover:bg-[var(--muted-bg)] text-sm font-medium text-[var(--foreground)] min-w-[200px] transition-colors"
              >
                {activeOrg ? (
                  <span
                    className="w-6 h-6 rounded-md flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                    style={{ backgroundColor: activeOrg.color || "#6366f1" }}
                  >
                    {activeOrg.name[0]?.toUpperCase()}
                  </span>
                ) : (
                  <span className="w-6 h-6 rounded-md bg-[var(--muted-bg)] flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16" />
                    </svg>
                  </span>
                )}
                <span className="flex-1 truncate text-left">
                  {switching ? "Switching..." : activeOrgName || "Select Organization"}
                </span>
                <svg
                  className={`w-4 h-4 text-[var(--muted)] flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {open && (
                <div className="absolute top-full left-0 mt-1.5 w-72 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl shadow-xl z-50 overflow-hidden">
                  <div className="px-4 pt-3 pb-2">
                    <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">
                      Organizations
                    </p>
                  </div>

                  <div className="max-h-64 overflow-y-auto">
                    {orgsLoading ? (
                      <div className="flex items-center justify-center py-6">
                        <div className="animate-spin w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full" />
                      </div>
                    ) : liveOrgs.length === 0 ? (
                      <p className="text-sm text-[var(--muted)] text-center py-6">No organizations yet</p>
                    ) : (
                      liveOrgs.map((org) => {
                        const isSelected = activeOrgSlug === org.slug;
                        return (
                          <button
                            key={org._id}
                            onClick={() => { setOpen(false); switchOrg(org._id); }}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--muted-bg)] transition-colors text-left ${
                              isSelected ? "bg-indigo-50 dark:bg-indigo-900/30" : ""
                            }`}
                          >
                            <span
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                              style={{ backgroundColor: org.color || "#6366f1" }}
                            >
                              {org.name[0]?.toUpperCase()}
                            </span>
                            <span className="flex-1 min-w-0">
                              <span className={`block text-sm font-medium truncate ${isSelected ? "text-indigo-600 dark:text-indigo-400" : "text-[var(--foreground)]"}`}>
                                {org.name}
                              </span>
                              <span className="block text-xs text-[var(--muted)] capitalize">{org.plan}</span>
                            </span>
                            {isSelected && (
                              <svg className="w-4 h-4 text-indigo-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>

                  <div className="border-t border-[var(--card-border)] p-2">
                    <button
                      onClick={() => { setOpen(false); setShowCreate(true); }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[var(--muted-bg)] transition-colors text-left"
                    >
                      <span className="w-7 h-7 rounded-lg border-2 border-dashed border-[var(--input-border)] flex items-center justify-center flex-shrink-0">
                        <svg className="w-3.5 h-3.5 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      </span>
                      <span className="text-sm font-medium text-[var(--muted)]">Create organization</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Org user: static badge */}
          {isOrgUser && activeOrgName && (
            <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg border border-[var(--card-border)] text-sm font-medium text-[var(--foreground)]">
              <span
                className="w-6 h-6 rounded-md flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                style={{ backgroundColor: activeOrgColor || "#6366f1" }}
              >
                {activeOrgName[0]?.toUpperCase()}
              </span>
              <span>{activeOrgName}</span>
            </div>
          )}
        </div>

        {/* ── Right: theme toggle + user badge ── */}
        <div className="flex items-center gap-3">

          {/* Dark / Light mode toggle */}
          <button
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            className="w-9 h-9 flex items-center justify-center rounded-lg border border-[var(--card-border)] hover:bg-[var(--muted-bg)] transition-colors text-[var(--muted)] hover:text-[var(--foreground)]"
          >
            {theme === "dark" ? (
              /* Sun icon */
              <svg className="w-4.5 h-4.5 w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z"
                />
              </svg>
            ) : (
              /* Moon icon */
              <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                />
              </svg>
            )}
          </button>

          {/* User / role badge */}
          <div className="flex items-center gap-2 bg-[var(--muted-bg)] border border-[var(--card-border)] rounded-lg px-3 py-1.5">
            <svg className="w-3.5 h-3.5 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
            <span className="text-sm font-medium text-[var(--foreground)] capitalize">
              {user?.role?.replace(/_/g, " ")}
            </span>
          </div>
        </div>
      </div>

      {showCreate && (
        <CreateOrgModal
          onClose={() => setShowCreate(false)}
          onCreated={async () => {
            setShowCreate(false);
            await refreshOrgs();
          }}
        />
      )}
    </>
  );
}
