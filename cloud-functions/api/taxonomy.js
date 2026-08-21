import { json, supabaseRpc } from "../_shared.js";

export async function onRequestGet(context) {
  try {
    const rows = await supabaseRpc(context.env, "library_taxonomy_counts", {});
    const lookup = new Map();
    rows.forEach((row) => lookup.set(row.path, { ...row, count: Number(row.count), children: [] }));
    const roots = [];
    lookup.forEach((node) => {
      const parent = lookup.get(node.parent_path);
      if (parent) parent.children.push(node);
      else roots.push(node);
    });
    return json({ tree: roots });
  } catch (error) {
    console.error("taxonomy failed", error);
    return json({ error: "分类目录暂时无法读取" }, 500);
  }
}
