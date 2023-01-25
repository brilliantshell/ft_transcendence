import { Type } from 'class-transformer';
import { IsInt, IsString, Matches, Max, Min } from 'class-validator';

import { CurrentUi, UserId } from '../../util/type';

export class CurrentUiDto {
  @Type(() => Number)
  @IsInt()
  @Min(10000)
  @Max(199999)
  userId: UserId;

  @IsString()
  @Matches(
    new RegExp(
      '^(chats|playingGame|profile' +
        '|ranks|watchingGame|waitingRoom' +
        '|chatRooms-[1-9]\\d*)$',
    ),
  )
  ui: CurrentUi;
}
