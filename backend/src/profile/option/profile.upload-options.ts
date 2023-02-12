import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { UnsupportedMediaTypeException } from '@nestjs/common';
import { diskStorage } from 'multer';

import { VerifiedRequest } from '../../util/type';

const PROFILE_IMAGE_PATH = 'asset/profile-image/';
const PROFILE_IMAGE_MAX_SIZE = 4194304; // 4MB
const ALLOWED_MIME_TYPES = [
  'image/apng',
  'image/avif',
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/svg+xml',
  'image/webp',
];

export const multerOptions: MulterOptions = {
  fileFilter: (req: VerifiedRequest, file, cb) =>
    ALLOWED_MIME_TYPES.includes(file.mimetype)
      ? cb(null, true)
      : cb(
          new UnsupportedMediaTypeException(
            `MIME-type must be one of ${ALLOWED_MIME_TYPES.join(', ')}`,
          ),
          false,
        ),

  storage: diskStorage({
    destination: (req: VerifiedRequest, file, cb) => {
      cb(null, PROFILE_IMAGE_PATH);
    },
    filename: (req: VerifiedRequest, file, cb) => {
      cb(null, `${req.user.userId}`);
    },
  }),
  limits: { fileSize: PROFILE_IMAGE_MAX_SIZE },
};
