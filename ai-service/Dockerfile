# HearTalk AI MVP Dockerfile
# Multi-stage build for production optimization

# Build stage
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (including dev dependencies for build)
RUN npm ci --only=production && npm cache clean --force

# Production stage
FROM node:18-alpine AS production

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8001
ENV HOST=0.0.0.0

# Create app user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S heartalk -u 1001

# Set working directory
WORKDIR /app

# Copy node_modules from builder stage
COPY --from=builder --chown=heartalk:nodejs /app/node_modules ./node_modules

# Copy application files
COPY --chown=heartalk:nodejs . .

# Create logs directory
RUN mkdir -p logs && chown heartalk:nodejs logs

# Expose port
EXPOSE 8001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "
    const http = require('http');
    const options = {
      host: 'localhost',
      port: process.env.PORT || 8001,
      path: '/api/v1/health',
      timeout: 2000
    };
    const req = http.request(options, (res) => {
      process.exit(res.statusCode === 200 ? 0 : 1);
    });
    req.on('error', () => process.exit(1));
    req.on('timeout', () => process.exit(1));
    req.end();
  "

# Switch to non-root user
USER heartalk

# Start the application
CMD ["node", "src/index.js"]