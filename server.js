/**
 * Arena Bolão - Backend Server
 * Servidor Node.js/Express que faz o proxy das chamadas para a API do Mercado Pago.
 * O Access Token NUNCA fica exposto no front-end.
 *
 * Para iniciar:
 *   npm install
 *   node server.js
 *
 * Em produção (bolao.q-aura.com.br), configure MP_ACCESS_TOKEN como variável de ambiente.
 */

const express = require("express");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================
// CONFIGURAÇÕES
// ==========================================

// Supabase Connection Settings
const SUPABASE_URL = process.env.SUPABASE_URL || "https://xftllvnwnkgecjfsppsd.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhmdGxsdm53bmtnZWNqZnNwcHNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5ODcxMTUsImV4cCI6MjA5MzU2MzExNX0.VHV8OvLQvpZyS_fY16NuoNUtwc9FQH8M3KikvQk2dYU";

let supabase = null;
if (SUPABASE_URL && SUPABASE_KEY) {
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log("[INFO] Supabase client initialized successfully!");
  } catch (err) {
    console.error("[ERRO] Falha ao inicializar o cliente do Supabase:", err.message);
  }
} else {
  console.warn("[AVISO] SUPABASE_URL ou SUPABASE_KEY não configurados. Integração com Supabase desativada.");
}

// O token fica APENAS no servidor — nunca exposto ao navegador.
// Configure via variável de ambiente no EasyPanel:
//   Nome: MP_ACCESS_TOKEN
//   Valor: seu_access_token_de_produção_aqui
const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN || "";

if (!MP_ACCESS_TOKEN) {
  console.warn("[AVISO] MP_ACCESS_TOKEN não configurado! Defina a variável de ambiente.");
}

// Public Key (opcional, para uso no front-end se necessário)
const MP_PUBLIC_KEY = process.env.MP_PUBLIC_KEY || "";

const MP_API_BASE = "https://api.mercadopago.com";

// Domínio de produção (usado apenas para logs)
const PRODUCTION_DOMAIN = process.env.APP_DOMAIN || "bolao.q-aura.com.br";

// ==========================================
// MIDDLEWARES
// ==========================================

// Aceitar requisições de qualquer origem (o front-end local e o servidor de produção)
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());

// Serve os arquivos estáticos do front-end (index.html, app.js, style.css)
app.use(express.static(path.join(__dirname)));

// ==========================================
// ROTAS DA API
// ==========================================

/**
 * POST /api/pix/create
 * Cria um pagamento PIX no Mercado Pago.
 *
 * Body esperado:
 * {
 *   "name": "Nome do Participante",
 *   "email": "email@exemplo.com",
 *   "amount": 15.00,
 *   "description": "Bolão Copa 2026 - 3 palpites"
 * }
 *
 * Resposta:
 * {
 *   "success": true,
 *   "paymentId": "1234567890",
 *   "qrCode": "00020126...",
 *   "qrCodeBase64": "iVBORw0K...",
 *   "status": "pending"
 * }
 */
app.post("/api/pix/create", async (req, res) => {
  try {
    const { name, email, whatsapp, amount, description, bets } = req.body;

    // Validações básicas
    if (!name || !email || !amount) {
      return res.status(400).json({
        success: false,
        error: "Parâmetros obrigatórios: name, email, amount",
      });
    }

    if (typeof amount !== "number" || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: "O valor deve ser um número positivo",
      });
    }

    const idempotencyKey = uuidv4();

    const payload = {
      transaction_amount: parseFloat(amount.toFixed(2)),
      payment_method_id: "pix",
      description: description || `Bolão da Copa 2026 - ${name}`,
      payer: {
        email: email,
        first_name: name.split(" ")[0] || name,
        last_name: name.split(" ").slice(1).join(" ") || "Participante",
        identification: {
          type: "CPF",
          // CPF genérico para testes — em produção, solicitar o CPF real ao participante
          number: "00000000000",
        },
      },
    };

    console.log(
      `[${new Date().toISOString()}] Criando pagamento PIX para ${email} - R$ ${amount.toFixed(2)}`
    );

    // Chamada real à API do Mercado Pago (feita do servidor, sem CORS)
    const mpResponse = await fetch(`${MP_API_BASE}/v1/payments`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": idempotencyKey,
        "User-Agent": "ArenaBolao/1.0",
      },
      body: JSON.stringify(payload),
    });

    const mpData = await mpResponse.json();

    if (!mpResponse.ok) {
      console.error(
        `[ERRO MP] Status: ${mpResponse.status}`,
        JSON.stringify(mpData)
      );
      return res.status(mpResponse.status).json({
        success: false,
        error: mpData.message || "Erro ao criar pagamento no Mercado Pago",
        details: mpData,
      });
    }

    // Extrair os dados do PIX
    const txData = mpData.point_of_interaction?.transaction_data;
    if (!txData) {
      return res.status(500).json({
        success: false,
        error:
          "Resposta inválida da API do Mercado Pago: dados PIX não encontrados",
      });
    }

    console.log(
      `[OK] Pagamento PIX criado: ID ${mpData.id} | Status: ${mpData.status}`
    );

    // Salvar no Supabase
    if (supabase) {
      try {
        const { error: partErr } = await supabase
          .from("bolao_participantes")
          .insert({
            name: name,
            whatsapp: whatsapp || "",
            email: email,
            payment_id: String(mpData.id),
            payment_status: mpData.status,
            amount: parseFloat(amount.toFixed(2))
          });

        if (partErr) {
          console.error("[SUPABASE ERRO PARTICIPANTE]", partErr.message);
        } else if (bets && Array.isArray(bets)) {
          const palpitesPayload = bets.map(b => ({
            payment_id: String(mpData.id),
            participant_name: name,
            game_id: b.gameId,
            bet_score_a: parseInt(b.betScoreA) || 0,
            bet_score_b: parseInt(b.betScoreB) || 0
          }));

          const { error: palpitesErr } = await supabase
            .from("bolao_palpites")
            .insert(palpitesPayload);

          if (palpitesErr) {
            console.error("[SUPABASE ERRO PALPITES]", palpitesErr.message);
          }
        }
      } catch (dbErr) {
        console.error("[SUPABASE ERRO CONEXAO]", dbErr.message);
      }
    }

    res.json({
      success: true,
      paymentId: String(mpData.id),
      qrCode: txData.qr_code,
      qrCodeBase64: txData.qr_code_base64,
      status: mpData.status,
      expiresAt: mpData.date_of_expiration,
    });
  } catch (error) {
    console.error("[ERRO SERVIDOR]", error.message);
    res.status(500).json({
      success: false,
      error: `Erro interno do servidor: ${error.message}`,
    });
  }
});

