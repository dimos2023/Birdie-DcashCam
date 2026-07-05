FROM node:20-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY tsconfig.json ./
COPY src ./src
RUN npm install typescript && npx tsc -p tsconfig.json && npm uninstall typescript

RUN useradd -m -u 1000 gateway
USER gateway

EXPOSE 6808 6809 8090
CMD ["node", "dist/index.js"]
