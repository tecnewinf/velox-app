# Velox PIX + Cloudflare Workers + Mercado Pago (TESTE)

## 1. Arquivos

- `worker.js` — backend Cloudflare Worker.
- `wrangler.jsonc` — configuração do Worker.
- `index.html` — frontend do Velox com a simulação de PIX substituída pela API real.
- `index-original-backup.html` — cópia do index antes da alteração.

## 2. Antes de publicar

No `wrangler.jsonc`, altere:

```text
FRONTEND_ORIGIN
WEBHOOK_URL
TEST_PAYER_EMAIL
```

Exemplo:

```text
FRONTEND_ORIGIN = https://thiagoexemplo.github.io
WEBHOOK_URL = https://velox-pix-api.exemplo.workers.dev
```

`TEST_PAYER_EMAIL` deve ser o e-mail da conta COMPRADORA de teste do Mercado Pago.

## 3. Instalar Wrangler

```bash
npm install -D wrangler
```

ou use:

```bash
npx wrangler login
```

## 4. Access Token de TESTE

No Mercado Pago, abra sua aplicação e vá para:

Suas integrações → Dados da integração → Testes → Credenciais de teste.

Use o Access Token de TESTE.

NÃO coloque o token no `index.html`.

Configure:

```bash
npx wrangler secret put MERCADO_PAGO_ACCESS_TOKEN
```

Cole o Access Token de TESTE quando o Wrangler solicitar.

## 5. Secret do Webhook

No Mercado Pago, abra:

Sua aplicação → Webhooks → Configurar notificação.

Copie a chave secreta gerada para os Webhooks e execute:

```bash
npx wrangler secret put MP_WEBHOOK_SECRET
```

## 6. Publicar

```bash
npx wrangler deploy
```

O Wrangler mostrará a URL do Worker.

Se a URL mudar, atualize `WEBHOOK_URL` no `wrangler.jsonc` e publique novamente.

## 7. Configurar Webhook no Mercado Pago

Configure o evento de pagamentos para:

```text
https://SEU-WORKER.workers.dev/api/webhook/mercadopago
```

Se você usar `WEBHOOK_URL`, o backend também envia `notification_url` na criação do pagamento.

## 8. Testar

Abra:

```text
https://SEU-WORKER.workers.dev/health
```

Deve retornar JSON semelhante a:

```json
{
  "ok": true,
  "service": "Velox PIX API",
  "environment": "test"
}
```

Depois abra o GitHub Pages, calcule uma corrida e clique no PIX.

O QR Code agora vem do Mercado Pago, e não de `gerarPixCode()`.

## 9. Importante sobre o teste

Esta versão usa o Access Token de TESTE do Mercado Pago.

Não troque para credenciais de produção enquanto estiver testando.

Também não considere o preço enviado pelo frontend como seguro para produção. Nesta versão o objetivo é substituir a simulação de PIX e validar o fluxo técnico. Para produção, o backend deverá calcular/validar o valor da corrida e registrar a corrida/pagamento em banco.

## 10. Fluxo

```text
index.html
   |
   | POST /api/pix/create
   v
Cloudflare Worker
   |
   | POST /v1/payments
   v
Mercado Pago
   |
   | qr_code
   v
index.html
   |
   | cliente paga
   v
Mercado Pago
   |
   | Webhook
   v
Cloudflare Worker
   |
   | GET /v1/payments/:id
   v
Mercado Pago
```
