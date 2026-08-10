const router = require('express').Router();
const bcrypt = require('bcryptjs');
const db = require('../lib/db');
const { id, now, HttpError, asyncHandler, validate } = require('../lib/helpers');
const { signToken, authRequired } = require('../middleware/auth');

const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, createdAt: u.createdAt });

// POST /api/auth/register  { name, email, password, role? }
router.post('/register', asyncHandler(async (req, res) => {
  const body = validate(req.body, { name: 'string', email: 'string', password: 'string', role: 'string?' });
  const email = body.email.toLowerCase().trim();

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new HttpError(400, 'E-mail inválido');
  if (body.password.length < 6) throw new HttpError(400, 'Senha deve ter ao menos 6 caracteres');
  if (db.data.users.some((u) => u.email === email)) throw new HttpError(409, 'E-mail já cadastrado');

  const role = ['buyer', 'seller', 'admin'].includes(body.role) ? body.role : 'buyer';
  const user = {
    id: id('usr'),
    name: body.name.trim(),
    email,
    passwordHash: await bcrypt.hash(body.password, 10),
    role,
    createdAt: now(),
  };
  db.data.users.push(user);
  db.data.carts.push({ userId: user.id, items: [] });
  db.save();

  res.status(201).json({ user: publicUser(user), token: signToken(user) });
}));

// POST /api/auth/login  { email, password }
router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = validate(req.body, { email: 'string', password: 'string' });
  const user = db.data.users.find((u) => u.email === email.toLowerCase().trim());
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new HttpError(401, 'Credenciais inválidas');
  }
  res.json({ user: publicUser(user), token: signToken(user) });
}));

// GET /api/auth/me
router.get('/me', authRequired, (req, res) => res.json({ user: publicUser(req.user) }));

module.exports = router;
module.exports.publicUser = publicUser;
