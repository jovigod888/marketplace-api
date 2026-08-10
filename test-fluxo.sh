#!/usr/bin/env bash
# Teste end-to-end do fluxo: login -> busca -> carrinho -> checkout -> pagamento -> envio -> avaliação
set -e
API=${API:-http://localhost:3000}
j() { python3 -c "import sys,json;d=json.load(sys.stdin);print(eval(\"d$1\"))"; }

echo "== 1. Login comprador e vendedor =="
BUYER=$(curl -s -X POST $API/api/auth/login -H 'Content-Type: application/json' -d '{"email":"bruno@email.com","password":"123456"}' | j "['token']")
SELLER=$(curl -s -X POST $API/api/auth/login -H 'Content-Type: application/json' -d '{"email":"ana@loja.com","password":"123456"}' | j "['token']")
echo "tokens ok"

echo "== 2. Buscar produtos (filtro + ordenação) =="
PID=$(curl -s "$API/api/products?q=mouse&sort=price" | j "['data'][0]['id']")
curl -s "$API/api/products?q=mouse&sort=price" | j "['data'][0]['title']"

echo "== 3. Adicionar ao carrinho =="
curl -s -X POST $API/api/cart/items -H "Authorization: Bearer $BUYER" -H 'Content-Type: application/json' \
  -d "{\"productId\":\"$PID\",\"quantity\":2}" | j "['total']"

echo "== 3b. Estoque insuficiente (deve dar 409) =="
curl -s -o /dev/null -w "status=%{http_code}\n" -X POST $API/api/cart/items -H "Authorization: Bearer $BUYER" \
  -H 'Content-Type: application/json' -d "{\"productId\":\"$PID\",\"quantity\":9999}"

echo "== 4. Checkout =="
OID=$(curl -s -X POST $API/api/orders/checkout -H "Authorization: Bearer $BUYER" -H 'Content-Type: application/json' \
  -d '{"shippingAddress":"Rua A, 100 - Piraque/TO","paymentMethod":"pix"}' | j "['orders'][0]['id']")
echo "pedido $OID"

echo "== 5. Pagar =="
curl -s -X POST $API/api/orders/$OID/pay -H "Authorization: Bearer $BUYER" | j "['status']"

echo "== 6. Vendedor envia =="
curl -s -X PATCH $API/api/orders/$OID/status -H "Authorization: Bearer $SELLER" -H 'Content-Type: application/json' \
  -d '{"status":"shipped"}' | j "['status']"

echo "== 6b. Transição inválida shipped->paid (deve dar 409) =="
curl -s -o /dev/null -w "status=%{http_code}\n" -X PATCH $API/api/orders/$OID/status -H "Authorization: Bearer $SELLER" \
  -H 'Content-Type: application/json' -d '{"status":"paid"}'

echo "== 7. Entregue + avaliação =="
curl -s -X PATCH $API/api/orders/$OID/status -H "Authorization: Bearer $SELLER" -H 'Content-Type: application/json' \
  -d '{"status":"delivered"}' | j "['status']"
curl -s -X POST $API/api/products/$PID/reviews -H "Authorization: Bearer $BUYER" -H 'Content-Type: application/json' \
  -d '{"rating":5,"comment":"Chegou rapido"}' | j "['rating']"

echo "== 8. Acesso sem token (deve dar 401) =="
curl -s -o /dev/null -w "status=%{http_code}\n" $API/api/cart

echo "== 9. Resumo financeiro do pedido =="
curl -s $API/api/orders/$OID -H "Authorization: Bearer $SELLER" | python3 -c "import sys,json;o=json.load(sys.stdin);print('subtotal',o['subtotal'],'| frete',o['shipping'],'| total',o['total'],'| comissao',o['commission'],'| repasse',o['sellerPayout'])"
echo "OK - fluxo completo"
