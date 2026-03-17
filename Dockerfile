FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ src/
RUN npm run build

FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY package*.json ./
RUN npm ci --omit=dev

RUN mkdir -p /config /temp-data

ENV PORT=9229
ENV CONFIG_FILE=/config/config.json
ENV USERS_FILE=/config/users.json
ENV DATA_DIR=/temp-data

EXPOSE 9229

CMD ["node", "dist/index.js"]
