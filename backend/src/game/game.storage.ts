import { Injectable } from '@nestjs/common';

import { GameId, GameInfo } from '../util/type';

@Injectable()
export class GameStorage {
  readonly ladderGames = new Map<GameId, GameInfo>();
  readonly normalGames = new Map<GameId, GameInfo>();
}
