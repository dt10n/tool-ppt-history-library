#!/usr/bin/env python3
"""Export the retained local PPT catalog into a Sites D1 seed migration.

This reads the canonical library without modifying it. Images remain in the
canonical folders and are uploaded separately to private object storage.
"""

import json
import sqlite3
from pathlib import Path

SOURCE_ROOT = Path("/Users/fanlili/Desktop/范丽丽./图片素材库")
PROJECT_ROOT = Path(__file__).resolve().parents[1]
DB_PATH = SOURCE_ROOT / "library.db"
MIGRATION_PATH = PROJECT_ROOT / "drizzle" / "0002_seed_catalog.sql"
MANIFEST_PATH = PROJECT_ROOT / "scripts" / "upload-manifest.jsonl"

SOURCE_LABELS = {
    "ppt_jpegs": "公募直播",
    "private_jpegs": "私募直播",
    "speech_jpegs": "对外演讲",
}


def sql_value(value):
    if value is None:
        return "NULL"
    if isinstance(value, int):
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"


def main():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    pages = conn.execute(
        """
        SELECT id,COALESCE(deck_title,'') AS title,COALESCE(episode_label,'') AS episode_label,
               page_number,source_group,relative_path,COALESCE(ocr_text,'') AS ocr_text,
               COALESCE(search_text,'') AS search_text
        FROM inbox_items
        WHERE source_group IN ('ppt_jpegs','private_jpegs','speech_jpegs')
          AND status<>'missing' AND COALESCE(search_excluded,0)=0
        ORDER BY source_group,relative_path
        """
    ).fetchall()
    taxonomy = conn.execute(
        "SELECT path,label,parent_path,depth FROM page_taxonomy ORDER BY depth,path"
    ).fetchall()
    tags = conn.execute(
        """
        SELECT t.item_id,t.tag_path
        FROM inbox_page_tags t JOIN inbox_items i ON i.id=t.item_id
        WHERE i.source_group IN ('ppt_jpegs','private_jpegs','speech_jpegs')
          AND i.status<>'missing' AND COALESCE(i.search_excluded,0)=0
          AND t.tag_path LIKE '内容主题/%'
        ORDER BY t.item_id,t.tag_path
        """
    ).fetchall()

    lines = ["-- Generated from the canonical local catalog. Do not edit by hand."]
    for row in taxonomy:
        values = ",".join(sql_value(row[key]) for key in ("path", "label", "parent_path", "depth"))
        lines.append(f"INSERT OR REPLACE INTO taxonomy(path,label,parent_path,depth) VALUES({values});")
    for row in pages:
        values = [
            row["id"], row["title"], row["episode_label"], row["page_number"],
            row["source_group"], SOURCE_LABELS[row["source_group"]], row["relative_path"],
            row["ocr_text"], row["search_text"],
        ]
        lines.append(
            "INSERT OR REPLACE INTO pages(id,title,episode_label,page_number,source_group,"
            "source_label,image_key,ocr_text,search_text) VALUES(" +
            ",".join(sql_value(value) for value in values) + ");"
        )
    for row in tags:
        lines.append(
            "INSERT OR REPLACE INTO page_tags(page_id,tag_path) VALUES(" +
            f"{sql_value(row['item_id'])},{sql_value(row['tag_path'])});"
        )
    lines.append("PRAGMA optimize;")
    MIGRATION_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")

    with MANIFEST_PATH.open("w", encoding="utf-8") as output:
        for row in pages:
            source = SOURCE_ROOT / row["relative_path"]
            output.write(json.dumps({
                "id": row["id"],
                "key": row["relative_path"],
                "path": str(source),
                "exists": source.is_file(),
                "size": source.stat().st_size if source.is_file() else 0,
            }, ensure_ascii=False) + "\n")

    missing = sum(1 for row in pages if not (SOURCE_ROOT / row["relative_path"]).is_file())
    print(json.dumps({
        "pages": len(pages), "taxonomy_nodes": len(taxonomy), "tags": len(tags),
        "missing_images": missing, "migration": str(MIGRATION_PATH),
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
