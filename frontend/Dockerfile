FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json ./package.json
RUN npm install --production=false

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/index.html ./index.html
COPY --from=builder /app/package.json ./package.json
RUN npm i -g serve
EXPOSE 5173
CMD ["serve", "-s", ".", "-l", "5173"]
