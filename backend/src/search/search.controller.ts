import { Controller, Get, Query, Req } from '@nestjs/common';

import { SearchService } from './search.service';
import { VerifiedRequest } from '../util/type';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  search(@Req() req: VerifiedRequest, @Query('value') value: string) {
    return this.searchService.find(value);
  }
}
