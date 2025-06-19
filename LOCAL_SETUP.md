# Octamy Platform - Local Development Setup Guide

## Prerequisites

### System Requirements
- Node.js 20.x or higher
- PostgreSQL 16+ (local installation)
- Git
- npm or yarn package manager

### Platform-Specific Requirements

#### Windows
```bash
# Install Node.js from https://nodejs.org
# Install PostgreSQL from https://www.postgresql.org/download/windows/
# Install Git from https://git-scm.com/download/win

# Verify installations
node --version
npm --version
psql --version
git --version
```

#### macOS
```bash
# Using Homebrew (recommended)
brew install node postgresql git

# Start PostgreSQL service
brew services start postgresql

# Verify installations
node --version
npm --version
psql --version
git --version
```

#### Linux (Ubuntu/Debian)
```bash
# Update package list
sudo apt update

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PostgreSQL
sudo apt install postgresql postgresql-contrib

# Install Git
sudo apt install git

# Start PostgreSQL service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Verify installations
node --version
npm --version
psql --version
git --version
```

## Project Setup

### 1. Clone Repository
```bash
git clone <your-repository-url>
cd octamy-platform
```

### 2. Install Dependencies
```bash
# Install all project dependencies
npm install

# Verify installation
npm list --depth=0
```

### 3. Database Setup

#### Create Database
```bash
# Access PostgreSQL (adjust for your system)
# Windows/Mac: psql -U postgres
# Linux: sudo -u postgres psql

# In PostgreSQL console:
CREATE DATABASE octamy_dev;
CREATE USER octamy_user WITH ENCRYPTED PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE octamy_dev TO octamy_user;
\q
```

#### Environment Configuration
```bash
# Create environment file
cp .env.example .env

# Edit .env file with your database credentials
nano .env
```

### 4. Environment Variables (.env file)
```env
# Database Configuration
DATABASE_URL="postgresql://octamy_user:your_secure_password@localhost:5432/octamy_dev"
PGHOST=localhost
PGPORT=5432
PGUSER=octamy_user
PGPASSWORD=your_secure_password
PGDATABASE=octamy_dev

# Application Configuration
NODE_ENV=development
PORT=5000
JWT_SECRET=your_jwt_secret_key_here

# Payment Gateway (Development)
PAYUMONEY_MERCHANT_ID=your_test_merchant_id
PAYUMONEY_MERCHANT_KEY=your_test_merchant_key
PAYUMONEY_SALT=your_test_salt

# Session Configuration
SESSION_SECRET=your_session_secret_here

# Email Configuration (Optional for development)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password

# Admin Credentials
ADMIN_EMAIL=admin@octamy.com
ADMIN_PASSWORD=admin123
```

### 5. Database Migration and Seeding
```bash
# Push database schema
npm run db:push

# Seed database with initial data
npm run seed

# Seed admin credentials
npm run seed:admin

# Create comprehensive demo data
npm run seed:comprehensive
```

### 6. Start Development Server
```bash
# Start the application
npm run dev

# Alternative: Start with specific port
PORT=3000 npm run dev
```

## Available Scripts

### Development Commands
```bash
# Start development server
npm run dev

# Start backend only
npm run server

# Start frontend only
npm run client

# Build for production
npm run build

# Start production server
npm start
```

### Database Commands
```bash
# Push schema changes to database
npm run db:push

# Generate database migrations
npm run db:generate

# View database schema
npm run db:studio

# Seed database
npm run seed

# Seed admin credentials
npm run seed:admin

# Create comprehensive demo data
npm run seed:comprehensive

# Reset database (caution: deletes all data)
npm run db:reset
```

### Code Quality
```bash
# Run TypeScript type checking
npm run type-check

# Format code
npm run format

# Lint code
npm run lint

# Fix linting issues
npm run lint:fix
```

## Troubleshooting

### Common Issues and Solutions

#### 1. Port Already in Use (EADDRINUSE)
```bash
# Find process using port 5000
lsof -i :5000          # macOS/Linux
netstat -ano | find "5000"  # Windows

# Kill process (replace PID with actual process ID)
kill -9 PID            # macOS/Linux
taskkill /PID PID /F   # Windows

# Or use different port
PORT=3000 npm run dev
```

#### 2. Database Connection Issues
```bash
# Check PostgreSQL service status
# macOS: brew services list | grep postgresql
# Linux: sudo systemctl status postgresql
# Windows: Check Services in Task Manager

# Test database connection
psql -U octamy_user -d octamy_dev -h localhost -p 5432

# Reset database if needed
npm run db:reset
```

