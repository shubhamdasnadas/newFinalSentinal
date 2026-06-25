export default function PageSkeleton() {
  return (
    <div className="p-6 lg:p-8 animate-pulse">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="h-7 w-40 bg-[var(--muted-bg)] rounded-lg mb-2" />
          <div className="h-4 w-28 bg-[var(--muted-bg)] rounded-lg" />
        </div>
        <div className="h-10 w-32 bg-[var(--muted-bg)] rounded-xl" />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-4">
            <div className="h-3 w-20 bg-[var(--muted-bg)] rounded mb-2" />
            <div className="h-7 w-10 bg-[var(--muted-bg)] rounded" />
          </div>
        ))}
      </div>

      {/* Search bar */}
      <div className="h-10 w-full bg-[var(--muted-bg)] rounded-xl mb-4" />

      {/* Table rows */}
      <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl overflow-hidden">
        <div className="h-11 bg-[var(--muted-bg)] border-b border-[var(--card-border)]" />
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="flex items-center gap-4 px-6 py-4 border-b border-[var(--card-border)] last:border-0"
          >
            <div className="w-9 h-9 bg-[var(--muted-bg)] rounded-xl flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 w-32 bg-[var(--muted-bg)] rounded" />
              <div className="h-3 w-24 bg-[var(--muted-bg)] rounded" />
            </div>
            <div className="h-5 w-14 bg-[var(--muted-bg)] rounded-full" />
            <div className="h-5 w-9 bg-[var(--muted-bg)] rounded-full hidden md:block" />
          </div>
        ))}
      </div>
    </div>
  );
}
