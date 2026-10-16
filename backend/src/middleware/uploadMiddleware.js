import multer from 'multer';
import { ALLOWED_PREREQUISITE_MIME_TYPES } from '../constants/prerequisites.js';

export const prerequisiteUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024
  },
  fileFilter: (_req, file, callback) => {
    if (!ALLOWED_PREREQUISITE_MIME_TYPES.includes(file.mimetype)) {
      callback(new Error('Only PDF, JPG, PNG, and WebP files are allowed'));
      return;
    }
    callback(null, true);
  }
});

export const attachmentUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024
  },
  // General project attachments, including mechanical design files, may use any format.
  fileFilter: (_req, _file, callback) => callback(null, true)
});
