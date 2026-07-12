FROM node:20-alpine

WORKDIR /app

# Install dependencies first (better layer caching)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy the rest of the app
COPY . .

ENV NODE_ENV=production
EXPOSE 4000

CMD ["node", "server.js"]
