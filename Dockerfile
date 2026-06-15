# TradingEasy - Dockerfile (Electron desktop app dev environment)
FROM node:22-slim

WORKDIR /app

# Install system dependencies for native modules
RUN apt-get update && apt-get install -y \
    python3 make g++ sqlite3 \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY . .

# Dev mode
CMD ["npm", "run", "dev"]
