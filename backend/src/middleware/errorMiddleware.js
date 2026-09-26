export function notFound(req, res, next) {
  res.status(404);
  next(new Error(`Not found: ${req.originalUrl}`));
}

export function errorHandler(error, _req, res, _next) {
  const status = error.statusCode || (res.statusCode === 200 ? 500 : res.statusCode);
  res.status(status).json({
    message: error.message,
    stack: process.env.NODE_ENV === 'production' ? undefined : error.stack
  });
}
