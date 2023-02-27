import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { Users } from '../entity/users.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Users])],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
