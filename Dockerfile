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

# Stage 2: Install dependencies
FROM base AS deps
WORKDIR /app

# Copy dependency definition files
COPY package.json pnpm-lock.yaml ./

# Install production dependencies only
# pnpm will automatically handle downloading the appropriate Chromium version for Puppeteer
RUN pnpm install --frozen-lockfile

# Stage 3: Build the application
FROM base AS builder
WORKDIR /app

# Copy dependency files and installed dependencies from the previous stage
COPY --from=deps /app/node_modules ./node_modules
COPY package.json pnpm-lock.yaml ./

# Copy the rest of the application code
COPY . .

# Build the Next.js application
# Ensure NEXT_TELEMETRY_DISABLED is set to avoid telemetry prompt during build
ENV NEXT_TELEMETRY_DISABLED 1
RUN pnpm build

# Stage 4: Production image
FROM base AS runner
WORKDIR /app

# Set NODE_ENV to production
ENV NODE_ENV production
# Disable Next.js telemetry
ENV NEXT_TELEMETRY_DISABLED 1

# Create a non-root user and group
RUN groupadd --system --gid 1001 node \
    && useradd --system --uid 1001 --gid node node

# Copy built assets and necessary files from the builder stage
COPY --from=builder --chown=node:node /app/.next ./.next
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/package.json ./package.json
# Copy public folder if it exists and has necessary files (like favicon)
COPY --from=builder --chown=node:node /app/public ./public

# cookies.json and .env will be mounted via docker-compose,
# but ensure the directory structure allows mounting if needed later.

# Switch to the non-root user
USER node

# Expose the application port
EXPOSE 3000

# Command to run the application
CMD ["pnpm", "start"]