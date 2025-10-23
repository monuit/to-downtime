FROM oven/bun:latest

WORKDIR /app

# Copy package files
COPY package.json bun.lockb* ./

# Install dependencies
RUN bun install

# Copy source code
COPY . .

# Expose dev server port
EXPOSE 5173

# Expose API port (if using standalone server)
EXPOSE 3000

# Default command - start dev server
CMD ["bun", "run", "dev", "--host"]
