const router = require('express').Router();
const db = require('../lib/db');
const { HttpError, asyncHandler, validate, money } = require('../lib/helpers');
const { authRequired } = require('../middleware/auth');

router.use(authRequired);

function getCart(userId) {
  let cart = db.data.carts.find((c) => c.userId === userId);
  if (!cart) {
    cart = { userId, items: [] };
    db.data.carts.push(cart);
  }
  return cart;
}

/** Monta o carrinho com dados do produto e totais. */
function expand(cart) {
  const items = cart.items
    .map((i) => {
      const p = db.data.products.find((x) => x.id === i.productId);
      if (!p) return null;
      return {
        productId: p.id,
        title: p.title,
        unitPrice: p.price,
        quantity: i.quantity,
        subtotal: money(p.price * i.quantity),
        stock: p.stock,
      };
    })
    .filter(Boolean);
  return { items, total: money(items.reduce((s, i) => s + i.subtotal, 0)), itemsCount: items.length };
}

// GET /api/cart
router.get('/', (req, res) => res.json(expand(getCart(req.user.id))));

// POST /api/cart/items  { productId, quantity }
router.post('/items', asyncHandler(async (req, res) => {
  const { productId, quantity } = validate(req.body, { productId: 'string', quantity: 'number' });
  if (quantity < 1) throw new HttpError(400, 'Quantidade deve ser ao menos 1');

  const product = db.data.products.find((p) => p.id === productId && p.active);
  if (!product) throw new HttpError(404, 'Produto não encontrado');

  const cart = getCart(req.user.id);
  const existing = cart.items.find((i) => i.productId === productId);
  const total = (existing?.quantity || 0) + Math.floor(quantity);
  if (total > product.stock) throw new HttpError(409, `Estoque insuficiente (disponível: ${product.stock})`);

  if (existing) existing.quantity = total;
  else cart.items.push({ productId, quantity: Math.floor(quantity) });

  db.save();
  res.status(201).json(expand(cart));
}));

// PATCH /api/cart/items/:productId  { quantity }
router.patch('/items/:productId', asyncHandler(async (req, res) => {
  const { quantity } = validate(req.body, { quantity: 'number' });
  const cart = getCart(req.user.id);
  const item = cart.items.find((i) => i.productId === req.params.productId);
  if (!item) throw new HttpError(404, 'Item não está no carrinho');

  const product = db.data.products.find((p) => p.id === item.productId);
  if (quantity < 1) cart.items = cart.items.filter((i) => i !== item);
  else if (quantity > product.stock) throw new HttpError(409, `Estoque insuficiente (disponível: ${product.stock})`);
  else item.quantity = Math.floor(quantity);

  db.save();
  res.json(expand(cart));
}));

// DELETE /api/cart/items/:productId
router.delete('/items/:productId', asyncHandler(async (req, res) => {
  const cart = getCart(req.user.id);
  cart.items = cart.items.filter((i) => i.productId !== req.params.productId);
  db.save();
  res.json(expand(cart));
}));

// DELETE /api/cart
router.delete('/', (req, res) => {
  const cart = getCart(req.user.id);
  cart.items = [];
  db.save();
  res.json(expand(cart));
});

module.exports = router;
module.exports.getCart = getCart;
module.exports.expand = expand;
