# Docker — Setup & Getting Started

<!-- Source: https://github.com/docker/docs (Context7: /docker/docs) -->

## Installation

### macOS
Install Docker Desktop from https://www.docker.com/products/docker-desktop/

### Ubuntu/Debian

```bash
# Add Docker's GPG key
sudo apt-get update
sudo apt-get install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

# Add repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
  https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
```

## Basic Dockerfile for Node.js

```dockerfile
# syntax=docker/dockerfile:1

FROM node:24-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
EXPOSE 3000
CMD ["node", "src/index.js"]
```

## Dockerfile for Python

```dockerfile
# syntax=docker/dockerfile:1

ARG PYTHON_VERSION=3.12
FROM python:${PYTHON_VERSION}-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

ARG UID=10001
RUN adduser \
    --disabled-password \
    --gecos "" \
    --home "/nonexistent" \
    --shell "/sbin/nologin" \
    --no-create-home \
    --uid "${UID}" \
    appuser

RUN --mount=type=cache,target=/root/.cache/pip \
    --mount=type=bind,source=requirements.txt,target=requirements.txt \
    python -m pip install -r requirements.txt

USER appuser
COPY . .
EXPOSE 8000
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
```

## Multi-Stage Build (Production-Optimized)

```dockerfile
# syntax=docker/dockerfile:1

# Stage 1: Build
FROM node:24-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Production
FROM node:24-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
RUN npm ci --omit=dev

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs

USER nodejs
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

## Essential Docker Commands

```bash
# Build an image
docker build -t my-app:latest .
docker build -t my-app:1.0.0 -f Dockerfile.prod .

# Run a container
docker run -p 3000:3000 my-app
docker run -d --name my-app -p 3000:3000 my-app       # detached
docker run -d -p 3000:3000 --env-file .env my-app     # with env file

# List containers
docker ps              # running
docker ps -a           # all (including stopped)

# Logs
docker logs my-app
docker logs -f my-app  # follow

# Stop/remove
docker stop my-app
docker rm my-app

# Shell into container
docker exec -it my-app sh

# List images
docker images
docker image ls

# Remove image
docker rmi my-app
docker image prune     # remove dangling images

# Pull from registry
docker pull postgres:16
```

## .dockerignore

```
node_modules
.next
dist
.env
.env.local
.git
*.md
coverage
```
