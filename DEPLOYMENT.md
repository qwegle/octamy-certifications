# Octamy Production Deployment Guide

## Overview

This guide covers production deployment for the Octamy Professional Certification Platform, including build processes, environment configuration, and deployment strategies.

## Prerequisites

- Node.js 20 or higher
- PostgreSQL 16 or higher
- Git
- Domain name (optional)
- SSL certificate (for HTTPS)

## Build Process

### 1. Environment Setup

Create a `.env.production` file with production values:

```bash
# Database Configuration
DATABASE_URL=postgresql://username:password@hostname:5432/database_name
PGHOST=your-postgres-host
PGPORT=5432
PGUSER=your-postgres-user
PGPASSWORD=your-postgres-password
PGDATABASE=your-database-name

# PayUMoney Payment Gateway (Production)
PAYUMONEY_MERCHANT_ID=your-production-merchant-id
PAYUMONEY_MERCHANT_KEY=your-production-merchant-key
PAYUMONEY_SALT=your-production-salt

# Application Configuration
NODE_ENV=production
PORT=5000
SESSION_SECRET=your-super-secure-session-secret-min-32-chars

# SSL Configuration (if using HTTPS)
SSL_CERT_PATH=/path/to/ssl/certificate.crt
SSL_KEY_PATH=/path/to/ssl/private-key.key
```

### 2. Build Commands

Use the provided build script:

```bash
chmod +x build.sh
./build.sh
```

Or run manually:

```bash
# Install dependencies
npm ci --production=false

# Build frontend
npm run build

# Build backend
npm run build:server

# Install only production dependencies
npm ci --production --ignore-scripts

# Run database migrations
npm run db:push
```

## Deployment Options

### Option 1: Traditional Server Deployment

#### Step 1: Server Setup
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install nodejs npm postgresql nginx

# CentOS/RHEL
sudo yum install nodejs npm postgresql nginx
```

#### Step 2: Application Deployment
```bash
# Clone repository
git clone <your-repo-url>
cd octamy

# Copy production environment
cp .env.production .env

# Run build script
./build.sh

# Start application with PM2
npm install -g pm2
pm2 start dist/index.js --name "octamy"
pm2 startup
pm2 save
```

#### Step 3: Nginx Configuration
```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    ssl_certificate /path/to/ssl/certificate.crt;
    ssl_certificate_key /path/to/ssl/private-key.key;
    
    # Static files
    location /assets/ {
        root /path/to/octamy/dist/public;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # API and dynamic content
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Option 2: Docker Deployment

#### Dockerfile
```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --production=false

COPY . .
RUN npm run build
RUN npm run build:server
RUN npm ci --production --ignore-scripts

FROM node:20-alpine AS production

WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

EXPOSE 5000
CMD ["node", "dist/index.js"]
```

#### docker-compose.yml
```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "5000:5000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:password@db:5432/octamy
    depends_on:
      - db
    restart: unless-stopped

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: octamy
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/ssl/certs
    depends_on:
      - app
    restart: unless-stopped

volumes:
  postgres_data:
```

### Option 3: Cloud Platform Deployment

#### Replit Deployments
```bash
# Already configured for Replit
# Simply use the "Deploy" button in Replit interface
```

#### Vercel/Netlify
```json
{
  "buildCommand": "./build.sh",
  "outputDirectory": "dist/public",
  "installCommand": "npm ci",
  "functions": {
    "app": {
      "runtime": "nodejs20.x"
    }
  }
}
```

## Database Migration

### Production Migration Steps
```bash
# Backup existing database
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# Run migrations
npm run db:push

# Verify migration
npm run db:introspect
```

### Rollback Procedure
```bash
# Restore from backup if needed
psql $DATABASE_URL < backup_YYYYMMDD_HHMMSS.sql
```

## Monitoring and Logging

### Application Monitoring
```bash
# PM2 monitoring
pm2 monit

# Log viewing
pm2 logs octamy

# Performance monitoring
pm2 install pm2-server-monit
```

### Health Checks
```bash
# Create health check endpoint
curl https://your-domain.com/api/health

# Expected response:
# {"status": "ok", "timestamp": "2025-06-17T...", "uptime": 12345}
```

## SSL Certificate Setup

### Let's Encrypt (Free SSL)
```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

### Custom SSL Certificate
```bash
# Place certificates in /etc/ssl/certs/
sudo cp your-domain.crt /etc/ssl/certs/
sudo cp your-domain.key /etc/ssl/private/
sudo chmod 600 /etc/ssl/private/your-domain.key
```

## Performance Optimization

### Frontend Optimization
- Gzip compression enabled
- Static asset caching (1 year)
- CDN integration for global distribution
- Image optimization and lazy loading

### Backend Optimization
- Database connection pooling
- Redis caching for sessions
- Load balancing with multiple instances
- Database query optimization

### Database Optimization
```sql
-- Create indexes for better performance
CREATE INDEX idx_certificates_user_course ON certificates(user_id, course_id);
CREATE INDEX idx_exam_attempts_user ON exam_attempts(user_id);
CREATE INDEX idx_payments_status ON payments(status);
```

## Security Considerations

### Environment Security
- Use strong passwords and secrets
- Enable database SSL connections
- Implement rate limiting
- Regular security updates

### Application Security
- HTTPS enforcement
- Secure session management
- Input validation and sanitization
- SQL injection prevention

## Backup Strategy

### Automated Backups
```bash
#!/bin/bash
# backup_database.sh
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/var/backups/octamy"
mkdir -p $BACKUP_DIR

pg_dump $DATABASE_URL > $BACKUP_DIR/octamy_$DATE.sql
gzip $BACKUP_DIR/octamy_$DATE.sql

# Keep only last 30 days
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete
```

### File System Backups
```bash
# Backup application files
tar -czf /var/backups/octamy_files_$(date +%Y%m%d).tar.gz /path/to/octamy

# Backup certificates and uploads
rsync -av /path/to/octamy/uploads/ /backup/location/uploads/
```

## Troubleshooting

### Common Issues

1. **Database Connection Issues**
   ```bash
   # Check database connectivity
   psql $DATABASE_URL -c "SELECT 1;"
   
   # Verify environment variables
   echo $DATABASE_URL
   ```

2. **Port Already in Use**
   ```bash
   # Find process using port 5000
   sudo lsof -i :5000
   
   # Kill process if necessary
   sudo kill -9 <PID>
   ```

3. **SSL Certificate Issues**
   ```bash
   # Check certificate validity
   openssl x509 -in /path/to/cert.crt -text -noout
   
   # Test SSL connection
   openssl s_client -connect your-domain.com:443
   ```

4. **Build Failures**
   ```bash
   # Clear npm cache
   npm cache clean --force
   
   # Remove node_modules and reinstall
   rm -rf node_modules package-lock.json
   npm install
   ```

## Maintenance

### Regular Tasks
- Weekly: Review logs and performance metrics
- Monthly: Update dependencies and security patches
- Quarterly: Full backup verification and restore testing
- Yearly: SSL certificate renewal and security audit

### Update Procedure
```bash
# Create maintenance page
echo "Maintenance in progress" > /var/www/maintenance.html

# Backup current version
git tag production-backup-$(date +%Y%m%d)

# Deploy new version
git pull origin main
./build.sh
pm2 restart octamy

# Verify deployment
curl https://your-domain.com/api/health

# Remove maintenance page
rm /var/www/maintenance.html
```

## Support

For deployment issues or questions:
- Check logs: `pm2 logs octamy`
- Review this documentation
- Check application health endpoint
- Contact system administrator

---

**Last Updated:** June 17, 2025
**Version:** 1.0.0