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

const TICKET_MIME_EXTENSIONS = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'text/plain': '.txt',
  'text/csv': '.csv',
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

const ticketStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const suffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = TICKET_MIME_EXTENSIONS[file.mimetype] || '';
    cb(null, `ticket-${suffix}${ext}`);
  },
});

const ticketUpload = multer({
  storage: ticketStorage,
  fileFilter: (req, file, cb) => {
    if (TICKET_MIME_EXTENSIONS[file.mimetype]) return cb(null, true);
    cb(new Error('File type not supported. Use images, PDF, Word, Excel or text files.'), false);
  },
  limits: { fileSize: 10 * 1024 * 1024, files: 5 },
});

module.exports = {
  upload,
  ticketUpload,
  UPLOAD_DIR,
};