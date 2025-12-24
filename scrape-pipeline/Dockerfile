# Development stage
FROM oven/bun:1 AS dev
WORKDIR /app
COPY package.json bun.lock* ./
RUN bun install
CMD ["bun", "--watch", "src/server.ts"]

# Production stage
FROM oven/bun:1 AS production
WORKDIR /app

# Install dependencies
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

# Copy source
COPY . .

# Default command
CMD ["bun", "run", "src/server.ts"]
