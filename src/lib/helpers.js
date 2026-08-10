const crypto = require('crypto');

const id = (prefix) => `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
const now = () => new Date().toISOString();

/** Erro HTTP com status, capturado pelo error handler global. */
class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

/** Envolve handlers async para encaminhar rejeições ao next(). */
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** Validação mínima de payload: { campo: 'string'|'number'|'boolean' } */
function validate(body, schema, { partial = false } = {}) {
  const out = {};
  for (const [field, type] of Object.entries(schema)) {
    const optional = type.endsWith('?');
    const t = optional ? type.slice(0, -1) : type;
    const value = body?.[field];

    if (value === undefined || value === null || value === '') {
      if (optional || partial) continue;
      throw new HttpError(400, `Campo obrigatório ausente: "${field}"`);
    }
    if (t === 'number' && typeof value !== 'number') {
      throw new HttpError(400, `Campo "${field}" deve ser número`);
    }
    if (t === 'string' && typeof value !== 'string') {
      throw new HttpError(400, `Campo "${field}" deve ser texto`);
    }
    if (t === 'boolean' && typeof value !== 'boolean') {
      throw new HttpError(400, `Campo "${field}" deve ser booleano`);
    }
    out[field] = value;
  }
  return out;
}

/** Paginação padrão: ?page=1&limit=20 */
function paginate(items, query) {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 20, 1), 100);
  const start = (page - 1) * limit;
  return {
    data: items.slice(start, start + limit),
    meta: { page, limit, total: items.length, pages: Math.ceil(items.length / limit) || 1 },
  };
}

const money = (n) => Math.round(n * 100) / 100;

module.exports = { id, now, HttpError, asyncHandler, validate, paginate, money };
