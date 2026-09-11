const errorHandler = (
  err,
  req,
  res,
  next
) => {
  // Zod 4 validation errors.
  if (
    err.name ===
    'ZodError'
  ) {
    return res
      .status(400)
      .json({
        message:
          'Validation failed',

        errors: (
          err.issues || []
        ).map((issue) => ({
          field:
            issue.path.join(
              '.'
            ),

          message:
            issue.message,
        })),
      });
  }

  // Prisma unique constraint.
  if (
    err.code === 'P2002'
  ) {
    const target =
      err.meta?.target;

    const field =
      Array.isArray(target)
        ? target[0]
        : typeof target ===
            'string'
          ? target
          : 'field';

    return res
      .status(409)
      .json({
        message:
          `${field} already exists`,
      });
  }

  // Prisma record not found.
  if (
    err.code === 'P2025'
  ) {
    return res
      .status(404)
      .json({
        message:
          'Record not found',
      });
  }

  // Multer upload size.
  if (
    err.code ===
    'LIMIT_FILE_SIZE'
  ) {
    return res
      .status(400)
      .json({
        message:
          'File size exceeds the upload limit',
      });
  }

  // Multer file count.
  if (
    err.code ===
    'LIMIT_FILE_COUNT'
  ) {
    return res
      .status(400)
      .json({
        message:
          'Only one receipt file can be uploaded',
      });
  }

  if (
    err.message ===
    'Invalid file type'
  ) {
    return res
      .status(400)
      .json({
        message:
          'Invalid file type. Only JPEG, PNG, and PDF are allowed.',
      });
  }

  const status =
    Number.isInteger(
      err.status
    )
      ? err.status
      : 500;

  // Don't expose Prisma/internal errors
  // to users in production.
  const message =
    status >= 500 &&
    process.env.NODE_ENV ===
      'production'
      ? 'Internal server error'
      : err.message ||
        'Internal server error';

  return res
    .status(status)
    .json({
      message,
    });
};

module.exports =
  errorHandler;