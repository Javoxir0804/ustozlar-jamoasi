FROM node:20-alpine
RUN npm install -g pnpm
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/ ./apps/
COPY packages/ ./packages/
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @att/db generate
RUN pnpm --filter @att/web build
EXPOSE 3000
CMD pnpm --filter @att/db exec prisma migrate deploy && pnpm --filter @att/db seed && pnpm --filter @att/api start:prod
