# Base image pinned by digest: update the tag and digest together (docker buildx imagetools inspect node:<tag>).
# Multi-stage build for production

# Stage 1: Build frontend
FROM node:22.23.3-alpine3.24@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402 AS frontend-builder
ARG APP_VERSION=
WORKDIR /app/frontend
COPY VERSION /app/VERSION
COPY src/frontend/package*.json ./
RUN npm ci --no-audit --no-fund
COPY src/frontend/ ./
ENV VITE_APP_VERSION=$APP_VERSION
RUN npm run build

# Stage 2: Build backend (install dependencies)
FROM node:22.23.3-alpine3.24@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402 AS backend-builder
WORKDIR /app/backend
COPY src/backend/package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund

# Stage 3: Production image
FROM node:22.23.3-alpine3.24@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402
ARG APP_VERSION=
LABEL org.opencontainers.image.version="${APP_VERSION}"
WORKDIR /app

# nginx; Python + Pillow for theme background images (services/themeImage.py);
# su-exec drops root for the Node app (start.sh)
RUN apk add --no-cache nginx python3 py3-pillow su-exec

# Copy backend
COPY --from=backend-builder /app/backend/node_modules ./backend/node_modules
COPY src/backend ./backend
COPY VERSION /app/VERSION

# Copy frontend build
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Copy nginx config
COPY nginx.conf /etc/nginx/nginx.conf

# Expose port
EXPOSE 80

# Start nginx and backend
COPY start.sh ./start.sh
# Strip CR in case the file was checked out with CRLF on Windows.
RUN sed -i 's/\r$//' ./start.sh && chmod +x ./start.sh

# Create nginx directories
RUN mkdir -p /var/log/nginx /var/cache/nginx /run/nginx /app/uploads/avatars /app/uploads/logos \
 && chown -R node:node /app/uploads

ENV APP_VERSION=$APP_VERSION

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1/health || exit 1

CMD ["./start.sh"]
