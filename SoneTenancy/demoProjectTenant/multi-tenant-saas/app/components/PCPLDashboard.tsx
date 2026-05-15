"use client";

export default function PCPLDashboard() {
  return (
    <div className="p-8 flex flex-col items-center justify-center min-h-[70vh]">
      <div className="w-20 h-20 bg-sky-100 dark:bg-sky-900/30 rounded-3xl flex items-center justify-center mb-6">
        <svg className="w-10 h-10 text-sky-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      </div>
      <h2 className="text-2xl font-bold text-[var(--foreground)] mb-2">PCPL Pvt Ltd</h2>
      <p className="text-[var(--muted)] text-base mb-1">Dashboard coming soon</p>
      <p className="text-[var(--muted)] text-sm">This organization&apos;s dashboard is under construction.</p>
    </div>
  );
}
