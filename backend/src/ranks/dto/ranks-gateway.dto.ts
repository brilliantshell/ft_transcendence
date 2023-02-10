import { UserId } from '../../util/type';

export interface LadderUpdateDto {
  winnerId: UserId;
  ladder: number;
}