/**
 * GET /api/pix/status/:paymentId
 * Consulta o status de um pagamento PIX.
 *
 * Resposta:
 * {
 *   "success": true,
 *   "paymentId": "1234567890",
 *   "status": "approved" | "pending" | "rejected" | "cancelled"
 * }
 */
app.get("/api/pix/status/:paymentId", async (req, res) => {
  try {
    const { paymentId } = req.params;

    if (!paymentId || paymentId === "undefined") {
      return res.status(400).json({
        success: false,
        error: "paymentId inválido",
      });
    }

    const mpResponse = await fetch(`${MP_API_BASE}/v1/payments/${paymentId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
        "User-Agent": "ArenaBolao/1.0",
      },
    });

    const mpData = await mpResponse.json();

    if (!mpResponse.ok) {
      return res.status(mpResponse.status).json({
        success: false,
        error: "Erro ao consultar status do pagamento",
        details: mpData,
      });
    }

    // Sync status with Supabase
    await updateSupabasePaymentStatus(mpData.id, mpData.status);

    res.json({
      success: true,
      paymentId: String(mpData.id),
      status: mpData.status,
      statusDetail: mpData.status_detail,
    });
  } catch (error) {
    console.error("[ERRO SERVIDOR]", error.message);
    res.status(500).json({
      success: false,
      error: `Erro interno do servidor: ${error.message}`,
    });
  }
});

/**
 * POST /api/webhook/mercadopago
 * Recebe notificações de pagamento aprovado do Mercado Pago (IPN/Webhook).
 * Configure este endpoint no painel do Mercado Pago:
 * https://www.mercadopago.com.br/developers/panel/app
 */
app.post("/api/webhook/mercadopago", async (req, res) => {
  const { type, data } = req.body;
  console.log(
    `[WEBHOOK] Notificação recebida - Tipo: ${type} | ID: ${data?.id}`
  );

  // Sempre responder 200 imediatamente para o MP não reenviar
  res.status(200).send("OK");

  // Processar em background (não bloqueia a resposta)
  if (type === "payment" && data?.id) {
    try {
      const mpResponse = await fetch(
        `${MP_API_BASE}/v1/payments/${data.id}`,
        {
          headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
        }
      );
      const payment = await mpResponse.json();
      console.log(
        `[WEBHOOK] Pagamento ${data.id} - Status: ${payment.status} - Valor: R$ ${payment.transaction_amount}`
      );
      
      // Atualizar no Supabase
      await updateSupabasePaymentStatus(payment.id, payment.status);
    } catch (err) {
      console.error("[WEBHOOK ERRO]", err.message);
    }
  }
});

/**
 * Função auxiliar para atualizar o status do pagamento no Supabase
 */
async function updateSupabasePaymentStatus(paymentId, status) {
  if (!supabase) return;
  try {
    const { error } = await supabase
      .from("bolao_participantes")
      .update({ payment_status: status })
      .eq("payment_id", String(paymentId));

    if (error) {
      console.error(`[SUPABASE ERRO UPDATE STATUS] ID: ${paymentId} | Error:`, error.message);
    } else {
      console.log(`[SUPABASE OK] Status do pagamento ${paymentId} atualizado para: ${status}`);
    }
  } catch (err) {
    console.error("[SUPABASE ERRO UPDATE CONEXAO]", err.message);
  }
}

/**
 * GET /health
 * Endpoint de health check para monitoramento.
 */
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "Arena Bolão Backend",
  });
});

// Fallback: qualquer rota não encontrada devolve o index.html (SPA)
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// ==========================================
// INICIALIZAÇÃO
// ==========================================
app.listen(PORT, () => {
  const isProduction = process.env.NODE_ENV === "production";
  console.log(`
╔════════════════════════════════════════╗
║       Arena Bolão - Backend Server     ║
╠════════════════════════════════════════╣
║  Ambiente : ${isProduction ? "PRODUÇÃO" : "desenvolvimento"  }         ║
║  URL      : ${isProduction ? `https://${PRODUCTION_DOMAIN}` : `http://localhost:${PORT}`}  ║
║  Porta    : ${PORT}                                  ║
║                                        ║
║  Endpoints:                            ║
║    POST /api/pix/create                ║
║    GET  /api/pix/status/:id            ║
║    POST /api/webhook/mercadopago       ║
║    GET  /health                        ║
╚════════════════════════════════════════╝
  `);

  if (isProduction) {
    console.log(`[INFO] Webhook do Mercado Pago: https://${PRODUCTION_DOMAIN}/api/webhook/mercadopago`);
    console.log(`[INFO] Configure este URL no painel: https://www.mercadopago.com.br/developers/panel`);
  }
});
