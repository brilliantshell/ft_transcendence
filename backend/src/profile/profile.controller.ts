import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Put,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';

import { ProfileService } from './profile.service';
import { UserId, VerifiedRequest } from '../util/type';
import { IsEmail, IsString, Length } from 'class-validator';
import { MockAuthGuard } from '../chats/guard/mock-auth.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { multerOptions } from './profile.upload-options';

class NicknameDto {
  @IsString()
  @Length(3, 16)
  nickname: string;
}

class TwoFactorEmailDto {
  @IsEmail()
  email: string;
}

// FIXME: AuthGuard 구현 후 변경
@UseGuards(MockAuthGuard)
@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get('2fa-email')
  findTwoFactorEmail(@Req() req: VerifiedRequest) {
    return this.profileService.findTwoFactorEmail(req.user.userId);
  }

  @Patch('2fa-email')
  updateTwoFactorEmail(
    @Req() req: VerifiedRequest,
    @Body() twoFactorEmailDto: TwoFactorEmailDto,
  ) {
    return this.profileService.updateTwoFactorEmail(
      req.user.userId,
      twoFactorEmailDto.email,
    );
  }

  @Delete('2fa-email')
  deleteTwoFactorEmail(@Req() req: VerifiedRequest) {
    return this.profileService.deleteTwoFactorEmail(req.user.userId);
  }

  @Get(':userId')
  findProfile(@Param('userId', ParseIntPipe) userId: UserId) {
    return this.profileService.findProfile(userId);
  }

  @Patch('nickname')
  updateNickname(
    @Req() req: VerifiedRequest,
    @Body() nicknameDto: NicknameDto,
  ) {
    return this.profileService.updateNickname(
      req.user.userId,
      nicknameDto.nickname,
    );
  }

  @Put('image')
  @UseInterceptors(FileInterceptor('profileImage', multerOptions))
  async updateProfileImage(
    @Req() req: VerifiedRequest,
    @UploadedFile() file: Express.Multer.File,
  ) {
    await this.profileService.updateProfileImage(
      req.user.userId,
      file.filename,
    );
  }

  @Delete('image')
  async deleteProfileImage(@Req() req: VerifiedRequest) {
    await this.profileService.deleteProfileImage(req.user.userId);
  }
}
