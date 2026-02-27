# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# VITE_API_URL и VITE_CHAT_BASE_URL пробрасываются через build args
ARG VITE_CHAT_BASE_URL=http://localhost/?subdomain={subdomain}
ENV VITE_CHAT_BASE_URL=$VITE_CHAT_BASE_URL

RUN npm run build

# ── Stage 2: Serve ────────────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runtime

# Конфиг nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Статика из builder
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
