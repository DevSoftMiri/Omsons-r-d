export function notFound(req, res, next) {
  res.status(404);
  next(new Error(`Not found: ${req.originalUrl}`));
}

export function errorHandler(error, _req, res, _next) {
  // Multer errors otherwise surface as an unhelpful connection failure in
  // some Vite proxy/browser combinations.
  const status = error.code === 'LIMIT_FILE_SIZE'
    ? 413
    : error.statusCode || (res.statusCode === 200 ? 500 : res.statusCode);
  res.status(status).json({
    message: error.code === 'LIMIT_FILE_SIZE'
      ? 'Attachment exceeds the 4 MB upload limit.'
      : error.message || 'Upload failed.',
    stack: process.env.NODE_ENV === 'production' ? undefined : error.stack
  });
}
