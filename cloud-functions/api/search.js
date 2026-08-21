import { json, supabaseRpc } from "../_shared.js";

function snippet(text, terms) {
  const compact = String(text || "").replace(/\s+/g, " ").trim();
  if (!compact) return "";
  const lower = compact.toLowerCase();
  const indexes = terms.map((term) => lower.indexOf(term)).filter((index) => index >= 0);
  const start = Math.max(0, (indexes.length ? Math.min(...indexes) : 0) - 24);
  return `${start > 0 ? "…" : ""}${compact.slice(start, start + 92)}${compact.length > start + 92 ? "…" : ""}`;
}

export async function onRequestGet(context) {
  try {
    const url = new URL(context.request.url);
    const query = (url.searchParams.get("q") || "").trim();
    const tag = (url.searchParams.get("tag") || "").trim();
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 60));
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 6);
    const rows = await supabaseRpc(context.env, "search_library_pages", {
      query_terms: terms,
      selected_tag: tag,
      result_limit: limit,
    });
    const total = Number(rows[0]?.total_count || 0);
    return json({
      total,
      items: rows.map((row) => ({
        id: row.id,
        title: row.title,
        episodeLabel: row.episode_label,
        pageNumber: row.page_number,
        sourceLabel: row.source_label,
        matchedText: snippet(row.ocr_text, terms),
      })),
    });
  } catch (error) {
    console.error("search failed", error);
    return json({ error: "搜索服务暂时不可用" }, 500);
  }
}
