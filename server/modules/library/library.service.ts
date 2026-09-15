import { Inject, Injectable } from '@nestjs/common';
import {
  DRIZZLE_DATABASE,
  type PostgresJsDatabase,
} from '@lark-apaas/fullstack-nestjs-core';
import { and, count, desc, ilike, or, sql } from 'drizzle-orm';

import {
  libraryPages,
  libraryPageTags,
  libraryTaxonomy,
} from '@server/database/schema';
import type {
  SearchItem,
  SearchResponse,
  TaxonomyNode,
  TaxonomyResponse,
} from '@shared/api.interface';

interface TaxonomyRow {
  path: string;
  label: string;
  parentPath: string | null;
  count: number;
}

interface SearchRow {
  id: string;
  title: string;
  episodeLabel: string;
  pageNumber: number | null;
  sourceLabel: string;
  imagePath: string | null;
  ocrText: string;
  relevance: number;
}

@Injectable()
export class LibraryService {
  constructor(
    @Inject(DRIZZLE_DATABASE)
    private readonly db: PostgresJsDatabase,
  ) {}

  async getTaxonomy(): Promise<TaxonomyResponse> {
    const rows: TaxonomyRow[] = await this.db
      .select({
        path: libraryTaxonomy.path,
        label: libraryTaxonomy.label,
        parentPath: libraryTaxonomy.parentPath,
        count: sql<number>`count(${libraryPageTags.pageId})::int`,
      })
      .from(libraryTaxonomy)
      .leftJoin(
        libraryPageTags,
        sql`${libraryPageTags.tagPath} LIKE ${libraryTaxonomy.path} || '%'`,
      )
      .groupBy(
        libraryTaxonomy.path,
        libraryTaxonomy.label,
        libraryTaxonomy.parentPath,
        libraryTaxonomy.depth,
      )
      .orderBy(libraryTaxonomy.depth, libraryTaxonomy.path);

    const nodes: Map<string, TaxonomyNode> = new Map<string, TaxonomyNode>();
    rows.forEach((row: TaxonomyRow) => {
      nodes.set(row.path, {
        path: row.path,
        label: row.label,
        count: Number(row.count),
        children: [],
      });
    });

    const tree: TaxonomyNode[] = [];
    rows.forEach((row: TaxonomyRow) => {
      const node: TaxonomyNode | undefined = nodes.get(row.path);
      if (!node) return;
      const parent: TaxonomyNode | undefined = row.parentPath
        ? nodes.get(row.parentPath)
        : undefined;
      if (parent) parent.children.push(node);
      else tree.push(node);
    });
    return { tree };
  }

  async search(
    query: string,
    tag: string,
    limit: number,
  ): Promise<SearchResponse> {
    const terms: string[] = query
      .split(/\s+/u)
      .filter((term: string): boolean => term.length > 0);
    const tagPattern: string = `${tag}%`;
    const titleExactScore = query
      ? sql<number>`(case when ${libraryPages.title} ilike ${`%${query}%`} then 1 else 0 end)`
      : sql<number>`0`;
    const trigramScore = query
      ? sql<number>`greatest(
          similarity(${libraryPages.title}, ${query}),
          word_similarity(${query}, ${libraryPages.searchText})
        )`
      : sql<number>`0`;
    // 标题里命中了几个词，用来把"多个词都出现在标题里"的结果排到
    // 前面，避免多词 AND 命中集合内全靠整句 trigram 分数排序时因为
    // 大家分数接近而排不出真正相关的那条。
    const titleTermScores = terms.map((term: string) => {
      const termPattern: string = `%${term}%`;
      return sql<number>`(case when ${libraryPages.title} ilike ${termPattern} then 1 else 0 end)`;
    });
    const titleTermMatchScore =
      titleTermScores.length > 0
        ? sql<number>`(${sql.join(titleTermScores, sql` + `)})`
        : sql<number>`0`;
    const relevance = query
      ? sql<number>`(${titleExactScore} * 20 + ${titleTermMatchScore} * 5 + ${trigramScore})`
      : sql<number>`1`;
    const tokenCondition =
      terms.length > 0
        ? and(
            ...terms.map((term: string) => {
              const termPattern: string = `%${term}%`;
              return or(
                ilike(libraryPages.title, termPattern),
                ilike(libraryPages.searchText, termPattern),
              );
            }),
          )
        : undefined;
    // 单个词才允许用整句 trigram 相似度兜底(容忍拼写误差/别名);
    // 多个词必须严格按词 AND 匹配，避免其中一个宽松的整句相似度分支
    // 把 AND 语义重新撑开成大范围模糊匹配。
    const fuzzyCondition =
      query && terms.length <= 1 ? sql`${trigramScore} > 0.16` : undefined;
    const queryCondition = query
      ? tokenCondition && fuzzyCondition
        ? or(tokenCondition, fuzzyCondition)
        : tokenCondition ?? fuzzyCondition
      : undefined;
    const tagCondition = tag
      ? sql`exists (
          select 1 from ${libraryPageTags}
          where ${libraryPageTags.pageId} = ${libraryPages.id}
          and ${libraryPageTags.tagPath} like ${tagPattern}
        )`
      : undefined;
    const whereCondition = queryCondition && tagCondition
      ? and(queryCondition, tagCondition)
      : queryCondition ?? tagCondition;

    const rows: SearchRow[] = await this.db
      .select({
        id: libraryPages.id,
        title: libraryPages.title,
        episodeLabel: libraryPages.episodeLabel,
        pageNumber: libraryPages.pageNumber,
        sourceLabel: libraryPages.sourceLabel,
        imagePath: libraryPages.imagePath,
        ocrText: libraryPages.ocrText,
        relevance,
      })
      .from(libraryPages)
      .where(whereCondition)
      .orderBy(desc(relevance), desc(libraryPages.episodeLabel))
      .limit(limit);

    const countRows: Array<{ count: number }> = await this.db
      .select({ count: count(libraryPages.id) })
      .from(libraryPages)
      .where(whereCondition);
    const total: number = Number(countRows[0]?.count ?? 0);
    const items: SearchItem[] = rows.map((row: SearchRow) => ({
      id: row.id,
      title: row.title,
      episodeLabel: row.episodeLabel,
      pageNumber: row.pageNumber,
      sourceLabel: row.sourceLabel,
      imageUrl: row.imagePath ?? '',
      matchedText: row.ocrText.replace(/\s+/gu, ' ').trim().slice(0, 150),
      relevance: Number(row.relevance),
    }));
    return { items, total };
  }
}
