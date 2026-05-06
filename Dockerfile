# ── Stage 1: Build React frontend ────────────────────────────
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install --include=dev

COPY frontend/ .
RUN npm run build

# ── Stage 2: Production backend ───────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

# Install backend dependencies
COPY backend/package*.json ./backend/
RUN cd backend && npm install --omit=dev

# Copy backend source
COPY backend/ ./backend/

# Copy built frontend dist from Stage 1
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Copy database migrations
COPY database/ ./database/

# Non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 3001

ENV NODE_ENV=production

CMD ["node", "backend/server.js"]
