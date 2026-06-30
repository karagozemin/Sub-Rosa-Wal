FROM node:22-bookworm-slim

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
COPY services ./services
COPY apps/web/package.json ./apps/web/package.json

RUN pnpm install --frozen-lockfile

ENV NODE_ENV=production
ENV PORT=4021

EXPOSE 4021

CMD ["pnpm", "--filter", "@sub-rosa/appraisal-api", "start"]
