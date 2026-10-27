FROM node:20-alpine
RUN apk add --no-cache openssl
RUN npm install -g pnpm@10.28.0
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/ ./apps/
COPY packages/ ./packages/

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @att/db generate
RUN pnpm --filter @att/web build

ENV PORT=10000
EXPOSE 10000

CMD pnpm --filter @att/db exec prisma migrate deploy && pnpm --filter @att/db seed && pnpm --filter @att/api start:prod
