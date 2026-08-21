"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type TaxonomyNode = {
  path: string;
  label: string;
  count: number;
  children: TaxonomyNode[];
};

type SearchItem = {
  id: string;
  title: string;
  episodeLabel: string;
  pageNumber: number | null;
  sourceLabel: string;
  matchedText: string;
};

function TaxonomyBranch({
  node,
  selected,
  onSelect,
}: {
  node: TaxonomyNode;
  selected: string;
  onSelect: (path: string) => void;
}) {
  const [open, setOpen] = useState(node.path === "内容主题");
  const hasChildren = node.children.length > 0;
  return (
    <div className="tree-branch">
      <button
        type="button"
        className={`tree-row ${selected === node.path ? "active" : ""}`}
        onClick={() => onSelect(node.path)}
      >
        <span className="tree-label">{node.label}</span>
        <span className="tree-count">{node.count}</span>
        {hasChildren ? (
          <span
            className="tree-toggle"
            role="button"
            aria-label={open ? "收起分类" : "展开分类"}
            tabIndex={0}
            onClick={(event) => {
              event.stopPropagation();
              setOpen((value) => !value);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.stopPropagation();
                setOpen((value) => !value);
              }
            }}
          >
            {open ? "⌄" : "›"}
          </span>
        ) : null}
      </button>
      {open && hasChildren ? (
        <div className="tree-children">
          {node.children.map((child) => (
            <TaxonomyBranch
              key={child.path}
              node={child}
              selected={selected}
              onSelect={onSelect}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function LibraryExplorer() {
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [taxonomy, setTaxonomy] = useState<TaxonomyNode[]>([]);
  const [selectedTag, setSelectedTag] = useState("");
  const [items, setItems] = useState<SearchItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/taxonomy")
      .then((response) => response.json())
      .then((payload) => setTaxonomy(payload.tree ?? []))
      .catch(() => setError("分类目录暂时无法读取"));
  }, []);

  const runSearch = useCallback(async (searchQuery: string, tag: string) => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ q: searchQuery, tag, limit: "60" });
    try {
      const response = await fetch(`/api/search?${params.toString()}`);
      if (!response.ok) throw new Error("search failed");
      const payload = await response.json();
      setItems(payload.items ?? []);
      setTotal(payload.total ?? 0);
    } catch {
      setError("搜索服务暂时不可用，请稍后重试");
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Search is an external API synchronization keyed by the submitted filters.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    runSearch(submittedQuery, selectedTag);
  }, [runSearch, submittedQuery, selectedTag]);

  const selectedLabel = useMemo(
    () => selectedTag.split("/").at(-1) || "全部图片",
    [selectedTag],
  );

  return (
    <main className="library-shell">
      <header className="topbar">
        <div className="brand-block">
          <span className="brand-mark">钉</span>
          <div>
            <h1>PPT 历史配图库</h1>
            <p>团队历史页面，一搜即用</p>
          </div>
        </div>
        <form
          className="search-form"
          onSubmit={(event) => {
            event.preventDefault();
            setSubmittedQuery(query.trim());
          }}
        >
          <span aria-hidden="true">⌕</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="输入主题、PPT标题、期数或图中文字"
            aria-label="搜索历史PPT图片"
          />
          {query ? (
            <button type="button" className="clear-button" onClick={() => setQuery("")}>
              ×
            </button>
          ) : null}
          <button type="submit" className="search-button">搜索</button>
        </form>
        <div className="privacy-chip">仅团队可访问</div>
      </header>

      <div className="workspace">
        <aside className="taxonomy-panel">
          <div className="panel-heading">
            <span>历史 PPT 分类</span>
            <button
              type="button"
              onClick={() => setSelectedTag("")}
              className={!selectedTag ? "selected-all" : ""}
            >
              全部
            </button>
          </div>
          <p className="panel-help">按内容主题浏览；也可以与上方关键词一起检索。</p>
          <div className="taxonomy-tree">
            {taxonomy.map((node) => (
              <TaxonomyBranch
                key={node.path}
                node={node}
                selected={selectedTag}
                onSelect={setSelectedTag}
              />
            ))}
          </div>
        </aside>

        <section className="results-panel">
          <div className="results-heading">
            <div>
              <span className="eyebrow">当前结果</span>
              <h2>{selectedLabel}</h2>
            </div>
            <div className="result-count">{loading ? "正在检索…" : `共 ${total.toLocaleString("zh-CN")} 张`}</div>
          </div>

          {error ? <div className="empty-state">{error}</div> : null}
          {!loading && !error && items.length === 0 ? (
            <div className="empty-state">
              <strong>没有找到对应页面</strong>
              <span>可以换一个更宽泛的词，或清除左侧分类后再试。</span>
            </div>
          ) : null}

          <div className="card-grid" aria-busy={loading}>
            {items.map((item) => (
              <article className="slide-card" key={item.id}>
                <a className="slide-preview" href={`/api/image?id=${encodeURIComponent(item.id)}`} target="_blank" rel="noreferrer">
                  <img src={`/api/image?id=${encodeURIComponent(item.id)}`} alt={item.title} loading="lazy" />
                  <span className="zoom-hint">查看大图</span>
                </a>
                <div className="slide-info">
                  <h3>{item.title || "未命名页面"}</h3>
                  <p className="source-line">
                    <span>{item.sourceLabel}</span>
                    <strong>{item.episodeLabel || "专题PPT"}</strong>
                    {item.pageNumber ? <span>第 {item.pageNumber} 页</span> : null}
                  </p>
                  {item.matchedText ? <p className="match-snippet">{item.matchedText}</p> : null}
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
