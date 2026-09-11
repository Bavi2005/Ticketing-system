const multer = require('multer');
const path = require('path');
const fs = require('fs');

const BACKEND_ROOT =
  path.resolve(
    __dirname,
    '../..'
  );

const configuredUploadDir =
  process.env.UPLOAD_DIR?.trim() ||
  'uploads';

// Relative UPLOAD_DIR values are always
// relative to backend/, never process.cwd().
const UPLOAD_DIR =
  path.isAbsolute(
    configuredUploadDir
  )
    ? configuredUploadDir
    : path.resolve(
        BACKEND_ROOT,
        configuredUploadDir
      );

const MAX_FILE_SIZE =
  Number.parseInt(
    process.env.MAX_FILE_SIZE,
    10
  ) ||
  5 * 1024 * 1024;

const MIME_EXTENSIONS = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'application/pdf': '.pdf',
};

fs.mkdirSync(
  UPLOAD_DIR,
  {
    recursive: true,
  }
);

const storage =
  multer.diskStorage({
    destination: (
      req,
      file,
      callback
    ) => {
      callback(
        null,
        UPLOAD_DIR
      );
    },

    filename: (
      req,
      file,
      callback
    ) => {
      const uniqueSuffix =
        `${Date.now()}-${Math.round(
          Math.random() *
            1e9
        )}`;

      // Extension comes from the MIME type,
      // not from an arbitrary user filename.
      const extension =
        MIME_EXTENSIONS[
          file.mimetype
        ] || '';

      callback(
        null,
        `receipt-${uniqueSuffix}${extension}`
      );
    },
  });

const fileFilter = (
  req,
  file,
  callback
) => {
  if (
    MIME_EXTENSIONS[
      file.mimetype
    ]
  ) {
    return callback(
      null,
      true
    );
  }

  callback(
    new Error(
      'Invalid file type'
    ),
    false
  );
};

const upload =
  multer({
    storage,

    fileFilter,

    limits: {
      fileSize:
        MAX_FILE_SIZE,

      files: 1,
    },
  });

module.exports = {
  upload,
  UPLOAD_DIR,
};