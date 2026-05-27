FROM node:20-alpine as builder
WORKDIR /app
COPY package*.json ./
RUN npm install --only=production

FROM node:20-alpine as runner
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .
EXPOSE 8000
CMD ["node", "server.js"]
