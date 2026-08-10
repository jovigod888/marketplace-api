const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const { notFound, errorHandler } = require('./middleware/error');

const app = express();

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));

// Rate limit simples em memória (protótipo): 300 req/min por IP
const hits = new Map();
app.use((req, res, next) => {
  const key = req.ip;
  const janela = Math.floor(Date.now() / 60000);
  const registro = hits.get(key);
  if (!registro || registro.janela !== janela) hits.set(key, { janela, count: 1 });
  else if (++registro.count > 300) return res.status(429).json({ error: { message: 'Muitas requisições', status: 429 } });
  next();
});

app.get('/health', (_req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

app.get('/api', (_req, res) => res.json({
  name: 'Marketplace API',
  version: '1.0.0',
  endpoints: {
    auth: ['POST /api/auth/register', 'POST /api/auth/login', 'GET /api/auth/me'],
    stores: ['GET /api/stores', 'GET /api/stores/:id', 'POST /api/stores', 'PATCH /api/stores/:id'],
    products: [
      'GET /api/products?q=&category=&storeId=&minPrice=&maxPrice=&sort=&page=&limit=',
      'GET /api/products/:id', 'POST /api/products', 'PATCH /api/products/:id',
      'DELETE /api/products/:id', 'POST /api/products/:id/reviews',
    ],
    cart: ['GET /api/cart', 'POST /api/cart/items', 'PATCH /api/cart/items/:productId',
      'DELETE /api/cart/items/:productId', 'DELETE /api/cart'],
    orders: ['POST /api/orders/checkout', 'GET /api/orders', 'GET /api/orders/:id',
      'POST /api/orders/:id/pay', 'PATCH /api/orders/:id/status', 'POST /api/orders/:id/cancel'],
  },
}));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/stores', require('./routes/stores'));
app.use('/api/products', require('./routes/products'));
app.use('/api/cart', require('./routes/cart'));
app.use('/api/orders', require('./routes/orders'));

app.use(notFound);
app.use(errorHandler);

module.exports = app;
