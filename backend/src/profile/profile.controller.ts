import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Put,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';

import { MockAuthGuard } from '../chats/guard/mock-auth.guard';
import { NicknameDto, TwoFactorEmailDto } from './dto/profile.dto';
import { ProfileService } from './profile.service';
import { UserId, VerifiedRequest } from '../util/type';
import { ValidateUserIdPipe } from './pipe/validate-user-id.pipe';
import { multerOptions } from './profile.upload-options';

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
  findProfile(@Param('userId', ValidateUserIdPipe) userId: UserId) {
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
  // FIXME: formData key, 프론트와 협의 후 수정
  @UseInterceptors(FileInterceptor('profileImage', multerOptions))
  async updateProfileImage(
    @Req() req: VerifiedRequest,
    @UploadedFile() file: Express.Multer.File,
    @Res() res: Response,
  ) {
    await this.profileService.updateProfileImage(
      req.user.userId,
      file.filename,
    );
    res.status(201).set('location', `/${file.path}`).end();
  }

  @Delete('image')
  deleteProfileImage(@Req() req: VerifiedRequest) {
    return this.profileService.deleteProfileImage(req.user.userId);
  }
}