# Stage 1: Base with Node.js and pnpm, install OS dependencies
FROM node:22-bookworm-slim AS base

# Install necessary libraries for Puppeteer/Chromium on Debian Bookworm
# List adapted from Puppeteer documentation and common needs
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgdk-pixbuf-2.0-0 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    libxrender1 \
    libxtst6 \
    lsb-release \
    wget \
    xdg-utils \
    # Clean up APT cache
    && rm -rf /var/lib/apt/lists/*

# Install pnpm globally
RUN npm install -g pnpm

# Set working directory
WORKDIR /app

# Stage 2: Install dependencies and download browser
FROM base AS deps
WORKDIR /app

# Copy dependency definition files
COPY package.json pnpm-lock.yaml ./

# --- SCHEME 2 CHANGE ---
# Define cache directory INSIDE the app context for easier copying
ENV PUPPETEER_CACHE_DIR=/app/.puppeteer_cache
# Ensure the cache directory exists and has write permissions for root (who runs install)
RUN mkdir -p ${PUPPETEER_CACHE_DIR} && chmod -R 777 ${PUPPETEER_CACHE_DIR}
# --- END SCHEME 2 CHANGE ---

# Install production dependencies only - Puppeteer will download to PUPPETEER_CACHE_DIR
# Do NOT skip download here
RUN pnpm install --frozen-lockfile

# Stage 3: Build the application
FROM base AS builder
WORKDIR /app

# Copy dependency files and installed dependencies from the previous stage
COPY --from=deps /app/node_modules ./node_modules
# --- SCHEME 2 CHANGE ---
# Also copy the downloaded browser cache from the deps stage
COPY --from=deps /app/.puppeteer_cache ./.puppeteer_cache
# --- END SCHEME 2 CHANGE ---
COPY package.json pnpm-lock.yaml ./

# Copy the rest of the application code
COPY . .

# Build the Next.js application
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

# Stage 4: Production image
FROM base AS runner
WORKDIR /app

# Set NODE_ENV to production
ENV NODE_ENV=production
# Disable Next.js telemetry
ENV NEXT_TELEMETRY_DISABLED=1
# --- SCHEME 2 CHANGE ---
# Set the cache directory environment variable for runtime use
ENV PUPPETEER_CACHE_DIR=/app/.puppeteer_cache
# --- END SCHEME 2 CHANGE ---

# Copy built assets using existing node user/group
COPY --from=builder --chown=node:node /app/.next ./.next
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/package.json ./package.json
COPY --from=builder --chown=node:node /app/public ./public
# --- SCHEME 2 CHANGE ---
# Copy the downloaded browser cache from the builder stage and ensure node user owns it
COPY --from=builder --chown=node:node /app/.puppeteer_cache ${PUPPETEER_CACHE_DIR}
# --- END SCHEME 2 CHANGE ---

# cookies.json and .env will be mounted via docker-compose

# Switch to the non-root user
USER node

# Expose the application port
EXPOSE 3000

# Command to run the application
CMD ["pnpm", "start"]