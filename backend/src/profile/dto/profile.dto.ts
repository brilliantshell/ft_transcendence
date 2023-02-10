import { IsEmail, IsString, Length } from 'class-validator';

export class NicknameDto {
  @IsString()
  @Length(3, 16) // FIXME : 닉네임 길이 정책 정하기
  nickname: string;
}

export class TwoFactorEmailDto {
  @IsEmail()
  email: string;
}
