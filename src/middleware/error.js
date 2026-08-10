function notFound(req, _res, next) {
  const err = new Error(`Rota não encontrada: ${req.method} ${req.originalUrl}`);
  err.status = 404;
  next(err);
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, _req, res, _next) {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({
    error: {
      message: status >= 500 ? 'Erro interno do servidor' : err.message,
      details: err.details,
      status,
    },
  });
}

module.exports = { notFound, errorHandler };
