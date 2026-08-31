export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Cabeçalhos CORS para permitir requisições do index.html
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // ============================================================
      // 1. ENDPOINT: POST /api/pix/create
      // ============================================================
      if (url.pathname === '/api/pix/create' && request.method === 'POST') {
        const body = await request.json();
        const { amount, description } = body;

        const mpPayload = {
          transaction_amount: Number(amount),
          description: description || 'Corrida Velox',
          payment_method_id: 'pix',
          payer: {
            email: 'passageiro@veloxapp.com.br',
            first_name: 'Passageiro',
            last_name: 'Velox'
          },
          notification_url: `${url.origin}/api/pix/webhook`
        };

        const mpResponse = await fetch('https://api.mercadopago.com/v1/payments', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.MERCADO_PAGO_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
            'X-Idempotency-Key': crypto.randomUUID()
          },
          body: JSON.stringify(mpPayload)
        });

        const mpData = await mpResponse.json();

        if (!mpResponse.ok) {
          return new Response(JSON.stringify({
            success: false,
            error: mpData.message || 'Erro ao comunicar com Mercado Pago'
          }), {
            status: mpResponse.status,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const qrCode = mpData.point_of_interaction?.transaction_data?.qr_code;
        const qrCodeBase64 = mpData.point_of_interaction?.transaction_data?.qr_code_base64;

        return new Response(JSON.stringify({
          success: true,
          payment_id: mpData.id,
          status: mpData.status,
          qr_code: qrCode,
          qr_code_base64: qrCodeBase64
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // ============================================================
      // 2. ENDPOINT: POST /api/pix/webhook (Recebe notificação do MP)
      // ============================================================
      if (url.pathname === '/api/pix/webhook' && request.method === 'POST') {
        const body = await request.json();
        const paymentId = body.data?.id || body.id;

        if (paymentId) {
          // Consulta o status real no Mercado Pago para garantir autenticidade (/v1/payments/:id)
          const mpCheck = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
            headers: {
              'Authorization': `Bearer ${env.MERCADO_PAGO_ACCESS_TOKEN}`
            }
          });

          if (mpCheck.ok) {
            const paymentData = await mpCheck.json();
            
            // Armazena no Cloudflare KV (se configurado um KV namespace `PIX_KV`)
            if (env.PIX_KV) {
              await env.PIX_KV.put(`payment:${paymentId}`, paymentData.status, { expirationTtl: 3600 });
            }
          }
        }

        return new Response('OK', { status: 200, headers: corsHeaders });
      }

      // ============================================================
      // 3. ENDPOINT: GET /api/pix/status/:id (Polling do frontend)
      // ============================================================
      if (url.pathname.startsWith('/api/pix/status/') && request.method === 'GET') {
        const paymentId = url.pathname.split('/')[4];

        if (!paymentId) {
          return new Response(JSON.stringify({ error: 'ID de pagamento não informado' }), {
            status: 400,
            headers: corsHeaders
          });
        }

        let status = null;

        // Tenta buscar primeiro no KV
        if (env.PIX_KV) {
          status = await env.PIX_KV.get(`payment:${paymentId}`);
        }

        // Se não encontrar no KV, faz a consulta direta no Mercado Pago
        if (!status) {
          const mpCheck = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
            headers: {
              'Authorization': `Bearer ${env.MERCADO_PAGO_ACCESS_TOKEN}`
            }
          });

          if (mpCheck.ok) {
            const paymentData = await mpCheck.json();
            status = paymentData.status;
          }
        }

        return new Response(JSON.stringify({ status: status || 'pending' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response('Rota não encontrada', { status: 404, headers: corsHeaders });

    } catch (error) {
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};