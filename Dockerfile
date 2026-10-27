FROM node:22-alpine
RUN apk add --no-cache openssl
RUN npm install -g pnpm@10.28.0
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json start.sh ./
RUN chmod +x start.sh && sed -i 's/\r$//' start.sh
COPY apps/ ./apps/
COPY packages/ ./packages/

RUN pnpm install --frozen-lockfile --prod=false
RUN pnpm build

ENV NODE_ENV=production
ENV PORT=10000
EXPOSE 10000
CMD ["sh", "start.sh"]
