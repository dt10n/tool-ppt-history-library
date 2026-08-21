create extension if not exists pg_trgm;

create table if not exists pages (
  id text primary key,
  title text not null default '',
  episode_label text not null default '',
  page_number integer,
  source_group text not null,
  source_label text not null,
  image_key text not null,
  ocr_text text not null default '',
  search_text text not null default ''
);

create table if not exists taxonomy (
  path text primary key,
  label text not null,
  parent_path text not null default '',
  depth integer not null
);

create table if not exists page_tags (
  page_id text not null references pages(id) on delete cascade,
  tag_path text not null references taxonomy(path) on delete cascade,
  primary key (page_id, tag_path)
);

create index if not exists idx_pages_episode_page on pages (episode_label, page_number);
create index if not exists idx_pages_search_trgm on pages using gin (search_text gin_trgm_ops);
create index if not exists idx_pages_title_trgm on pages using gin (title gin_trgm_ops);
create index if not exists idx_taxonomy_parent on taxonomy (parent_path);
create index if not exists idx_page_tags_path_page on page_tags (tag_path, page_id);

create or replace function search_library_pages(
  query_terms text[] default '{}',
  selected_tag text default '',
  result_limit integer default 60
)
returns table (
  id text, title text, episode_label text, page_number integer,
  source_label text, ocr_text text, total_count bigint
)
language sql stable security definer set search_path = public
as $$
  with matched as (
    select p.*
    from pages p
    where (coalesce(array_length(query_terms, 1), 0) = 0 or
      not exists (
        select 1 from unnest(query_terms) term
        where lower(p.search_text) not like '%' || lower(term) || '%'
      ))
      and (selected_tag = '' or exists (
        select 1 from page_tags pt
        where pt.page_id = p.id
          and (pt.tag_path = selected_tag or pt.tag_path like selected_tag || '/%')
      ))
  )
  select m.id,m.title,m.episode_label,m.page_number,m.source_label,m.ocr_text,
    count(*) over() as total_count
  from matched m
  order by
    case when coalesce(array_length(query_terms, 1), 0) > 0
      and lower(m.title) like '%' || lower(query_terms[1]) || '%' then 0
      when coalesce(array_length(query_terms, 1), 0) > 0
      and lower(m.episode_label) like '%' || lower(query_terms[1]) || '%' then 1
      else 2 end,
    m.episode_label desc, m.page_number asc nulls last
  limit least(greatest(result_limit, 1), 100);
$$;

create or replace function library_taxonomy_counts()
returns table (path text, label text, parent_path text, depth integer, count bigint)
language sql stable security definer set search_path = public
as $$
  select t.path,t.label,t.parent_path,t.depth,count(distinct pt.page_id)::bigint
  from taxonomy t
  left join page_tags pt on pt.tag_path = t.path or pt.tag_path like t.path || '/%'
  group by t.path,t.label,t.parent_path,t.depth
  order by t.depth,t.path;
$$;

revoke all on function search_library_pages(text[], text, integer) from public, anon;
revoke all on function library_taxonomy_counts() from public, anon;
grant execute on function search_library_pages(text[], text, integer) to service_role;
grant execute on function library_taxonomy_counts() to service_role;
