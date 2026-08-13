import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type NodeRow = { path: string; label: string; parent_path: string; depth: number; count: number };
type TreeNode = NodeRow & { children: TreeNode[] };

export async function GET() {
  const rows = await env.DB.prepare(`
    SELECT t.path,t.label,t.parent_path,t.depth,
      COUNT(DISTINCT pt.page_id) AS count
    FROM taxonomy t
    LEFT JOIN page_tags pt ON pt.tag_path=t.path OR pt.tag_path LIKE t.path || '/%'
    GROUP BY t.path,t.label,t.parent_path,t.depth
    ORDER BY t.depth,t.path
  `).all<NodeRow>();

  const lookup = new Map<string, TreeNode>();
  rows.results.forEach((row) => lookup.set(row.path, { ...row, count: Number(row.count), children: [] }));
  const roots: TreeNode[] = [];
  lookup.forEach((node) => {
    const parent = lookup.get(node.parent_path);
    if (parent) parent.children.push(node);
    else roots.push(node);
  });
  return NextResponse.json({ tree: roots });
}
