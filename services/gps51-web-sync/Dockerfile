FROM mcr.microsoft.com/playwright:v1.60.0-noble

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY tsconfig.json ./
COPY src ./src
RUN npm install typescript && npx tsc -p tsconfig.json && npm uninstall typescript

RUN mkdir -p /data/auth /data/captures && chown -R pwuser:pwuser /data

USER pwuser

EXPOSE 8091
CMD ["node", "dist/index.js"]

