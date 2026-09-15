import { Controller, Get, Query } from '@nestjs/common';

import type {
  SearchResponse,
  TaxonomyResponse,
} from '@shared/api.interface';

import { LibraryService } from './library.service';

@Controller('api/library')
export class LibraryController {
  constructor(private readonly libraryService: LibraryService) {}

  @Get('taxonomy')
  async getTaxonomy(): Promise<TaxonomyResponse> {
    return this.libraryService.getTaxonomy();
  }

  @Get('search')
  async search(
    @Query('q') rawQuery?: string,
    @Query('tag') rawTag?: string,
    @Query('limit') rawLimit?: string,
  ): Promise<SearchResponse> {
    const parsedLimit: number = Number.parseInt(rawLimit ?? '60', 10);
    const limit: number = Number.isFinite(parsedLimit)
      ? Math.min(Math.max(parsedLimit, 1), 60)
      : 60;
    return this.libraryService.search(
      (rawQuery ?? '').trim(),
      (rawTag ?? '').trim(),
      limit,
    );
  }
}
