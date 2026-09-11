const fs =
  require('fs/promises');

async function cleanupFile(
  file
) {
  if (!file?.path) return;

  try {
    await fs.unlink(
      file.path
    );
  } catch {
    // Nothing else needed if the file is already gone.
  }
}

const validate =
  (schema) =>
  async (req, res, next) => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });

      next();
    } catch (error) {
      // Multer runs before receipt validation,
      // so remove a file when validation rejects the form.
      await cleanupFile(
        req.file
      );

      next(error);
    }
  };

module.exports = validate;