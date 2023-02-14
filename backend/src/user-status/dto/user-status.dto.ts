import { IsString, Matches } from 'class-validator';

import { Activity, CurrentUi, GameId, UserId } from '../../util/type';

export class CurrentUiDto {
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
