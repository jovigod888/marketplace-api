const jwt = require('jsonwebtoken');
const db = require('../lib/db');
const { HttpError } = require('../lib/helpers');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-trocar-em-producao';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '7d';

const signToken = (user) =>
  jwt.sign({ sub: user.id, role: user.role, email: user.email }, JWT_SECRET, { expiresIn: JWT_EXPIRES });

/** Exige token válido no header Authorization: Bearer <token> */
function authRequired(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(new HttpError(401, 'Token de autenticação ausente'));

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = db.data.users.find((u) => u.id === payload.sub);
    if (!user) return next(new HttpError(401, 'Usuário do token não existe mais'));
    req.user = user;
    next();
  } catch {
    next(new HttpError(401, 'Token inválido ou expirado'));
  }
}

/** Restringe por papel: requireRole('seller', 'admin') */
const requireRole = (...roles) => (req, _res, next) =>
  roles.includes(req.user?.role)
    ? next()
    : next(new HttpError(403, `Acesso restrito a: ${roles.join(', ')}`));

module.exports = { signToken, authRequired, requireRole, JWT_SECRET };
