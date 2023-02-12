import { IsEmail, IsString, Length } from 'class-validator';

export class NicknameDto {
  @IsString()
  @Length(4, 10)
  nickname: string;
}

export class TwoFactorEmailDto {
  @IsEmail()
  email: string;
}
