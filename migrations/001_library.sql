CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS library_pages (
  id uuid PRIMARY KEY,
  title varchar(500) NOT NULL,
  episode_label varchar(255) NOT NULL,
  page_number integer,
  source_group varchar(100) NOT NULL,
  image_key text NOT NULL,
  image_path text,
  ocr_text text NOT NULL DEFAULT '',
  search_text text NOT NULL DEFAULT '',
  source_label varchar(100) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS library_taxonomy (
  path varchar(500) PRIMARY KEY,
  label varchar(255) NOT NULL,
  parent_path varchar(500),
  depth integer NOT NULL
);

CREATE TABLE IF NOT EXISTS library_page_tags (
  page_id uuid NOT NULL REFERENCES library_pages(id) ON DELETE CASCADE,
  tag_path varchar(500) NOT NULL REFERENCES library_taxonomy(path) ON DELETE CASCADE,
  PRIMARY KEY (page_id, tag_path)
);

CREATE INDEX IF NOT EXISTS library_pages_episode_idx
  ON library_pages (episode_label);
CREATE INDEX IF NOT EXISTS library_pages_source_idx
  ON library_pages (source_label);
CREATE INDEX IF NOT EXISTS library_page_tags_tag_idx
  ON library_page_tags (tag_path);
CREATE INDEX IF NOT EXISTS library_pages_search_trgm_idx
  ON library_pages USING gin (search_text gin_trgm_ops);
