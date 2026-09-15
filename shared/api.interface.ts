export interface TaxonomyNode {
  path: string;
  label: string;
  count: number;
  children: TaxonomyNode[];
}

export interface TaxonomyResponse {
  tree: TaxonomyNode[];
}

export interface SearchItem {
  id: string;
  title: string;
  episodeLabel: string;
  pageNumber: number | null;
  sourceLabel: string;
  imageUrl: string;
  matchedText: string;
  relevance: number;
}

export interface SearchResponse {
  items: SearchItem[];
  total: number;
}
