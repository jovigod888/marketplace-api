const router = require('express').Router();
const db = require('../lib/db');
const { id, now, HttpError, asyncHandler, validate, paginate, money } = require('../lib/helpers');
const { authRequired } = require('../middleware/auth');
const { getCart } = require('./cart');

router.use(authRequired);

const COMMISSION_RATE = Number(process.env.COMMISSION_RATE || 0.10); // taxa do marketplace
const FLUXO = {
  pending_payment: ['paid', 'cancelled'],
  paid: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
};

// POST /api/orders/checkout  { shippingAddress, paymentMethod }
router.post('/checkout', asyncHandler(async (req, res) => {
  const body = validate(req.body, { shippingAddress: 'string', paymentMethod: 'string?' });
  const cart = getCart(req.user.id);
  if (!cart.items.length) throw new HttpError(400, 'Carrinho vazio');

  // 1. Valida estoque antes de qualquer escrita
  const linhas = cart.items.map((i) => {
    const p = db.data.products.find((x) => x.id === i.productId && x.active);
    if (!p) throw new HttpError(409, `Produto indisponível: ${i.productId}`);
    if (i.quantity > p.stock) throw new HttpError(409, `Estoque insuficiente para "${p.title}" (${p.stock} restantes)`);
    return { product: p, quantity: i.quantity };
  });

  // 2. Um pedido por loja (marketplace multi-vendedor)
  const porLoja = new Map();
  for (const l of linhas) {
    if (!porLoja.has(l.product.storeId)) porLoja.set(l.product.storeId, []);
    porLoja.get(l.product.storeId).push(l);
  }

  const criados = [];
  for (const [storeId, itens] of porLoja) {
    const items = itens.map(({ product, quantity }) => ({
      productId: product.id,
      title: product.title,
      unitPrice: product.price,
      quantity,
      subtotal: money(product.price * quantity),
    }));
    const subtotal = money(items.reduce((s, i) => s + i.subtotal, 0));
    const shipping = subtotal >= 199 ? 0 : 19.9;
    const commission = money(subtotal * COMMISSION_RATE);

    const order = {
      id: id('ord'),
      buyerId: req.user.id,
      storeId,
      items,
      subtotal,
      shipping,
      total: money(subtotal + shipping),
      commission,
      sellerPayout: money(subtotal - commission),
      status: 'pending_payment',
      paymentMethod: body.paymentMethod || 'pix',
      shippingAddress: body.shippingAddress,
      history: [{ status: 'pending_payment', at: now() }],
      createdAt: now(),
    };
    db.data.orders.push(order);
    criados.push(order);
  }

  // 3. Baixa de estoque e limpeza do carrinho
  for (const l of linhas) l.product.stock -= l.quantity;
  cart.items = [];
  db.save();

  res.status(201).json({ orders: criados, count: criados.length });
}));

// GET /api/orders  — comprador vê os seus; vendedor vê os da sua loja
router.get('/', (req, res) => {
  const store = db.data.stores.find((s) => s.ownerId === req.user.id);
  let list = db.data.orders.filter(
    (o) => o.buyerId === req.user.id || (store && o.storeId === store.id) || req.user.role === 'admin',
  );
  if (req.query.status) list = list.filter((o) => o.status === req.query.status);
  list = [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json(paginate(list, req.query));
});

function accessOrder(req) {
  const order = db.data.orders.find((o) => o.id === req.params.id);
  if (!order) throw new HttpError(404, 'Pedido não encontrado');
  const store = db.data.stores.find((s) => s.id === order.storeId);
  const permitido =
    order.buyerId === req.user.id || store?.ownerId === req.user.id || req.user.role === 'admin';
  if (!permitido) throw new HttpError(403, 'Sem acesso a este pedido');
  return { order, store };
}

// GET /api/orders/:id
router.get('/:id', (req, res) => res.json(accessOrder(req).order));

// POST /api/orders/:id/pay  — simulação de gateway de pagamento
router.post('/:id/pay', asyncHandler(async (req, res) => {
  const { order } = accessOrder(req);
  if (order.buyerId !== req.user.id) throw new HttpError(403, 'Apenas o comprador pode pagar');
  if (order.status !== 'pending_payment') throw new HttpError(409, `Pedido já está em "${order.status}"`);

  order.status = 'paid';
  order.paidAt = now();
  order.paymentId = id('pay');
  order.history.push({ status: 'paid', at: order.paidAt });
  db.save();
  res.json(order);
}));

// PATCH /api/orders/:id/status  { status }  — vendedor/admin
router.patch('/:id/status', asyncHandler(async (req, res) => {
  const { order, store } = accessOrder(req);
  if (store?.ownerId !== req.user.id && req.user.role !== 'admin') {
    throw new HttpError(403, 'Apenas o vendedor pode alterar o status');
  }
  const { status } = validate(req.body, { status: 'string' });
  if (!FLUXO[order.status].includes(status)) {
    throw new HttpError(409, `Transição inválida: ${order.status} → ${status}`);
  }
  order.status = status;
  order.history.push({ status, at: now() });
  db.save();
  res.json(order);
}));

// POST /api/orders/:id/cancel — comprador ou vendedor, antes do envio
router.post('/:id/cancel', asyncHandler(async (req, res) => {
  const { order } = accessOrder(req);
  if (!FLUXO[order.status].includes('cancelled')) {
    throw new HttpError(409, `Pedido em "${order.status}" não pode ser cancelado`);
  }
  for (const item of order.items) {
    const p = db.data.products.find((x) => x.id === item.productId);
    if (p) p.stock += item.quantity; // devolve estoque
  }
  order.status = 'cancelled';
  order.history.push({ status: 'cancelled', at: now(), by: req.user.id });
  db.save();
  res.json(order);
}));

module.exports = router;
