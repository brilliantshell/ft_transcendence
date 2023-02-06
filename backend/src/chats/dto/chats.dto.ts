import {
  IsOptional,
  IsString,
  IsStrongPassword,
  Length,
  Matches,
} from 'class-validator';

import { ChannelId, UserRole } from '../../util/type';

interface OtherChannel {
  channelId: ChannelId;
  channelName: string;
  memberCount: number;
  accessMode: 'public' | 'protected';
}

interface JoinedChannel extends Omit<OtherChannel, 'accessMode'> {
  accessMode: 'public' | 'protected' | 'private';
  unseenCount: number;
  isDm: boolean;
}

export interface AllChannelsDto {
  joinedChannels?: JoinedChannel[];
  otherChannels?: OtherChannel[];
}

interface ChannelMember {
  id: number;
  role: UserRole;
}

export interface ChannelInfoDto {
  channelsMembers: ChannelMember[];
  isReadonlyDm: boolean | null;
}

export class CreateChannelDto {
  @IsString()
  @Length(1, 128)
  channelName: string;

  // FIXME : password max length 정해서 반영하기
  @IsString()
  @Length(8, 20)
  @IsOptional()
  @IsStrongPassword({
    minLowercase: 1,
    minUppercase: 0,
    minNumbers: 1,
    minSymbols: 0,
  })
  password?: string;

  @IsString()
  @Matches(/^(public|protected|private)$/)
  accessMode: 'public' | 'protected' | 'private';
}

export class MessageDto {
  @IsString()
  @Length(1, 4096)
  message: string;

  @IsOptional()
  command?: [kind: string, targetId: number, args: string];
}

export class JoinChannelDto {
  @IsString()
  @Length(8, 20)
  @IsOptional()
  @IsStrongPassword({
    minLowercase: 1,
    minUppercase: 0,
    minNumbers: 1,
    minSymbols: 0,
  })
  password: string;
}
