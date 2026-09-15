import { logger } from '@lark-apaas/client-toolkit/logger';
import { getDataloom } from '@lark-apaas/client-toolkit/dataloom';
import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import type {
  SearchResponse,
  TaxonomyResponse,
} from '@shared/api.interface';


export async function getTaxonomy(): Promise<TaxonomyResponse> {
  try {
    const response = await axiosForBackend({
      url: '/api/library/taxonomy',
      method: 'GET',
    });
    return response.data as TaxonomyResponse;
  } catch (error) {
    logger.error(`读取分类失败: ${String(error)}`);
    throw error;
  }
}

export async function searchLibrary(
  query: string,
  tag: string,
  limit: number,
): Promise<SearchResponse> {
  try {
    const response = await axiosForBackend({
      url: '/api/library/search',
      method: 'GET',
      params: { q: query, tag, limit },
    });
    const payload: SearchResponse = response.data as SearchResponse;
    const dataloom = await getDataloom();
    const items = await Promise.all(
      payload.items.map(async (item) => {
        const match: RegExpMatchArray | null = item.imageUrl.match(
          /storage\/object\/(bucket_[^/]+)\/(.+)$/u,
        );
        if (!match?.[1] || !match[2]) return item;
        const result = await dataloom.storage
          .from(match[1])
          .createSignedUrl(decodeURIComponent(match[2]), 3600);
        if (result.error) {
          logger.error(`图片签名失败: ${item.id}`);
          return item;
        }
        return { ...item, imageUrl: result.data.signedUrl };
      }),
    );
    return { ...payload, items };
  } catch (error) {
    logger.error(`搜索图片失败: ${String(error)}`);
    throw error;
  }
}
