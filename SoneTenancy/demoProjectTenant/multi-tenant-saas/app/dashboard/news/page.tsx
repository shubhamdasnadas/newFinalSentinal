'use client'

import { useEffect, useState } from 'react'

interface Article {
  source: { id: string | null; name: string }
  author: string | null
  title: string
  description: string | null
  url: string
  urlToImage: string | null
  publishedAt: string
  content: string | null
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const h = Math.floor(diff / 3_600_000)
  if (h < 1) return `${Math.floor(diff / 60000)}m ago`
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function SkeletonCard() {
  return (
    <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl overflow-hidden animate-pulse">
      <div className="h-40 bg-[var(--muted-bg)]" />
      <div className="p-4 space-y-2">
        <div className="h-3 bg-[var(--muted-bg)] rounded w-1/3" />
        <div className="h-4 bg-[var(--muted-bg)] rounded w-full" />
        <div className="h-4 bg-[var(--muted-bg)] rounded w-4/5" />
        <div className="h-3 bg-[var(--muted-bg)] rounded w-2/3 mt-2" />
      </div>
    </div>
  )
}

export default function NewsPage() {
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState('')
  const [total, setTotal] = useState(0)

  const loadNews = (forceRefresh = false) => {
    if (forceRefresh) {
      setSyncing(true)
      setError('')
      fetch('/api/news', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ q: 'cybersecurity' }) })
        .then(async (r) => {
          if (!r.ok) {
            const d = await r.json().catch(() => ({}))
            throw new Error(d.message || `Server error ${r.status}`)
          }
          return r.json()
        })
        .then((d) => {
          setArticles(d.articles ?? [])
          setTotal(d.totalResults ?? 0)
        })
        .catch((e) => setError(e.message || 'Failed to refresh news'))
        .finally(() => setSyncing(false))
    } else {
      setLoading(true)
      setError('')
      fetch('/api/news?q=cybersecurity')
        .then(async (r) => {
          if (!r.ok) {
            const d = await r.json().catch(() => ({}))
            throw new Error(d.message || `Server error ${r.status}`)
          }
          return r.json()
        })
        .then((d) => {
          setArticles(d.articles ?? [])
          setTotal(d.totalResults ?? 0)
        })
        .catch((e) => setError(e.message || 'Failed to load news'))
        .finally(() => setLoading(false))
    }
  }

  useEffect(() => { loadNews() }, [])

  return (
    <div className="p-5 lg:p-7 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <p className="text-xs font-semibold text-indigo-500 uppercase tracking-widest mb-0.5">
            Live Feed
          </p>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Cybersecurity News</h1>
          {!loading && !error && (
            <p className="text-xs text-[var(--muted)] mt-0.5">
              {total.toLocaleString()} articles &mdash; refreshed from database
            </p>
          )}
        </div>

        <button
          onClick={() => loadNews(true)}
          disabled={syncing || loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white transition-colors"
        >
          {syncing ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              Syncing…
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </>
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-600 dark:text-red-400">
          <span className="font-semibold">Error:</span> {error}
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {loading
          ? Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
          : articles.map((article, i) => (
              <a
                key={i}
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl overflow-hidden shadow-sm hover:shadow-md hover:border-indigo-400 transition-all flex flex-col"
              >
                {/* Thumbnail */}
                <div className="h-40 bg-[var(--muted-bg)] overflow-hidden flex-shrink-0">
                  {article.urlToImage ? (
                    <img
                      src={article.urlToImage}
                      alt=""
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none'
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <svg
                        className="w-10 h-10 text-[var(--muted)]"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9.5a2 2 0 00-.586-1.414l-4.5-4.5A2 2 0 0014.5 3H12"
                        />
                      </svg>
                    </div>
                  )}
                </div>

                {/* Body */}
                <div className="p-4 flex flex-col flex-1">
                  {/* Source + time */}
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-semibold text-indigo-500 uppercase tracking-wide truncate max-w-[120px]">
                      {article.source?.name || 'Unknown'}
                    </span>
                    <span className="text-[10px] text-[var(--muted)] flex-shrink-0 ml-2">
                      {article.publishedAt ? timeAgo(article.publishedAt) : ''}
                    </span>
                  </div>

                  {/* Title */}
                  <h2 className="text-sm font-bold text-[var(--foreground)] leading-snug line-clamp-3 mb-2 group-hover:text-indigo-500 transition-colors">
                    {article.title}
                  </h2>

                  {/* Description */}
                  {article.description && (
                    <p className="text-xs text-[var(--muted)] line-clamp-2 flex-1">
                      {article.description}
                    </p>
                  )}

                  {/* Author */}
                  {article.author && (
                    <p className="text-[10px] text-[var(--muted)] mt-3 truncate">
                      By {article.author}
                    </p>
                  )}
                </div>
              </a>
            ))}
      </div>

      {!loading && !error && articles.length === 0 && (
        <div className="flex items-center justify-center h-48">
          <p className="text-sm text-[var(--muted)]">No articles found. Click Refresh to fetch the latest news.</p>
        </div>
      )}
    </div>
  )
}
