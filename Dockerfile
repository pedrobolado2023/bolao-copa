# ==========================================
# Dockerfile - Arena Bolão
# Deploy no EasyPanel
# ==========================================

# Usar imagem Node.js leve (Alpine)
FROM node:22-alpine

# Diretório de trabalho dentro do container
WORKDIR /app

# Copiar apenas os arquivos de dependências primeiro (cache do Docker)
COPY package*.json ./

# Instalar dependências de produção
RUN npm install --omit=dev

# Copiar todos os arquivos do projeto
COPY . .

# Porta que o servidor escuta (o EasyPanel fará o proxy reverso)
EXPOSE 3000

# Variáveis de ambiente (serão sobrescritas pelo EasyPanel)
ENV NODE_ENV=production
ENV PORT=3000

# Iniciar o servidor
CMD ["node", "server.js"]
