# ==========================================
# 🐳 Production Dockerfile for Netflix4U
# ==========================================
FROM node:20-alpine AS runner

WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV PORT=4173

# Copy application files
COPY package.json ./
COPY server.js dev-server.js ./
COPY services/ ./services/
COPY data/ ./data/
COPY js/ ./js/
COPY assets/ ./assets/
COPY css/ ./css/
COPY images/ ./images/
COPY fonts/ ./fonts/
COPY uploads/ ./uploads/
COPY index.html favicon.ico robots.txt sitemap.xml ./

# Create non-root user for maximum container security
RUN addgroup -S netflix4u && adduser -S netflix4u -G netflix4u \
    && chown -R netflix4u:netflix4u /app

USER netflix4u

EXPOSE 4173

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4173/api/summary || exit 1

CMD ["node", "server.js"]
