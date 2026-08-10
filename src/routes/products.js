const router = require('express').Router();
const db = require('../lib/db');
const { id, now, HttpError, asyncHandler, validate, paginate, money } = require('../lib/helpers');
const { authRequired, requireRole } = require('../middleware/auth');

/**
 * GET /api/products
 * Filtros: ?q=&category=&storeId=&minPrice=&maxPrice=&sort=price|-price|recent&page=&limit=
 */
router.get('/', (req, res) => {
  const { q, category, storeId, minPrice, maxPrice, sort } = req.query;
  let list = db.data.products.filter((p) => p.active);

  if (q) {
    const term = q.toLowerCase();
    list = list.filter((p) => `${p.title} ${p.description}`.toLowerCase().includes(term));
  }
  if (category) list = list.filter((p) => p.category === category);
  if (storeId) list = list.filter((p) => p.storeId === storeId);
  if (minPrice) list = list.filter((p) => p.price >= Number(minPrice));
  if (maxPrice) list = list.filter((p) => p.price <= Number(maxPrice));

  const sorters = {
    price: (a, b) => a.price - b.price,
    '-price': (a, b) => b.price - a.price,
    recent: (a, b) => b.createdAt.localeCompare(a.createdAt),
  };
  list = [...list].sort(sorters[sort] || sorters.recent);

  res.json(paginate(list, req.query));
});

// GET /api/products/:id
router.get('/:id', (req, res) => {
  const product = db.data.products.find((p) => p.id === req.params.id);
  if (!product) throw new HttpError(404, 'Produto não encontrado');
  const store = db.data.stores.find((s) => s.id === product.storeId);
  const reviews = db.data.reviews.filter((r) => r.productId === product.id);
  res.json({ ...product, store: store && { id: store.id, name: store.name, slug: store.slug }, reviews });
});

// POST /api/products  (vendedor dono de loja)
router.post('/', authRequired, requireRole('seller', 'admin'), asyncHandler(async (req, res) => {
  const body = validate(req.body, {
    title: 'string', description: 'string?', price: 'number', stock: 'number', category: 'string?', image: 'string?',
  });
  const store = db.data.stores.find((s) => s.ownerId === req.user.id);
  if (!store) throw new HttpError(400, 'Crie uma loja antes de cadastrar produtos');
  if (body.price <= 0) throw new HttpError(400, 'Preço deve ser maior que zero');
  if (body.stock < 0) throw new HttpError(400, 'Estoque não pode ser negativo');

  const product = {
    id: id('prd'),
    storeId: store.id,
    title: body.title.trim(),
    description: body.description || '',
    price: money(body.price),
    stock: Math.floor(body.stock),
    category: body.category || 'geral',
    image: body.image || null,
    rating: 0,
    active: true,
    createdAt: now(),
  };
  db.data.products.push(product);
  db.save();
  res.status(201).json(product);
}));

function ownProduct(req) {
  const product = db.data.products.find((p) => p.id === req.params.id);
  if (!product) throw new HttpError(404, 'Produto não encontrado');
  const store = db.data.stores.find((s) => s.id === product.storeId);
  if (store.ownerId !== req.user.id && req.user.role !== 'admin') {
    throw new HttpError(403, 'Você não pode alterar produtos de outra loja');
  }
  return product;
}

// PATCH /api/products/:id
router.patch('/:id', authRequired, requireRole('seller', 'admin'), asyncHandler(async (req, res) => {
  const product = ownProduct(req);
  const body = validate(req.body, {
    title: 'string?', description: 'string?', price: 'number?', stock: 'number?',
    category: 'string?', image: 'string?', active: 'boolean?',
  }, { partial: true });
  if (body.price !== undefined) body.price = money(body.price);
  Object.assign(product, body, { updatedAt: now() });
  db.save();
  res.json(product);
}));

// DELETE /api/products/:id  (soft delete)
router.delete('/:id', authRequired, requireRole('seller', 'admin'), asyncHandler(async (req, res) => {
  const product = ownProduct(req);
  product.active = false;
  product.updatedAt = now();
  db.save();
  res.status(204).end();
}));

// POST /api/products/:id/reviews  { rating, comment }
router.post('/:id/reviews', authRequired, asyncHandler(async (req, res) => {
  const product = db.data.products.find((p) => p.id === req.params.id);
  if (!product) throw new HttpError(404, 'Produto não encontrado');

  const body = validate(req.body, { rating: 'number', comment: 'string?' });
  if (body.rating < 1 || body.rating > 5) throw new HttpError(400, 'Nota deve estar entre 1 e 5');

  const comprou = db.data.orders.some(
    (o) => o.buyerId === req.user.id && o.items.some((i) => i.productId === product.id),
  );
  if (!comprou) throw new HttpError(403, 'Só é possível avaliar produtos que você comprou');

  const review = {
    id: id('rev'), productId: product.id, userId: req.user.id, userName: req.user.name,
    rating: body.rating, comment: body.comment || '', createdAt: now(),
  };
  db.data.reviews.push(review);

  const all = db.data.reviews.filter((r) => r.productId === product.id);
  product.rating = money(all.reduce((s, r) => s + r.rating, 0) / all.length);
  db.save();
  res.status(201).json(review);
}));

module.exports = router;
