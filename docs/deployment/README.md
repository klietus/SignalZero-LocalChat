# Deployment Guide

Options for deploying SignalZero LocalChat in production.

## Table of Contents

1. [Static Build Deployment](#static-build-deployment)
2. [Docker Deployment](#docker-deployment)
3. [Nginx Configuration](#nginx-configuration)
4. [Environment Variables](#environment-variables)
5. [HTTPS/SSL](#httpsssl)

## Static Build Deployment

LocalChat builds to static files that can be served by any web server.

### Build

```bash
npm run build
```

Output in `dist/`:
```
dist/
├── index.html
├── assets/
│   ├── index-xxx.js
│   ├── index-xxx.css
│   └── ...
└── ...
```

### Deploy to Nginx

```bash
# Copy build to web root
sudo cp -r dist/* /var/www/signalzero/

# Set permissions
sudo chown -R www-data:www-data /var/www/signalzero
```

Nginx config:
```nginx
server {
    listen 80;
    server_name signalzero.example.com;
    root /var/www/signalzero;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy API requests to LocalNode
    location /api/ {
        proxy_pass http://localhost:3001/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
}
```

### Deploy to Apache

```apache
<VirtualHost *:80>
    ServerName signalzero.example.com
    DocumentRoot /var/www/signalzero

    <Directory /var/www/signalzero>
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>

    RewriteEngine On
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteRule ^ index.html [QSA,L]
</VirtualHost>
```

### Deploy to CDN (Cloudflare/S3)

```bash
# Build with production settings
npm run build

# Upload to S3
aws s3 sync dist/ s3://your-bucket/signalzero/

# Or Cloudflare Pages
npx wrangler pages publish dist/
```

## Docker Deployment

### Dockerfile

```dockerfile
# Build stage
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### Build and Run

```bash
# Build image
docker build -t signalzero/localchat:latest .

# Run container
docker run -d \
  -p 3000:80 \
  --name localchat \
  signalzero/localchat:latest
```

### Docker Compose

```yaml
version: '3.8'

services:
  localchat:
    build: ./SignalZero-LocalChat
    ports:
      - "3000:80"
    environment:
      - VITE_KERNEL_URL=http://localnode:3001
    depends_on:
      - localnode

  localnode:
    build: ./SignalZero-LocalNode
    ports:
      - "3001:3001"
    environment:
      - REDIS_URL=redis://redis:6379
      - CHROMA_URL=http://chroma:8000
    depends_on:
      - redis
      - chroma

  redis:
    image: redis:7-alpine
    volumes:
      - redis-data:/data

  chroma:
    image: chromadb/chroma:latest
    volumes:
      - chroma-data:/chroma/chroma

volumes:
  redis-data:
  chroma-data:
```

Run:
```bash
docker-compose up -d
```

## Nginx Configuration

### Full Production Config

```nginx
upstream localnode {
    server localhost:3001;
}

server {
    listen 80;
    server_name signalzero.example.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name signalzero.example.com;

    root /var/www/signalzero;
    index index.html;

    # SSL certificates
    ssl_certificate /etc/letsencrypt/live/signalzero.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/signalzero.example.com/privkey.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_types text/plain text/css application/json application/javascript text/xml;

    # Static assets (cached)
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }

    # Main app (no cache)
    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache";
    }

    # API proxy to LocalNode
    location /api/ {
        proxy_pass http://localnode/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }

    # SSE support for streaming
    location /api/chat {
        proxy_pass http://localnode/api/chat;
        proxy_http_version 1.1;
        proxy_set_header Connection '';
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 86400;
    }
}
```

## Environment Variables

### Build-Time Variables

Set in `.env` or during build:

```bash
# Kernel connection
VITE_KERNEL_URL=http://localhost:3001

# Build settings
VITE_APP_NAME=SignalZero
VITE_APP_VERSION=1.0.0
```

### Runtime Configuration

For Docker, pass at runtime:

```bash
docker run -e VITE_KERNEL_URL=http://host:3001 signalzero/localchat
```

Note: Vite embeds env vars at build time. For truly dynamic config, use a config endpoint.

## HTTPS/SSL

### Let's Encrypt (Certbot)

```bash
# Install certbot
sudo apt-get install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d signalzero.example.com

# Auto-renewal test
sudo certbot renew --dry-run
```

### Self-Signed (Development)

```bash
# Generate cert
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout localhost.key -out localhost.crt

# Use with vite
npm run dev -- --https --cert localhost.crt --key localhost.key
```

### Cloudflare Origin Certificates

1. Generate origin cert in Cloudflare dashboard
2. Download certificate and key
3. Configure Nginx with downloaded files

## Reverse Proxy Scenarios

### LocalNode on Different Host

```nginx
location /api/ {
    proxy_pass http://192.168.1.100:3001/;
    # ... other proxy settings
}
```

### Path-Based Routing

```nginx
# UI at /app, API at /api
location /app/ {
    alias /var/www/signalzero/;
    try_files $uri $uri/ /app/index.html;
}

location /api/ {
    proxy_pass http://localhost:3001/;
}
```

### Subdomain Routing

```nginx
# app.signalzero.example.com → LocalChat
server {
    server_name app.signalzero.example.com;
    root /var/www/signalzero;
    # ...
}

# api.signalzero.example.com → LocalNode
server {
    server_name api.signalzero.example.com;
    location / {
        proxy_pass http://localhost:3001;
    }
}
```

## Health Checks

### Basic Health Endpoint

Add to your deployment:

```nginx
location /health {
    access_log off;
    return 200 "healthy\n";
    add_header Content-Type text/plain;
}
```

### Docker Health Check

```dockerfile
HEALTHCHECK --interval=30s --timeout=3s \
  CMD curl -f http://localhost:80/health || exit 1
```

## Monitoring

### Nginx Access Logs

```bash
# Real-time log viewing
sudo tail -f /var/log/nginx/access.log | grep signalzero

# Error logs
sudo tail -f /var/log/nginx/error.log
```

### Log Rotation

```bash
# /etc/logrotate.d/signalzero
/var/www/signalzero/logs/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 644 www-data www-data
}
```

## Troubleshooting

### 404 on Page Refresh

Ensure Nginx is configured for SPAs:
```nginx
try_files $uri $uri/ /index.html;
```

### API Connection Failed

Check proxy configuration:
```nginx
location /api/ {
    proxy_pass http://localhost:3001/;  # Note trailing slash
}
```

### CORS Errors

Ensure LocalNode allows the UI origin, or proxy through same origin.

### Static Assets 404

Check build output and nginx root:
```bash
ls -la /var/www/signalzero/assets/
```
