# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npx tsc --noEmit
RUN npm run build

# Production stage
FROM node:20-alpine

# Install timezone data
RUN apk add --no-cache tzdata
ENV TZ="UTC"

WORKDIR /app

# Copy standalone build and set permissions
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public

USER node

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
