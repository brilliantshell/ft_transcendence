import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { VerifiedRequest } from 'src/util/type';
import { diskStorage } from 'multer';
import {
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { existsSync, mkdirSync } from 'fs';

const PROFILE_IMAGE_PATH = 'asset/profile/'; // 추후에 변경

export const multerOptions: MulterOptions = {
  fileFilter: (req, file, cb) => {
    if (file.size > 5242880 /** 5MB */) {
      throw new PayloadTooLargeException('File size must be less than 5MB');
    }
    if (file.mimetype === 'image/png' || file.mimetype === 'image/jpeg') {
      cb(null, true);
    } else {
      cb(
        new UnsupportedMediaTypeException(
          'MIME-type must be image/png or image/jpeg',
        ),
        false,
      );
    }
  },
  storage: diskStorage({
    destination: (req, file, cb) => {
      const userId = (req as VerifiedRequest).user.userId;
      const userDirectory = PROFILE_IMAGE_PATH + userId;
      existsSync(userDirectory) || mkdirSync(userDirectory);
      cb(null, userDirectory);
    },
    filename: (req, file, cb) => {
      const userId = (req as VerifiedRequest).user.userId;
      cb(null, `${userId}.${file.mimetype.slice(6)}`);
    },
  }),
  limits: { fileSize: 5242880 /** 5MB */ },
};