#### 3. Import.meta.url Issues (Local Development)
```bash
# If you encounter import.meta.url errors, use this fix:
# Create vite.config.local.ts with:

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.url': 'import.meta.url'
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './client/src'),
      '@shared': path.resolve(__dirname, './shared'),
      '@assets': path.resolve(__dirname, './attached_assets')
    }
  },
  server: {
    port: 3000,
    proxy: {
      '/api': 'http://localhost:5000'
    }
  }
});

# Then run: npm run dev -- --config vite.config.local.ts
```

#### 4. Dotenv Loading Issues
```bash
# Install dotenv if missing
npm install dotenv

# Add to top of server/index.ts if needed:
import 'dotenv/config';
```

#### 5. TypeScript Errors
```bash
# Clear TypeScript cache
rm -rf node_modules/.cache
rm -rf dist

# Reinstall dependencies
npm ci

# Run type checking
npm run type-check
```

#### 6. Database Schema Sync Issues
```bash
# Drop and recreate database
dropdb octamy_dev
createdb octamy_dev

# Push schema again
npm run db:push

# Reseed data
npm run seed:comprehensive
```

## Development Workflow

### 1. Daily Development
```bash
# Pull latest changes
git pull origin main

# Install any new dependencies
npm install

# Check for database changes
npm run db:push

# Start development
npm run dev
```

### 2. Making Changes
```bash
# Create feature branch
git checkout -b feature/your-feature-name

# Make your changes
# Test your changes
npm run type-check
npm run lint

# Commit changes
git add .
git commit -m "feat: your feature description"

# Push changes
git push origin feature/your-feature-name
```

### 3. Database Changes
```bash
# After modifying shared/schema.ts
npm run db:push

# If you need to add data
npm run seed

# Test your changes
npm run dev
```

## Production Deployment

### 1. Build Application
```bash
# Create production build
npm run build

# Test production build locally
npm start
```

### 2. Environment Setup
```bash
# Set production environment variables
export NODE_ENV=production
export DATABASE_URL="your_production_database_url"
export JWT_SECRET="secure_production_secret"
export PAYUMONEY_MERCHANT_ID="live_merchant_id"
# ... other production variables
```

### 3. Deploy to Server
```bash
# Upload files to server
# Install dependencies
npm ci --production

# Run database migrations
npm run db:push

# Start with process manager
pm2 start ecosystem.config.js
```

## API Documentation

### Authentication Endpoints
```bash
# Register user
POST /api/register
Body: { email, password, firstName, lastName }

# Login user
POST /api/login
Body: { email, password }

# Get current user
GET /api/user
Headers: { Authorization: "Bearer <token>" }
```

### Course Endpoints
```bash
# Get all courses
GET /api/courses

# Get course by ID
GET /api/courses/:id

# Get course questions
GET /api/courses/:id/questions
```

### Exam Endpoints
```bash
# Submit exam
POST /api/exam/submit
Body: { courseId, answers, timeSpent }

# Get exam results
GET /api/exam-results-temp/:tempExamId
```

### Certificate Endpoints
```bash
# Get user certificates
GET /api/user/certificates
Headers: { Authorization: "Bearer <token>" }

# Download certificate
GET /api/certificate/:certificateNumber/download

# Verify certificate
GET /api/certificate/:certificateNumber
```

### Payment Endpoints
```bash
# Initiate payment
POST /api/payment/initiate
Body: { certificateId, amount }

# Payment success callback
POST /api/payment/success
Body: { payment response data }
```

## File Structure
```
octamy-platform/
├── client/                 # Frontend React application
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/         # Page components
│   │   ├── hooks/         # Custom React hooks
│   │   └── lib/           # Utility functions
├── server/                # Backend Express application
│   ├── controllers/       # Request handlers
│   ├── middleware/        # Express middleware
│   ├── routes/           # API routes
│   └── utils/            # Utility functions
├── shared/               # Shared code between frontend/backend
│   └── schema.ts         # Database schema definitions
├── octamy-mobile/        # React Native mobile application
└── docs/                 # Documentation files
```

## Support

### Getting Help
1. Check this documentation first
2. Search existing issues in the repository
3. Create a new issue with detailed description
4. Include error messages and system information

### Useful Resources
- [Node.js Documentation](https://nodejs.org/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs)
- [Drizzle ORM Documentation](https://orm.drizzle.team)
- [React Documentation](https://react.dev)
- [Express.js Documentation](https://expressjs.com)

## License
This project is proprietary software. All rights reserved.