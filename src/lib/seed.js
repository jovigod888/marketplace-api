/** Popula o banco com dados de exemplo: node src/lib/seed.js */
const bcrypt = require('bcryptjs');
const db = require('./db');
const { id, now, money } = require('./helpers');

const hash = (p) => bcrypt.hashSync(p, 10);

const vendedor = { id: id('usr'), name: 'Ana Vendedora', email: 'ana@loja.com', passwordHash: hash('123456'), role: 'seller', createdAt: now() };
const comprador = { id: id('usr'), name: 'Bruno Comprador', email: 'bruno@email.com', passwordHash: hash('123456'), role: 'buyer', createdAt: now() };
const admin = { id: id('usr'), name: 'Admin', email: 'admin@marketplace.com', passwordHash: hash('123456'), role: 'admin', createdAt: now() };

const loja = { id: id('str'), slug: 'tech-store', name: 'Tech Store', description: 'Eletrônicos e acessórios', ownerId: vendedor.id, rating: 4.6, createdAt: now() };

const produtos = [
  ['Teclado Mecânico RGB', 'Switch blue, ABNT2', 349.9, 25, 'perifericos'],
  ['Mouse Gamer 16000 DPI', 'Sensor óptico, 7 botões', 199.9, 40, 'perifericos'],
  ['Monitor 27" 144Hz', 'IPS, 1ms, FreeSync', 1499.0, 8, 'monitores'],
  ['Headset 7.1', 'Som surround e microfone removível', 279.5, 15, 'audio'],
  ['SSD NVMe 1TB', 'Leitura 3500MB/s', 459.0, 30, 'armazenamento'],
].map(([title, description, price, stock, category]) => ({
  id: id('prd'), storeId: loja.id, title, description, price: money(price), stock,
  category, image: null, rating: 0, active: true, createdAt: now(),
}));

db.reset({
  users: [vendedor, comprador, admin],
  stores: [loja],
  products: produtos,
  carts: [{ userId: vendedor.id, items: [] }, { userId: comprador.id, items: [] }, { userId: admin.id, items: [] }],
  orders: [],
  reviews: [],
});

console.log('Seed concluído em', db.DB_PATH);
console.log('Logins (senha 123456): ana@loja.com [seller] | bruno@email.com [buyer] | admin@marketplace.com [admin]');
