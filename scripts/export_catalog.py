#!/usr/bin/env python3
"""Read the canonical library and export Supabase-ready CSV files."""
import csv, json, sqlite3
from pathlib import Path

SOURCE_ROOT = Path("/Users/fanlili/Desktop/范丽丽./图片素材库")
PROJECT_ROOT = Path(__file__).resolve().parents[1]
EXPORT_ROOT = PROJECT_ROOT / "exports"
LABELS = {"ppt_jpegs": "公募直播", "private_jpegs": "私募直播", "speech_jpegs": "对外演讲"}

def write_csv(name, fields, rows):
    with (EXPORT_ROOT / name).open("w", encoding="utf-8-sig", newline="") as output:
        writer = csv.DictWriter(output, fieldnames=fields)
        writer.writeheader(); writer.writerows(rows)

def main():
    EXPORT_ROOT.mkdir(exist_ok=True)
    conn = sqlite3.connect(f"file:{SOURCE_ROOT / 'library.db'}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    pages = conn.execute("""SELECT id,COALESCE(deck_title,'') title,COALESCE(episode_label,'') episode_label,
      page_number,source_group,relative_path image_key,COALESCE(ocr_text,'') ocr_text,
      COALESCE(search_text,'') search_text FROM inbox_items
      WHERE source_group IN ('ppt_jpegs','private_jpegs','speech_jpegs')
      AND status<>'missing' AND COALESCE(search_excluded,0)=0 ORDER BY source_group,relative_path""").fetchall()
    taxonomy = conn.execute("SELECT path,label,parent_path,depth FROM page_taxonomy ORDER BY depth,path").fetchall()
    tags = conn.execute("""SELECT t.item_id page_id,t.tag_path FROM inbox_page_tags t
      JOIN inbox_items i ON i.id=t.item_id WHERE i.source_group IN ('ppt_jpegs','private_jpegs','speech_jpegs')
      AND i.status<>'missing' AND COALESCE(i.search_excluded,0)=0
      AND t.tag_path LIKE '内容主题/%' ORDER BY t.item_id,t.tag_path""").fetchall()
    page_rows, manifest = [], []
    for row in pages:
        item = dict(row); item["source_label"] = LABELS[item["source_group"]]; page_rows.append(item)
        source = SOURCE_ROOT / item["image_key"]
        manifest.append({"id": item["id"], "key": item["image_key"], "path": str(source),
                         "exists": source.is_file(), "size": source.stat().st_size if source.is_file() else 0})
    write_csv("pages.csv", ["id","title","episode_label","page_number","source_group","image_key","ocr_text","search_text","source_label"], page_rows)
    write_csv("taxonomy.csv", ["path","label","parent_path","depth"], map(dict, taxonomy))
    write_csv("page_tags.csv", ["page_id","tag_path"], map(dict, tags))
    with (EXPORT_ROOT / "upload-manifest.jsonl").open("w", encoding="utf-8") as output:
        for item in manifest: output.write(json.dumps(item, ensure_ascii=False) + "\n")
    print(json.dumps({"pages":len(page_rows),"taxonomy_nodes":len(taxonomy),"tags":len(tags),
      "missing_images":sum(not x["exists"] for x in manifest),"export_dir":str(EXPORT_ROOT)}, ensure_ascii=False))

if __name__ == "__main__": main()
