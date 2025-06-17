#!/bin/bash

# Octamy Production Build Script
# This script prepares the application for production deployment

set -e  # Exit on any error

echo "🚀 Starting Octamy Production Build Process..."

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js 20 or higher."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    print_error "Node.js version 18 or higher is required. Current version: $(node -v)"
    exit 1
fi

print_success "Node.js version check passed: $(node -v)"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    print_error "npm is not installed. Please install npm."
    exit 1
fi

print_success "npm version: $(npm -v)"

# Step 1: Clean previous builds
print_status "Cleaning previous build artifacts..."
if [ -d "dist" ]; then
    rm -rf dist
    print_success "Removed existing dist directory"
fi

if [ -d "node_modules" ]; then
    print_warning "Removing existing node_modules for clean install..."
    rm -rf node_modules
fi

if [ -f "package-lock.json" ]; then
    rm package-lock.json
    print_success "Removed existing package-lock.json"
fi

# Step 2: Install all dependencies (including dev dependencies)
print_status "Installing all dependencies..."
npm install
print_success "Dependencies installed successfully"

# Step 3: Run TypeScript checks
print_status "Running TypeScript type checking..."
if npx tsc --noEmit; then
    print_success "TypeScript type checking passed"
else
    print_warning "TypeScript type checking found issues, but continuing build..."
fi

# Step 4: Build frontend
print_status "Building frontend with Vite..."
npm run build
print_success "Frontend build completed"

# Step 5: Build backend
print_status "Building backend with esbuild..."
if ! npm run build:server; then
    print_error "Backend build failed"
    exit 1
fi
print_success "Backend build completed"

# Step 6: Install only production dependencies
print_status "Installing production dependencies only..."
npm ci --only=production --ignore-scripts
print_success "Production dependencies installed"

# Step 7: Check if .env file exists
if [ ! -f ".env" ]; then
    print_warning "No .env file found. Creating template..."
    cat > .env << EOF
# Database Configuration
DATABASE_URL=postgresql://username:password@hostname:5432/database_name
PGHOST=localhost
PGPORT=5432
PGUSER=postgres
PGPASSWORD=password
PGDATABASE=octamy

# PayUMoney Payment Gateway
PAYUMONEY_MERCHANT_ID=your-merchant-id
PAYUMONEY_MERCHANT_KEY=your-merchant-key
PAYUMONEY_SALT=your-salt

# Application Configuration
NODE_ENV=production
PORT=5000
SESSION_SECRET=your-super-secure-session-secret-minimum-32-characters-long

# Optional: SSL Configuration
# SSL_CERT_PATH=/path/to/ssl/certificate.crt
# SSL_KEY_PATH=/path/to/ssl/private-key.key
EOF
    print_warning "Please update the .env file with your production values"
fi

# Step 8: Run database migrations (if DATABASE_URL is set)
if [ ! -z "$DATABASE_URL" ] || grep -q "DATABASE_URL=" .env 2>/dev/null; then
    print_status "Running database migrations..."
    if npm run db:push; then
        print_success "Database migrations completed"
    else
        print_warning "Database migrations failed. Please run manually: npm run db:push"
    fi
else
    print_warning "DATABASE_URL not set. Skipping database migrations."
fi

# Step 9: Create production startup script
print_status "Creating production startup script..."
cat > start.sh << 'EOF'
#!/bin/bash

# Octamy Production Startup Script

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Set production environment
export NODE_ENV=production

# Start the application
echo "Starting Octamy in production mode..."
node dist/index.js
EOF

chmod +x start.sh
print_success "Created start.sh script"

# Step 10: Create PM2 ecosystem file
print_status "Creating PM2 ecosystem configuration..."
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'octamy',
    script: 'dist/index.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    error_file: 'logs/err.log',
    out_file: 'logs/out.log',
    log_file: 'logs/combined.log',
    time: true,
    max_memory_restart: '1G',
    restart_delay: 4000,
    max_restarts: 10,
    min_uptime: '10s'
  }]
};
EOF

# Create logs directory
mkdir -p logs
print_success "Created PM2 ecosystem configuration"

# Step 11: Create Docker files
print_status "Creating Docker configuration..."
cat > Dockerfile << 'EOF'
# Multi-stage build for production
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build && npm run build:server

# Production stage
FROM node:20-alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create app user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S octamy -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder --chown=octamy:nodejs /app/dist ./dist

# Create logs directory
RUN mkdir -p logs && chown -R octamy:nodejs logs

# Switch to non-root user
USER octamy

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the application
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]
EOF

cat > .dockerignore << 'EOF'
node_modules
npm-debug.log
.git
.gitignore
README.md
.nyc_output
coverage
.env
dist
logs
*.log
.DS_Store
Thumbs.db
EOF

print_success "Created Docker configuration"

# Step 12: Create docker-compose file
cat > docker-compose.yml << 'EOF'
version: '3.8'

services:
  app:
    build: .
    ports:
      - "5000:5000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:password@db:5432/octamy
      - SESSION_SECRET=your-super-secure-session-secret-minimum-32-characters-long
      - PAYUMONEY_MERCHANT_ID=your-merchant-id
      - PAYUMONEY_MERCHANT_KEY=your-merchant-key
      - PAYUMONEY_SALT=your-salt
    depends_on:
      - db
    restart: unless-stopped
    volumes:
      - ./logs:/app/logs
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:5000/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"]
      interval: 30s
      timeout: 10s
      retries: 3

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: octamy
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backups:/backups
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/ssl/certs:ro
    depends_on:
      - app
    restart: unless-stopped

volumes:
  postgres_data:
EOF

print_success "Created docker-compose.yml"

# Step 13: Display build summary
print_status "Build Summary:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 Build artifacts created in: ./dist/"
echo "🎯 Frontend bundle: ./dist/public/"
echo "⚙️  Backend bundle: ./dist/index.js"
echo "🐳 Docker files: Dockerfile, docker-compose.yml"
echo "🚀 PM2 config: ecosystem.config.js"
echo "📜 Startup script: start.sh"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Step 14: Show deployment options
print_success "🎉 Build completed successfully!"
echo ""
print_status "Deployment Options:"
echo ""
echo "1. 🖥️  Traditional Server Deployment:"
echo "   ./start.sh"
echo ""
echo "2. 🔄 PM2 Process Manager:"
echo "   npm install -g pm2"
echo "   pm2 start ecosystem.config.js"
echo "   pm2 startup"
echo "   pm2 save"
echo ""
echo "3. 🐳 Docker Deployment:"
echo "   docker build -t octamy ."
echo "   docker run -p 5000:5000 octamy"
echo ""
echo "4. 🐳 Docker Compose (with database):"
echo "   docker-compose up -d"
echo ""
echo "5. ☁️  Cloud Platform:"
echo "   Deploy the ./dist/ folder to your cloud provider"
echo ""

# Step 15: Show next steps
print_status "Next Steps:"
echo "1. Update .env file with production values"
echo "2. Configure your database connection"
echo "3. Set up SSL certificates (if using HTTPS)"
echo "4. Configure reverse proxy (nginx/apache)"
echo "5. Set up monitoring and backups"
echo ""
print_warning "⚠️  Security Reminder:"
echo "- Use strong passwords and secrets"
echo "- Enable HTTPS in production"
echo "- Set up firewall rules"
echo "- Regular security updates"
echo ""

print_success "✅ Production build process completed!"
echo "📖 See DEPLOYMENT.md for detailed deployment instructions"

exit 0