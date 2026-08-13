import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const pages = sqliteTable(
  "pages",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull().default(""),
    episodeLabel: text("episode_label").notNull().default(""),
    pageNumber: integer("page_number"),
    sourceGroup: text("source_group").notNull(),
    sourceLabel: text("source_label").notNull(),
    imageKey: text("image_key").notNull(),
    ocrText: text("ocr_text").notNull().default(""),
    searchText: text("search_text").notNull().default(""),
  },
  (table) => [index("idx_pages_episode_page").on(table.episodeLabel, table.pageNumber)],
);

export const taxonomy = sqliteTable(
  "taxonomy",
  {
    path: text("path").primaryKey(),
    label: text("label").notNull(),
    parentPath: text("parent_path").notNull().default(""),
    depth: integer("depth").notNull(),
  },
  (table) => [index("idx_taxonomy_parent").on(table.parentPath)],
);

export const pageTags = sqliteTable(
  "page_tags",
  {
    pageId: text("page_id").notNull(),
    tagPath: text("tag_path").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.pageId, table.tagPath] }),
    index("idx_page_tags_path_page").on(table.tagPath, table.pageId),
  ],
);
