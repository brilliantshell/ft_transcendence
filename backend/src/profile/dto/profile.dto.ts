import { IsAlpha, IsEmail, IsString, Length } from 'class-validator';

export class NicknameDto {
  @IsString()
  @IsAlpha()
  @Length(4, 10)
  nickname: string;
}

export class TwoFactorEmailDto {
  @IsEmail()
  email: string;
}

export class AuthCodeDto {
  @IsString()
  @Length(6, 6)
  authCode: string;
}
