/**
 * Persistência simples em arquivo JSON (suficiente para protótipo).
 * Trocar por Postgres/Prisma depois sem mudar as rotas: basta manter a API deste módulo.
 */
const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', '..', 'data.json');

const EMPTY = {
  users: [],
  stores: [],
  products: [],
  carts: [],   // { userId, items: [{ productId, quantity }] }
  orders: [],
  reviews: [],
};

function load() {
  if (!fs.existsSync(DB_PATH)) return structuredClone(EMPTY);
  try {
    return { ...structuredClone(EMPTY), ...JSON.parse(fs.readFileSync(DB_PATH, 'utf8')) };
  } catch {
    return structuredClone(EMPTY);
  }
}

let state = load();

function save() {
  fs.writeFileSync(DB_PATH, JSON.stringify(state, null, 2));
}

function reset(seedState = EMPTY) {
  state = { ...structuredClone(EMPTY), ...structuredClone(seedState) };
  save();
}

const db = {
  get data() {
    return state;
  },
  save,
  reset,
  DB_PATH,
};

module.exports = db;
