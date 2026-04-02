# Docker — Gotchas & Common Mistakes

<!-- Source: https://github.com/docker/docs (Context7: /docker/docs) -->

## 1. Never Run as Root in Production

```dockerfile
# ❌ Runs as root by default — security risk
FROM node:24-alpine
WORKDIR /app
COPY . .
CMD ["node", "server.js"]

# ✅ Create a non-root user
FROM node:24-alpine
WORKDIR /app
COPY . .

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs
USER nodejs

CMD ["node", "server.js"]
```

## 2. `.dockerignore` Is Essential

Without it, your entire project (including `node_modules`, `.git`, secrets) gets copied into the build context, massively slowing builds:

```
# .dockerignore
node_modules
.next
dist
.env
.env.local
.env*.local
.git
.gitignore
README.md
*.log
coverage
.DS_Store
```

## 3. Layer Caching — Copy package.json Before Source Code

```dockerfile
# ❌ Reinstalls ALL deps on every source change
COPY . .
RUN npm install

# ✅ npm install only runs when package.json changes
COPY package.json package-lock.json ./
RUN npm ci
COPY . .  # Source changes only invalidate from here
```

## 4. Use `CMD` in Exec Form (Not Shell Form) for Signal Handling

```dockerfile
# ❌ Shell form: PID 1 is sh, not your app — signals not forwarded
CMD node server.js

# ✅ Exec form: your process is PID 1, signals handled properly
CMD ["node", "server.js"]
```

## 5. Don't Store Secrets in Dockerfile or Image Layers

```dockerfile
# ❌ Secret baked into image layer forever
RUN export API_KEY=secret && npm run build

# ✅ Use build secrets (BuildKit)
RUN --mount=type=secret,id=api_key \
    API_KEY=$(cat /run/secrets/api_key) npm run build

# Build with:
# docker build --secret id=api_key,src=./api.key .
```

## 6. `docker compose up` vs `docker compose up --build`

```bash
# docker compose up reuses existing image (stale code)
docker compose up

# docker compose up --build always rebuilds
docker compose up --build

# Or rebuild specific service
docker compose build app && docker compose up
```

## 7. Named Volumes Persist Data — Explicit Removal Needed

```bash
# docker compose down does NOT remove volumes
docker compose down

# Must explicitly remove volumes
docker compose down -v

# Or remove specific volume
docker volume rm my-app_postgres_data
```

## 8. `depends_on` Doesn't Wait for Service to Be Ready

```yaml
# ❌ Only waits for container to START, not be healthy
depends_on:
  - db

# ✅ Use health checks + condition
depends_on:
  db:
    condition: service_healthy

healthcheck:
  test: ["CMD-SHELL", "pg_isready -U postgres"]
  interval: 5s
  timeout: 5s
  retries: 5
```

## 9. Multi-Stage Builds Dramatically Reduce Image Size

```dockerfile
# Without multi-stage: ~1GB+ image with build tools
FROM node:24
RUN npm install && npm run build
CMD ["node", "dist/server.js"]

# With multi-stage: ~150MB final image
FROM node:24 AS builder
RUN npm ci && npm run build

FROM node:24-alpine AS production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
CMD ["node", "dist/server.js"]
```

## 10. Environment Variables vs Build Args

```dockerfile
# ARG: available only during build, NOT at runtime
ARG NODE_ENV=production

# ENV: available during build AND at runtime
ENV NODE_ENV=production
```

```yaml
# docker-compose.yml
services:
  app:
    build:
      args:
        - BUILD_DATE  # Build-time only
    environment:
      - NODE_ENV=production  # Runtime
```

## 11. `latest` Tag Is Unpredictable in Production

```dockerfile
# ❌ latest changes over time — builds not reproducible
FROM node:latest
FROM postgres:latest

# ✅ Pin to specific version
FROM node:24.0.0-alpine3.20
FROM postgres:16.1-alpine3.18
```

## 12. Port Mapping Syntax

```yaml
# HOST:CONTAINER
ports:
  - "3000:3000"   # Accessible from host on port 3000
  - "127.0.0.1:5432:5432"  # Only localhost (not external)
  - "5432"        # Random host port → container 5432
```
