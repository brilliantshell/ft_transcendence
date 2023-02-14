import { IsInt, IsString, Matches, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

import { Activity, CurrentUi, GameId, UserId } from '../../util/type';

export class CurrentUiDto {
  @Type(() => Number)
  @IsInt()
  @Min(10000)
  @Max(199999)
  userId: UserId;

  @IsString()
  @Matches(
    new RegExp(
      '^(chats|profile' +
        '|ranks|watchingGame|waitingRoom' +
        '|chatRooms-[1-9]\\d*|game-[0-9A-Za-z_-]{21})$',
    ),
  )
  ui: CurrentUi;
}

export interface UserActivityDto {
  activity: Activity;
  gameId: GameId;
  userId: UserId;
}
