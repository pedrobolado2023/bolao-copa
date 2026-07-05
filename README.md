# Arena Bolão - Deploy no EasyPanel

## 📁 Estrutura de Arquivos

```
bolao-copa/
├── index.html        # Front-end principal
├── style.css         # Estilos (tema escuro glassmorphism)
├── app.js            # Lógica do bolão (front-end)
├── server.js         # Backend Node.js/Express
├── package.json      # Dependências Node.js
├── Dockerfile        # Configuração Docker para EasyPanel
├── .dockerignore     # Arquivos ignorados no build
└── README.md         # Este arquivo
```

---

## 🚀 Deploy no EasyPanel

### 1. Subir os arquivos no GitHub
Crie um repositório no GitHub e suba todos os arquivos do projeto.

### 2. Criar o serviço no EasyPanel

1. Acesse seu painel do **EasyPanel**
2. Clique em **"Create Service"** → **"App"**
3. Escolha **"GitHub"** como fonte
4. Selecione o repositório do bolão
5. O EasyPanel vai detectar o `Dockerfile` automaticamente

### 3. Configurar o Domínio

1. Na aba **"Domains"** do serviço
2. Adicione o domínio: `bolao.q-aura.com.br`
3. Ative o **HTTPS** (SSL automático)

### 4. Configurar Variáveis de Ambiente

Na aba **"Environment"** do serviço no EasyPanel, adicione:

| Nome | Valor |
|------|-------|
| `PORT` | `3000` |
| `NODE_ENV` | `production` |
| `MP_ACCESS_TOKEN` | `seu_access_token_de_producao` |
| `MP_PUBLIC_KEY` | `sua_public_key` |
| `APP_DOMAIN` | `bolao.q-aura.com.br` |

> ⚠️ **Nunca commite credenciais no GitHub!** Sempre use variáveis de ambiente no EasyPanel.

### 5. Fazer o Deploy

1. Clique em **"Deploy"**
2. Aguarde o build do Docker (~1-2 minutos)
3. Acesse `https://bolao.q-aura.com.br`

---

## 🔔 Configurar Webhook do Mercado Pago

Para que o sistema receba confirmações automáticas de pagamento:

1. Acesse: https://www.mercadopago.com.br/developers/panel/app
2. Selecione sua aplicação
3. Vá em **"Webhooks"** → **"Configurar notificações"**
4. Adicione a URL:
   ```
   https://bolao.q-aura.com.br/api/webhook/mercadopago
   ```
5. Marque o evento: ✅ **Pagamentos**
6. Salve

---

## 🔑 Como usar o Sistema

### Senha Admin
```
admin123
```

### Modo Simulador (padrão — para testes)
- Não faz chamadas reais ao Mercado Pago
- Aprovar pagamento manualmente clicando em "Simular Pagamento"

### Modo Produção (PIX real)
1. Abrir painel Admin (senha: `admin123`)
2. Ir em **"Configurações de Pagamento"**
3. **Desmarcar** "Modo Simulador (Testes)"
4. Clicar **"Salvar"**

---

## 🏗️ Arquitetura

```
Navegador (bolao.q-aura.com.br)
    │
    ├── GET  /                            → index.html (front-end)
    ├── POST /api/pix/create              → Cria PIX no Mercado Pago
    ├── GET  /api/pix/status/:id          → Consulta status do pagamento
    ├── POST /api/webhook/mercadopago     → Recebe notificações do MP
    └── GET  /health                      → Health check
```

---

## 🛠️ Rodando Localmente (desenvolvimento)

```bash
# Instalar dependências
npm install

# Iniciar servidor
node server.js

# Acessar em:
# http://localhost:3000
```
