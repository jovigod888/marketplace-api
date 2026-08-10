# Marketplace API — protótipo (Node.js + Express)

Backend de marketplace multi-vendedor: autenticação JWT, lojas, catálogo, carrinho, checkout com split de comissão, ciclo de vida de pedidos e avaliações.

## Como rodar

```bash
npm install
npm run seed     # popula dados de exemplo
npm start        # http://localhost:3000
```

Documentação das rotas em tempo real: `GET http://localhost:3000/api`
Healthcheck: `GET /health`

Teste end-to-end do fluxo completo:

```bash
./test-fluxo.sh
```

### Usuários de exemplo (senha `123456`)

| E-mail | Papel |
|---|---|
| ana@loja.com | seller (dona da Tech Store) |
| bruno@email.com | buyer |
| admin@marketplace.com | admin |

## Endpoints

### Auth
| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/auth/register` | `{ name, email, password, role? }` → usuário + token |
| POST | `/api/auth/login` | `{ email, password }` → usuário + token |
| GET | `/api/auth/me` | Dados do usuário autenticado |

Envie o token em `Authorization: Bearer <token>`.

### Lojas
| Método | Rota | Acesso |
|---|---|---|
| GET | `/api/stores?q=` | público |
| GET | `/api/stores/:id` | público (aceita id ou slug) |
| POST | `/api/stores` | seller (1 loja por vendedor) |
| PATCH | `/api/stores/:id` | dono ou admin |

### Produtos
| Método | Rota | Acesso |
|---|---|---|
| GET | `/api/products` | público — filtros `q`, `category`, `storeId`, `minPrice`, `maxPrice`, `sort=price\|-price\|recent`, `page`, `limit` |
| GET | `/api/products/:id` | público — inclui loja e avaliações |
| POST | `/api/products` | seller com loja |
| PATCH | `/api/products/:id` | dono do produto |
| DELETE | `/api/products/:id` | dono (soft delete: `active=false`) |
| POST | `/api/products/:id/reviews` | comprador que já comprou o item |

### Carrinho (autenticado)
`GET /api/cart` · `POST /api/cart/items` · `PATCH /api/cart/items/:productId` · `DELETE /api/cart/items/:productId` · `DELETE /api/cart`

Valida estoque na adição e na alteração de quantidade; retorna sempre o carrinho expandido com subtotais e total.

### Pedidos (autenticado)
| Método | Rota | Regra |
|---|---|---|
| POST | `/api/orders/checkout` | `{ shippingAddress, paymentMethod? }` — valida estoque, **divide um pedido por loja**, calcula comissão e repasse, baixa estoque e limpa o carrinho |
| GET | `/api/orders?status=` | comprador vê os seus, vendedor vê os da loja |
| GET | `/api/orders/:id` | comprador, vendedor ou admin |
| POST | `/api/orders/:id/pay` | simula gateway → `paid` |
| PATCH | `/api/orders/:id/status` | vendedor avança o status |
| POST | `/api/orders/:id/cancel` | cancela e devolve estoque |

Máquina de estados: `pending_payment → paid → shipped → delivered`, com `cancelled` possível até `paid`. Transições fora do fluxo retornam **409**.

Regras financeiras: comissão do marketplace de 10% (`COMMISSION_RATE`), frete fixo R$ 19,90 e grátis acima de R$ 199, `sellerPayout = subtotal - comissão`.

## Estrutura

```
src/
  server.js            # bootstrap HTTP
  app.js               # middlewares, rate limit, montagem das rotas
  lib/db.js            # persistência JSON (trocável por Postgres/Prisma)
  lib/helpers.js       # HttpError, validate, paginate, ids
  lib/seed.js          # dados de exemplo
  middleware/auth.js   # JWT + requireRole
  middleware/error.js  # 404 e handler global
  routes/              # auth, stores, products, cart, orders
```

## Variáveis de ambiente

| Variável | Padrão |
|---|---|
| `PORT` | 3000 |
| `JWT_SECRET` | dev-secret-trocar-em-producao |
| `JWT_EXPIRES` | 7d |
| `COMMISSION_RATE` | 0.10 |
| `DB_PATH` | ./data.json |

## Próximos passos sugeridos

1. Trocar `lib/db.js` por Postgres + Prisma (as rotas não mudam).
2. Gateway real (Stripe/Mercado Pago) com webhook em vez de `/pay`.
3. Upload de imagens (S3/Cloudinary) e refresh tokens.
4. Testes automatizados (Jest + Supertest) e OpenAPI/Swagger.
5. Frontend consumindo esta API.
