import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpen, LockKeyhole, Search, X } from 'lucide-react';

import { Image } from '@/components/ui/image';
import { Input } from '@/components/ui/input';
import type { SearchItem, TaxonomyNode } from '@shared/api.interface';

import { getTaxonomy, searchLibrary } from '../../api';

interface TaxonomyBranchProps {
  node: TaxonomyNode;
  selected: string;
  onSelect: (path: string) => void;
}

const TaxonomyBranch: React.FC<TaxonomyBranchProps> = ({
  node,
  selected,
  onSelect,
}) => {
  const [open, setOpen] = useState<boolean>(node.path === '内容主题');
  const hasChildren: boolean = node.children.length > 0;

  return (
    <div className="tree-branch">
      <div className={selected === node.path ? 'tree-row active' : 'tree-row'}>
        <button
          type="button"
          className="tree-select"
          onClick={() => onSelect(node.path)}
        >
          <span className="tree-label">{node.label}</span>
          <span className="tree-count">{node.count}</span>
        </button>
        {hasChildren ? (
          <button
            type="button"
            className="tree-toggle"
            aria-label={open ? '收起分类' : '展开分类'}
            onClick={() => setOpen((value: boolean) => !value)}
          >
            {open ? '−' : '+'}
          </button>
        ) : null}
      </div>
      {open && hasChildren ? (
        <div className="tree-children">
          {node.children.map((child: TaxonomyNode) => (
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
};

const LibraryPage: React.FC = () => {
  const [query, setQuery] = useState<string>('');
  const [submittedQuery, setSubmittedQuery] = useState<string>('');
  const [taxonomy, setTaxonomy] = useState<TaxonomyNode[]>([]);
  const [selectedTag, setSelectedTag] = useState<string>('');
  const [items, setItems] = useState<SearchItem[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    getTaxonomy()
      .then((payload) => setTaxonomy(payload.tree))
      .catch(() => setError('分类目录暂时无法读取'));
  }, []);

  const runSearch = useCallback(async (searchQuery: string, tag: string) => {
    setLoading(true);
    setError('');
    try {
      const payload = await searchLibrary(searchQuery, tag, 60);
      setItems(payload.items);
      setTotal(payload.total);
    } catch {
      setError('搜索服务暂时不可用，请稍后重试');
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void runSearch(submittedQuery, selectedTag);
  }, [runSearch, selectedTag, submittedQuery]);

  const selectedLabel: string = useMemo(
    () => selectedTag.split('/').at(-1) || '全部图片',
    [selectedTag],
  );

  return (
    <main className="library-shell">
      <header className="topbar">
        <div className="brand-block">
          <span className="brand-mark"><BookOpen size={22} /></span>
          <div>
            <h1>PPT 历史配图库</h1>
            <p>团队历史页面，一搜即用</p>
          </div>
        </div>
        <form
          className="search-form"
          onSubmit={(event: React.FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            setSubmittedQuery(query.trim());
          }}
        >
          <Search size={20} aria-hidden="true" />
          <Input
            value={query}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
              setQuery(event.target.value);
            }}
            placeholder="输入主题、PPT 标题、期数或图中文字"
            aria-label="搜索历史 PPT 图片"
          />
          {query ? (
            <button
              type="button"
              className="clear-button"
              aria-label="清空搜索词"
              onClick={() => setQuery('')}
            >
              <X size={17} />
            </button>
          ) : null}
          <button type="submit" className="search-button">搜索</button>
        </form>
        <div className="privacy-chip">
          <LockKeyhole size={15} />
          飞书团队访问
        </div>
      </header>

      <div className="workspace">
        <aside className="taxonomy-panel">
          <div className="panel-heading">
            <span>历史 PPT 分类</span>
            <button
              type="button"
              onClick={() => setSelectedTag('')}
              className={!selectedTag ? 'selected-all' : ''}
            >
              全部
            </button>
          </div>
          <p className="panel-help">
            按内容主题浏览，也可以与上方关键词一起检索。
          </p>
          <div className="taxonomy-tree">
            {taxonomy.map((node: TaxonomyNode) => (
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
            <div className="result-count">
              {loading ? '正在检索…' : `共 ${total.toLocaleString('zh-CN')} 张`}
            </div>
          </div>

          {error ? <div className="empty-state">{error}</div> : null}
          {!loading && !error && items.length === 0 ? (
            <div className="empty-state">
              <strong>没有找到对应页面</strong>
              <span>可以换一个更宽泛的词，或清除左侧分类后再试。</span>
            </div>
          ) : null}

          <div className="card-grid" aria-busy={loading}>
            {items.map((item: SearchItem) => (
              <article className="slide-card" key={item.id}>
                <a
                  className="slide-preview"
                  href={item.imageUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Image
                    src={item.imageUrl}
                    alt={item.title}
                    sizes="(max-width: 560px) 100vw, (max-width: 900px) 50vw, 320px"
                  />
                  <span className="zoom-hint">查看大图</span>
                </a>
                <div className="slide-info">
                  <h3>{item.title || '未命名页面'}</h3>
                  <p className="source-line">
                    <span>{item.sourceLabel}</span>
                    <strong>{item.episodeLabel || '专题 PPT'}</strong>
                    {item.pageNumber ? <span>第 {item.pageNumber} 页</span> : null}
                  </p>
                  {item.matchedText ? (
                    <p className="match-snippet">{item.matchedText}</p>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
};

export default LibraryPage;
