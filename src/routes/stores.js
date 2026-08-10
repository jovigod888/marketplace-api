const router = require('express').Router();
const db = require('../lib/db');
const { id, now, HttpError, asyncHandler, validate, paginate } = require('../lib/helpers');
const { authRequired, requireRole } = require('../middleware/auth');

const slugify = (s) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// GET /api/stores
router.get('/', (req, res) => {
  let list = db.data.stores;
  if (req.query.q) {
    const q = req.query.q.toLowerCase();
    list = list.filter((s) => s.name.toLowerCase().includes(q));
  }
  res.json(paginate(list, req.query));
});

// GET /api/stores/:id
router.get('/:id', (req, res) => {
  const store = db.data.stores.find((s) => s.id === req.params.id || s.slug === req.params.id);
  if (!store) throw new HttpError(404, 'Loja não encontrada');
  const products = db.data.products.filter((p) => p.storeId === store.id && p.active);
  res.json({ ...store, productsCount: products.length });
});

// POST /api/stores  (vendedor)
router.post('/', authRequired, requireRole('seller', 'admin'), asyncHandler(async (req, res) => {
  const body = validate(req.body, { name: 'string', description: 'string?' });
  if (db.data.stores.some((s) => s.ownerId === req.user.id)) {
    throw new HttpError(409, 'Este vendedor já possui uma loja');
  }
  const store = {
    id: id('str'),
    slug: slugify(body.name),
    name: body.name.trim(),
    description: body.description || '',
    ownerId: req.user.id,
    rating: 0,
    createdAt: now(),
  };
  db.data.stores.push(store);
  db.save();
  res.status(201).json(store);
}));

// PATCH /api/stores/:id  (dono ou admin)
router.patch('/:id', authRequired, asyncHandler(async (req, res) => {
  const store = db.data.stores.find((s) => s.id === req.params.id);
  if (!store) throw new HttpError(404, 'Loja não encontrada');
  if (store.ownerId !== req.user.id && req.user.role !== 'admin') throw new HttpError(403, 'Você não é dono desta loja');

  const body = validate(req.body, { name: 'string?', description: 'string?' }, { partial: true });
  Object.assign(store, body, { updatedAt: now() });
  if (body.name) store.slug = slugify(body.name);
  db.save();
  res.json(store);
}));

module.exports = router;
