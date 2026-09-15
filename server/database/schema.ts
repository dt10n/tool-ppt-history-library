/* eslint-disable */
/** auto generated, do not edit */
import { sql } from 'drizzle-orm';
import { foreignKey, index, integer, pgTable, text, uuid, varchar, customType } from "drizzle-orm/pg-core"

export const customTimestamptz = customType<{
  data: Date;
  driverData: string;
  config: { precision?: number };
}>({
  dataType(config) {
    const precision = typeof config?.precision !== 'undefined'
      ? ` (${config.precision})`
      : '';
    return `timestamptz${precision}`;
  },
  toDriver(value: Date | string | number) {
    if (value == null) return value as any;
    if (typeof value === 'number') return new Date(value).toISOString();
    if (typeof value === 'string') return value;
    if (value instanceof Date) return value.toISOString();
    throw new Error('Invalid timestamp value');
  },
  fromDriver(value: string | Date): Date {
    if (value instanceof Date) return value;
    return new Date(value);
  },
});

export const userProfile = customType<{
  data: string;
  driverData: string;
}>({
  dataType() {
    return 'user_profile';
  },
  toDriver(value: string) {
    return sql`ROW(${value})::user_profile`;
  },
  fromDriver(value: string) {
    const [userId] = value.slice(1, -1).split(',');
    return userId.trim();
  },
});

export type FileAttachment = {
  bucket_id: string;
  file_path: string;
};

export const fileAttachment = customType<{
  data: FileAttachment;
  driverData: string;
}>({
  dataType() {
    return 'file_attachment';
  },
  toDriver(value: FileAttachment) {
    return sql`ROW(${value.bucket_id},${value.file_path})::file_attachment`;
  },
  fromDriver(value: string): FileAttachment {
    const [bucketId, filePath] = value.slice(1, -1).split(',');
    return { bucket_id: bucketId.trim(), file_path: filePath.trim() };
  },
});

export function escapeLiteral(str: string): string {
  return "'" + str.replace(/'/g, "''") + "'";
}

export const userProfileArray = customType<{
  data: string[];
  driverData: string;
}>({
  dataType() {
    return 'user_profile[]';
  },
  toDriver(value: string[]) {
    if (!value || value.length === 0) {
      return sql`'{}'::user_profile[]`;
    }
    const elements = value.map(id => `ROW(${escapeLiteral(id)})::user_profile`).join(',');
    return sql.raw(`ARRAY[${elements}]::user_profile[]`);
  },
  fromDriver(value: string): string[] {
    if (!value || value === '{}') return [];
    const inner = value.slice(1, -1);
    const matches = inner.match(/\([^)]*\)/g) || [];
    return matches.map(m => m.slice(1, -1).split(',')[0].trim());
  },
});

export const fileAttachmentArray = customType<{
  data: FileAttachment[];
  driverData: string;
}>({
  dataType() {
    return 'file_attachment[]';
  },
  toDriver(value: FileAttachment[]) {
    if (!value || value.length === 0) {
      return sql`'{}'::file_attachment[]`;
    }
    const elements = value.map(f =>
      `ROW(${escapeLiteral(f.bucket_id)},${escapeLiteral(f.file_path)})::file_attachment`
    ).join(',');
    return sql.raw(`ARRAY[${elements}]::file_attachment[]`);
  },
  fromDriver(value: string): FileAttachment[] {
    if (!value || value === '{}') return [];
    const inner = value.slice(1, -1);
    const matches = inner.match(/\([^)]*\)/g) || [];
    return matches.map(m => {
      const [bucketId, filePath] = m.slice(1, -1).split(',');
      return { bucket_id: bucketId.trim(), file_path: filePath.trim() };
    });
  },
});

export const libraryPageTags = pgTable("library_page_tags", {
  pageId: uuid("page_id").primaryKey(),
  tagPath: varchar("tag_path", { length: 500 }).primaryKey(),
}, (table) => [
  index("library_page_tags_tag_idx").on(table.tagPath),
  foreignKey({
    columns: [table.pageId],
    foreignColumns: [libraryPages.id],
    name: "library_page_tags_page_id_fkey",
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.tagPath],
    foreignColumns: [libraryTaxonomy.path],
    name: "library_page_tags_tag_path_fkey",
  }).onDelete("cascade"),
]);

export const libraryTaxonomy = pgTable("library_taxonomy", {
  path: varchar("path", { length: 500 }).primaryKey(),
  label: varchar("label", { length: 255 }).notNull(),
  parentPath: varchar("parent_path", { length: 500 }),
  depth: integer("depth").notNull(),
});

export const libraryPages = pgTable("library_pages", {
  id: uuid("id").primaryKey(),
  title: varchar("title", { length: 500 }).notNull(),
  episodeLabel: varchar("episode_label", { length: 255 }).notNull(),
  pageNumber: integer("page_number"),
  sourceGroup: varchar("source_group", { length: 100 }).notNull(),
  imageKey: text("image_key").notNull(),
  imagePath: text("image_path"),
  ocrText: text("ocr_text").notNull(),
  searchText: text("search_text").notNull(),
  sourceLabel: varchar("source_label", { length: 100 }).notNull(),
  createdAt: customTimestamptz("created_at", { precision: 6 }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("library_pages_episode_idx").on(table.episodeLabel),
  index("library_pages_source_idx").on(table.sourceLabel),
  index("library_pages_search_trgm_idx").using("gin", table.searchText),
]);

// table aliases
export const libraryPageTagsTable = libraryPageTags;
export const libraryPagesTable = libraryPages;
export const libraryTaxonomyTable = libraryTaxonomy;
