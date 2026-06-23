import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "../../lib/auth";
import { getOrgPool } from "../../lib/db";

const NEWS_API_KEY = process.env.NEWS_API_KEY || "981528e4e3a34c8c87b32c95fa0e3edb";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

function getOrgSlug(user: any): string | null {
  return user.activeOrgSlug || user.orgSlug || null;
}

async function ensureTable(orgSlug: string) {
  const pool = getOrgPool(orgSlug);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS news_articles (
      id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      source_id    TEXT,
      source_name  TEXT,
      author       TEXT,
      title        TEXT        NOT NULL,
      description  TEXT,
      url          TEXT        NOT NULL UNIQUE,
      url_to_image TEXT,
      published_at TIMESTAMPTZ,
      content      TEXT,
      query_term   TEXT        NOT NULL DEFAULT 'cybersecurity',
      fetched_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_news_query_term ON news_articles(query_term)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_news_published_at ON news_articles(published_at DESC)`);
}

async function isStale(orgSlug: string, queryTerm: string): Promise<boolean> {
  const pool = getOrgPool(orgSlug);
  const result = await pool.query(
    `SELECT MAX(fetched_at) AS last_fetched FROM news_articles WHERE query_term = $1`,
    [queryTerm]
  );
  const lastFetched = result.rows[0]?.last_fetched;
  if (!lastFetched) return true;
  return Date.now() - new Date(lastFetched).getTime() > CACHE_TTL_MS;
}

async function fetchAndStore(orgSlug: string, queryTerm: string): Promise<number> {
  const today = new Date();
  const fromDate = new Date(today);
  fromDate.setDate(fromDate.getDate() - 7);

  const url = new URL("https://newsapi.org/v2/everything");
  url.searchParams.set("q", queryTerm);
  url.searchParams.set("from", fromDate.toISOString().split("T")[0]);
  url.searchParams.set("to", today.toISOString().split("T")[0]);
  url.searchParams.set("language", "en");
  url.searchParams.set("sortBy", "relevancy");
  url.searchParams.set("pageSize", "20");
  url.searchParams.set("apiKey", NEWS_API_KEY);

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`NewsAPI error ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  const articles: any[] = data.articles ?? [];

  const pool = getOrgPool(orgSlug);
  const now = new Date().toISOString();

  await pool.query(`DELETE FROM news_articles WHERE query_term = $1`, [queryTerm]);

  for (const a of articles) {
    if (!a.url || !a.title) continue;
    await pool.query(
      `INSERT INTO news_articles
         (source_id, source_name, author, title, description, url, url_to_image, published_at, content, query_term, fetched_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (url) DO UPDATE SET
         source_id    = EXCLUDED.source_id,
         source_name  = EXCLUDED.source_name,
         author       = EXCLUDED.author,
         title        = EXCLUDED.title,
         description  = EXCLUDED.description,
         url_to_image = EXCLUDED.url_to_image,
         published_at = EXCLUDED.published_at,
         content      = EXCLUDED.content,
         query_term   = EXCLUDED.query_term,
         fetched_at   = EXCLUDED.fetched_at`,
      [
        a.source?.id ?? null,
        a.source?.name ?? null,
        a.author ?? null,
        a.title,
        a.description ?? null,
        a.url,
        a.urlToImage ?? null,
        a.publishedAt ? new Date(a.publishedAt).toISOString() : null,
        a.content ?? null,
        queryTerm,
        now,
      ]
    );
  }

  return articles.length;
}

async function getArticlesFromDB(orgSlug: string, queryTerm: string) {
  const pool = getOrgPool(orgSlug);
  const result = await pool.query(
    `SELECT source_id, source_name, author, title, description, url, url_to_image, published_at, content
     FROM news_articles
     WHERE query_term = $1
     ORDER BY published_at DESC NULLS LAST
     LIMIT 20`,
    [queryTerm]
  );
  return result.rows.map((r) => ({
    source: { id: r.source_id, name: r.source_name },
    author: r.author,
    title: r.title,
    description: r.description,
    url: r.url,
    urlToImage: r.url_to_image,
    publishedAt: r.published_at,
    content: r.content,
  }));
}

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const user = verifyToken(token);
    const orgSlug = getOrgSlug(user);
    if (!orgSlug) return NextResponse.json({ message: "No active organization" }, { status: 400 });

    const { searchParams } = new URL(req.url);
    const queryTerm = searchParams.get("q") || "cybersecurity";

    await ensureTable(orgSlug);

    if (await isStale(orgSlug, queryTerm)) {
      await fetchAndStore(orgSlug, queryTerm);
    }

    const articles = await getArticlesFromDB(orgSlug, queryTerm);
    return NextResponse.json({ status: "ok", totalResults: articles.length, articles });
  } catch (e: any) {
    return NextResponse.json({ message: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const user = verifyToken(token);
    const orgSlug = getOrgSlug(user);
    if (!orgSlug) return NextResponse.json({ message: "No active organization" }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const queryTerm = body.q || "cybersecurity";

    await ensureTable(orgSlug);
    const count = await fetchAndStore(orgSlug, queryTerm);
    const articles = await getArticlesFromDB(orgSlug, queryTerm);
    return NextResponse.json({ status: "ok", synced: count, totalResults: articles.length, articles });
  } catch (e: any) {
    return NextResponse.json({ message: e.message }, { status: 500 });
  }
}
