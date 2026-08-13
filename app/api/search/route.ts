import { env } from "cloudflare:workers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type SearchRow = {
  id: string;
  title: string;
  episode_label: string;
  page_number: number | null;
  source_label: string;
  ocr_text: string;
};

function snippet(text: string, terms: string[]) {
  const compact = (text || "").replace(/\s+/g, " ").trim();
  if (!compact) return "";
  const lower = compact.toLowerCase();
  const indexes = terms.map((term) => lower.indexOf(term.toLowerCase())).filter((index) => index >= 0);
  const start = Math.max(0, (indexes.length ? Math.min(...indexes) : 0) - 24);
  return `${start > 0 ? "…" : ""}${compact.slice(start, start + 92)}${compact.length > start + 92 ? "…" : ""}`;
}

export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") || "").trim();
  const tag = (request.nextUrl.searchParams.get("tag") || "").trim();
  const limit = Math.min(100, Math.max(1, Number(request.nextUrl.searchParams.get("limit")) || 60));
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 6);

  const where: string[] = [];
  const bindings: (string | number)[] = [];
  for (const term of terms) {
    where.push("LOWER(p.search_text) LIKE ?");
    bindings.push(`%${term}%`);
  }
  if (tag) {
    where.push("EXISTS (SELECT 1 FROM page_tags pt WHERE pt.page_id=p.id AND (pt.tag_path=? OR pt.tag_path LIKE ?))");
    bindings.push(tag, `${tag}/%`);
  }
  const predicate = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const rank = terms.length
    ? "CASE WHEN LOWER(p.title) LIKE ? THEN 0 WHEN LOWER(p.episode_label) LIKE ? THEN 1 ELSE 2 END,"
    : "";
  const rankBindings = terms.length ? [`%${terms[0]}%`, `%${terms[0]}%`] : [];

  const countRow = await env.DB.prepare(`SELECT COUNT(*) AS count FROM pages p ${predicate}`)
    .bind(...bindings)
    .first<{ count: number }>();
  const result = await env.DB.prepare(`
    SELECT p.id,p.title,p.episode_label,p.page_number,p.source_label,p.ocr_text
    FROM pages p ${predicate}
    ORDER BY ${rank} p.episode_label DESC, COALESCE(p.page_number,9999) ASC
    LIMIT ?
  `).bind(...bindings, ...rankBindings, limit).all<SearchRow>();

  return NextResponse.json({
    total: Number(countRow?.count || 0),
    items: result.results.map((row) => ({
      id: row.id,
      title: row.title,
      episodeLabel: row.episode_label,
      pageNumber: row.page_number,
      sourceLabel: row.source_label,
      matchedText: snippet(row.ocr_text, terms),
    })),
  });
}
