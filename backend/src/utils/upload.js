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

// Ticket attachments are buffered in memory, then written by
// persistTicketFiles() to Supabase Storage (production) or UPLOAD_DIR (local).
const ticketUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (TICKET_MIME_EXTENSIONS[file.mimetype]) return cb(null, true);
    cb(new Error('File type not supported. Use images, PDF, Word, Excel or text files.'), false);
  },
  limits: { fileSize: 10 * 1024 * 1024, files: 5 },
});

// Runs after ticketUpload.array(): gives every file a generated name and
// saves its bytes. Controllers keep using f.filename / f.originalname / f.size.
const persistTicketFiles = async (req, res, next) => {
  const files = req.files || [];
  if (!files.length) return next();
  // Required lazily to avoid a circular import (attachmentStorage needs UPLOAD_DIR).
  const { saveFile, removeFiles } = require('./attachmentStorage');
  const saved = [];
  try {
    for (const f of files) {
      const suffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      f.filename = `ticket-${suffix}${TICKET_MIME_EXTENSIONS[f.mimetype] || ''}`;
      await saveFile(f.filename, f.buffer, f.mimetype);
      saved.push(f.filename);
      f.buffer = undefined;
    }
    next();
  } catch (err) {
    await removeFiles(saved);
    next(err);
  }
};

module.exports = {
  upload,
  ticketUpload,
  persistTicketFiles,
  UPLOAD_DIR,
};