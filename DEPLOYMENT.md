# 🚀 Deployment Guide - Lackadaisical AI Chat

## Production Deployment Guide

This guide covers deploying Lackadaisical AI Chat to production environments.

---

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Database Setup](#database-setup)
4. [Application Deployment](#application-deployment)
5. [Monitoring & Logging](#monitoring--logging)
6. [Backup & Recovery](#backup--recovery)
7. [Scaling](#scaling)
8. [Security Hardening](#security-hardening)

---

## Prerequisites

### System Requirements
- **OS**: Linux (Ubuntu 22.04+ recommended), macOS, or Windows Server
- **Node.js**: v18.0.0 or newer
- **Memory**: 4GB minimum, 8GB+ recommended
- **Storage**: 10GB minimum, SSD recommended
- **Database**: PostgreSQL 14+, MySQL 8.0+, or SQLite 3.35+

### Required Software
```bash
# Node.js and npm
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# PostgreSQL (if using)
sudo apt-get install -y postgresql postgresql-contrib

# nginx (for reverse proxy)
sudo apt-get install -y nginx

# PM2 (for process management)
sudo npm install -g pm2
```

---

## Environment Setup

### 1. Clone Repository
```bash
git clone https://github.com/Lackadaisical-Security/Lackadaisical-AI-Chat.git
cd Lackadaisical-AI-Chat
```

### 2. Install Dependencies
```bash
# Option A: Use the setup script (recommended — handles everything)
chmod +x setup-lackadaisical-ai.sh
./setup-lackadaisical-ai.sh

# Option B: Install manually
# Install root dependencies
npm install

# Install backend dependencies
cd backend && npm install && cd ..

# Install frontend dependencies
cd frontend && npm install && cd ..
```

### 3. Configure Environment
```bash
# Copy production environment preset
cp config/production.env .env

# Edit configuration
nano .env
```

**Required Environment Variables:**
```env
# Server
FRONTEND_PORT=3000
BACKEND_PORT=3001
BACKEND_HOST=0.0.0.0
CORS_ORIGIN=https://yourdomain.com
NODE_ENV=production

# Database
DB_TYPE=postgresql
DB_HOST=localhost
DB_PORT=5432
DB_NAME=lackadaisical_chat
DB_USERNAME=app_user
DB_PASSWORD=secure_password_here

# Security (CHANGE THESE!)
JWT_SECRET=your_random_string_min_32_chars
SESSION_SECRET=your_random_string_min_32_chars

# AI Provider
AI_PRIMARY_PROVIDER=anthropic
ANTHROPIC_API_KEY=your_api_key_here

# Backup
BACKUP_ENABLED=true
BACKUP_SCHEDULE=0 2 * * *
BACKUP_RETENTION_DAYS=30
```

---

## Database Setup

### PostgreSQL Setup

```bash
# Create database and user
sudo -u postgres psql

postgres=# CREATE DATABASE lackadaisical_chat;
postgres=# CREATE USER app_user WITH ENCRYPTED PASSWORD 'secure_password';
postgres=# GRANT ALL PRIVILEGES ON DATABASE lackadaisical_chat TO app_user;
postgres=# \q
```

### MySQL Setup

```bash
# Create database and user
mysql -u root -p

mysql> CREATE DATABASE lackadaisical_chat CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
mysql> CREATE USER 'app_user'@'localhost' IDENTIFIED BY 'secure_password';
mysql> GRANT ALL PRIVILEGES ON lackadaisical_chat.* TO 'app_user'@'localhost';
mysql> FLUSH PRIVILEGES;
mysql> EXIT;
```

### Initialize Database Schema
```bash
# Run database initialization
npm run init:db
```

---

## Application Deployment

### Option 1: PM2 (Recommended)

```bash
# Build the application
npm run build

# Create PM2 ecosystem file
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'lackadaisical-backend',
      cwd: './backend',
      script: 'dist/index.js',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    }
  ]
};
EOF

# Start with PM2
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Enable PM2 startup on boot
pm2 startup
```

### Option 2: Systemd Service

```bash
# Create systemd service
sudo nano /etc/systemd/system/lackadaisical-backend.service
```

```ini
[Unit]
Description=Lackadaisical AI Chat Backend
After=network.target postgresql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/lackadaisical-ai-chat/backend
Environment=NODE_ENV=production
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=lackadaisical-backend

[Install]
WantedBy=multi-user.target
```

```bash
# Enable and start service
sudo systemctl daemon-reload
sudo systemctl enable lackadaisical-backend
sudo systemctl start lackadaisical-backend
```

### Frontend Deployment

```bash
# Build frontend
cd frontend
npm run build

# Serve with nginx
sudo cp -r dist/* /var/www/lackadaisical/
```

---

## Nginx Configuration

```bash
sudo nano /etc/nginx/sites-available/lackadaisical
```

```nginx
# Upstream backend
upstream lackadaisical_backend {
    server localhost:3001;
    keepalive 64;
}

# Frontend
server {
    listen 80;
    listen [::]:80;
    server_name yourdomain.com www.yourdomain.com;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

# Frontend HTTPS
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL certificates (use Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Root directory
    root /var/www/lackadaisical;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # API proxy
    location /api/ {
        proxy_pass http://lackadaisical_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # WebSocket proxy
    location /ws {
        proxy_pass http://lackadaisical_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
    }

    # Frontend routes
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/lackadaisical /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## SSL Certificate (Let's Encrypt)

```bash
# Install certbot
sudo apt-get install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Auto-renewal
sudo certbot renew --dry-run
```

---

## Monitoring & Logging

### Log Management

```bash
# View PM2 logs
pm2 logs lackadaisical-backend

# View application logs
tail -f logs/combined.log
tail -f logs/error.log

# Log rotation (logrotate)
sudo nano /etc/logrotate.d/lackadaisical
```

```
/opt/lackadaisical-ai-chat/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    create 0644 www-data www-data
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}
```

### Health Monitoring

```bash
# Check application health
curl http://localhost:3001/api/health

# Monitor with PM2
pm2 monit

# Set up monitoring (optional)
pm2 install pm2-server-monit
```

---

## Backup & Recovery

### Automated Backups

Backups are automatically configured via the BackupService. Verify configuration:

```bash
# Check backup schedule in .env
BACKUP_ENABLED=true
BACKUP_SCHEDULE=0 2 * * *  # Daily at 2 AM
BACKUP_RETENTION_DAYS=30
```

### Manual Backup

```bash
# Create manual backup
curl -X POST http://localhost:3001/api/admin/backup

# List backups
ls -lh backups/

# Download backup
scp user@server:/path/to/backups/backup_*.db.gz ./
```

### Restore from Backup

```bash
# Stop application
pm2 stop lackadaisical-backend

# Restore database
curl -X POST http://localhost:3001/api/admin/restore \
  -H "Content-Type: application/json" \
  -d '{"backupId": "backup_1234567890_abc123"}'

# Restart application
pm2 restart lackadaisical-backend
```

---

## Scaling

### Horizontal Scaling

```bash
# Add more PM2 instances
pm2 scale lackadaisical-backend +2

# Or set specific number
pm2 scale lackadaisical-backend 4
```

### Load Balancing

Use nginx upstream for multiple backend instances:

```nginx
upstream lackadaisical_backend {
    least_conn;
    server 127.0.0.1:3001;
    server 127.0.0.1:3002;
    server 127.0.0.1:3003;
    server 127.0.0.1:3004;
}
```

---

## Security Hardening

### Firewall Configuration

```bash
# UFW firewall
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### Database Security

```bash
# PostgreSQL: Restrict connections
sudo nano /etc/postgresql/14/main/pg_hba.conf
# Change: host all all 127.0.0.1/32 md5

# Restart PostgreSQL
sudo systemctl restart postgresql
```

### Application Security

1. **Change default secrets** in `.env`
2. **Enable rate limiting** (already configured)
3. **Use HTTPS only** in production
4. **Regular updates**: `npm audit fix`
5. **Monitor logs** for suspicious activity

---

## Troubleshooting

### Application won't start
```bash
# Check logs
pm2 logs lackadaisical-backend --lines 100

# Check port availability
sudo netstat -tulpn | grep :3001

# Verify database connection
psql -h localhost -U app_user -d lackadaisical_chat
```

### High memory usage
```bash
# Monitor with PM2
pm2 monit

# Reduce PM2 instances
pm2 scale lackadaisical-backend 2

# Check for memory leaks
pm2 logs --err
```

### Database connection errors
```bash
# Test database connection
psql -h localhost -U app_user -d lackadaisical_chat

# Check database status
sudo systemctl status postgresql

# Review connection settings in .env
```

---

## Maintenance

### Updates

```bash
# Pull latest changes
git pull origin main

# Install new dependencies
npm install
cd backend && npm install && cd ..
cd frontend && npm install && cd ..

# Rebuild
npm run build

# Restart
pm2 restart lackadaisical-backend
```

### Database Maintenance

```bash
# PostgreSQL vacuum
psql -U app_user -d lackadaisical_chat -c "VACUUM ANALYZE;"

# Check database size
psql -U app_user -d lackadaisical_chat -c "SELECT pg_size_pretty(pg_database_size('lackadaisical_chat'));"
```

---

## Support

For deployment issues:
- 📖 Check [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
- 🐛 Report issues on [GitHub](https://github.com/Lackadaisical-Security/Lackadaisical-AI-Chat/issues)
- 📧 Email: admin@lackadaisical-security.com

---

**Made with 💙 by Lackadaisical Security**
