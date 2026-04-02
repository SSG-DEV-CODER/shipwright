# Docker — Docker Compose Configuration

<!-- Source: https://github.com/docker/docs (Context7: /docker/docs) -->

## Basic docker-compose.yml

```yaml
# docker-compose.yml
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: development
      DATABASE_URL: postgresql://postgres:password@db:5432/mydb
    volumes:
      - .:/app
      - /app/node_modules    # don't override node_modules
    depends_on:
      db:
        condition: service_healthy
    env_file:
      - .env

  db:
    image: postgres:16
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
      POSTGRES_DB: mydb
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  postgres_data:
```

## Docker Compose Commands

```bash
# Start all services
docker compose up
docker compose up -d           # detached
docker compose up --build      # rebuild images

# Stop services
docker compose down
docker compose down -v         # also remove volumes

# View logs
docker compose logs
docker compose logs -f app     # follow specific service

# Run command in service
docker compose exec app sh
docker compose exec db psql -U postgres

# Scale a service
docker compose up --scale app=3

# Check status
docker compose ps

# Rebuild specific service
docker compose up -d --build app
```

## Production docker-compose.yml

```yaml
# docker-compose.prod.yml
services:
  app:
    image: myapp:${APP_VERSION:-latest}
    restart: always
    environment:
      NODE_ENV: production
    env_file:
      - .env.production
    ports:
      - "3000:3000"
    depends_on:
      db:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  db:
    image: postgres:16
    restart: always
    environment:
      POSTGRES_PASSWORD_FILE: /run/secrets/db_password
    secrets:
      - db_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready"]
      interval: 10s
      timeout: 5s
      retries: 5

  nginx:
    image: nginx:alpine
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./certs:/etc/nginx/certs:ro
    depends_on:
      - app

secrets:
  db_password:
    file: ./secrets/db_password.txt

volumes:
  postgres_data:
```

## Dockerfile Best Practices

```dockerfile
# syntax=docker/dockerfile:1

# 1. Pin base image version
FROM node:24.0.0-alpine3.20

# 2. Set working directory
WORKDIR /app

# 3. Copy only package files first (layer caching)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# 4. Then copy source (invalidates cache only when source changes)
COPY . .

# 5. Run as non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs
USER nodejs

# 6. Use exec form for CMD (handles signals properly)
CMD ["node", "server.js"]

# 7. Document exposed ports
EXPOSE 3000
```

## Environment Variable Strategies

```yaml
services:
  app:
    # Option 1: Inline in compose file (not recommended for secrets)
    environment:
      KEY: value

    # Option 2: From env file
    env_file:
      - .env
      - .env.local

    # Option 3: From host environment (no value = inherit)
    environment:
      - NODE_ENV
      - API_KEY  # Must be set in host shell
```

## Build Arguments

```dockerfile
ARG NODE_VERSION=24
FROM node:${NODE_VERSION}-alpine
ARG BUILD_DATE
LABEL build-date="${BUILD_DATE}"
```

```yaml
services:
  app:
    build:
      context: .
      args:
        NODE_VERSION: "24"
        BUILD_DATE: "${BUILD_DATE}"
```

## Named Volumes vs Bind Mounts

```yaml
volumes:
  # Named volume: managed by Docker (best for production data)
  - postgres_data:/var/lib/postgresql/data

  # Bind mount: syncs host directory to container (dev hot reload)
  - ./src:/app/src

  # Anonymous volume: temporary, not persisted
  - /app/node_modules
```
