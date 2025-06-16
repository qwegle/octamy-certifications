# Octamy Professional Certification Platform

A comprehensive online certification platform built with React, Express.js, TypeScript, and PostgreSQL. Enables users to take professional assessments, obtain verified certificates, and track learning progress with interactive visualizations.

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Local Development Setup](#local-development-setup)
  - [Windows Setup](#windows-setup)
  - [macOS Setup](#macos-setup)
- [Configuration](#configuration)
- [Development Issues & Solutions](#development-issues--solutions)
- [Database Setup](#database-setup)
- [Running the Application](#running-the-application)
- [API Documentation](#api-documentation)
- [Deployment](#deployment)
- [Contributing](#contributing)

## Features

- **Professional Certification System**: Multi-domain assessments (AI, Development, Business, Internships)
- **Interactive Progress Visualization**: Animated achievement unlocks and course progress tracking
- **Payment Integration**: PayUMoney gateway with secure transaction processing
- **Partner/Seller System**: 10% commission tracking with withdrawal management
- **Certificate Generation**: Premium PDF certificates with verification system
- **Smart Notifications**: Personalized course recommendations based on user activity
- **Authentication System**: JWT-based secure authentication
- **Admin Dashboard**: Course management, user analytics, and system administration
- **Responsive Design**: Mobile-first approach with dark mode support

## Tech Stack

**Frontend:**
- React 18 with TypeScript
- Vite (build tool)
- Tailwind CSS + shadcn/ui components
- TanStack Query (React Query) for state management
- Wouter for routing
- Framer Motion for animations

**Backend:**
- Node.js with Express.js
- TypeScript with ES modules
- Drizzle ORM with PostgreSQL
- JWT authentication with bcrypt
- PayUMoney payment gateway integration

**Database:**
- PostgreSQL 16
- Drizzle ORM for migrations and queries

## Prerequisites

Before setting up the project locally, ensure you have:

- **Node.js** (version 18.0 or higher)
- **npm** (version 8.0 or higher)
- **PostgreSQL** (version 14 or higher)
- **Git**

## Local Development Setup

### Windows Setup

1. **Install Node.js and npm**
   ```powershell
   # Download and install from https://nodejs.org/
   # Or use Chocolatey
   choco install nodejs
   
   # Verify installation
   node --version
   npm --version
   ```

2. **Install PostgreSQL**
   ```powershell
   # Download from https://www.postgresql.org/download/windows/
   # Or use Chocolatey
   choco install postgresql
   
   # Start PostgreSQL service
   net start postgresql-x64-14
   ```

3. **Install Git**
   ```powershell
   # Download from https://git-scm.com/download/win
   # Or use Chocolatey
   choco install git
   ```

4. **Clone and Setup Project**
   ```powershell
   # Clone repository
   git clone <repository-url>
   cd octamy-certification-platform
   
   # Install dependencies
   npm install
   
   # Create environment file
   copy .env.example .env
   ```

### macOS Setup

1. **Install Node.js and npm**
   ```bash
   # Using Homebrew (recommended)
   brew install node
   
   # Or download from https://nodejs.org/
   
   # Verify installation
   node --version
   npm --version
   ```

2. **Install PostgreSQL**
   ```bash
   # Using Homebrew
   brew install postgresql@16
   brew services start postgresql@16
   
   # Or download from https://www.postgresql.org/download/macosx/
   ```

3. **Clone and Setup Project**
   ```bash
   # Clone repository
   git clone <repository-url>
   cd octamy-certification-platform
   
   # Install dependencies
   npm install
   
   # Create environment file
   cp .env.example .env
   ```

## Configuration

### Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/octamy_db
PGHOST=localhost
PGPORT=5432
PGUSER=your_username
PGPASSWORD=your_password
PGDATABASE=octamy_db

# Authentication
JWT_SECRET=your_super_secure_jwt_secret_key_here
SESSION_SECRET=your_super_secure_session_secret_here

# PayUMoney Configuration (Production)
PAYUMONEY_MERCHANT_ID=your_merchant_id
PAYUMONEY_MERCHANT_KEY=your_merchant_key
PAYUMONEY_SALT=your_salt_key

# Application Configuration
NODE_ENV=development
PORT=5000

# Optional: Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password
```

### Local Development Configuration Files

#### 1. Fix for import.meta.url issues in vite.config.ts

If you encounter `import.meta.url` issues locally, update `vite.config.ts`:

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

// Fix for import.meta.url in local development
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client/src"),
      "@shared": path.resolve(__dirname, "./shared"),
      "@assets": path.resolve(__dirname, "./attached_assets"),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 3000,
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist/public",
    emptyOutDir: true,
  },
});
```

#### 2. Fix for server/vite.ts in local development

Update `server/vite.ts` for local development compatibility:

```typescript
import { createServer as createViteServer } from "vite";
import { fileURLToPath } from "url";
import path from "path";

// Local development compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function createViteDevServer() {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
    root: path.resolve(__dirname, "../"),
    configFile: path.resolve(__dirname, "../vite.config.ts"),
  });
  
  return vite;
}
```

#### 3. dotenv Configuration Fix

Create a `config/env.js` file for consistent environment loading:

```javascript
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

export const config = {
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET: process.env.JWT_SECRET,
  SESSION_SECRET: process.env.SESSION_SECRET,
  PAYUMONEY_MERCHANT_ID: process.env.PAYUMONEY_MERCHANT_ID,
  PAYUMONEY_MERCHANT_KEY: process.env.PAYUMONEY_MERCHANT_KEY,
  PAYUMONEY_SALT: process.env.PAYUMONEY_SALT,
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: process.env.PORT || 5000,
};
```

## Development Issues & Solutions

### Common Issues

1. **Port Already in Use Error**
   ```bash
   # Kill process on port 5000
   # Windows
   netstat -ano | findstr :5000
   taskkill /PID <PID> /F
   
   # macOS/Linux
   lsof -ti:5000 | xargs kill -9
   ```

2. **PostgreSQL Connection Issues**
   ```bash
   # Check PostgreSQL status
   # Windows
   sc query postgresql-x64-14
   
   # macOS
   brew services list | grep postgresql
   
   # Start PostgreSQL if stopped
   # Windows
   net start postgresql-x64-14
   
   # macOS
   brew services start postgresql@16
   ```

3. **Module Resolution Issues**
   ```bash
   # Clear node_modules and reinstall
   rm -rf node_modules package-lock.json
   npm install
   
   # Clear npm cache
   npm cache clean --force
   ```

4. **TypeScript Compilation Errors**
   ```bash
   # Run TypeScript check
   npm run type-check
   
   # Build project to check for errors
   npm run build
   ```

### Environment-Specific Fixes

**Windows PowerShell Execution Policy:**
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

**macOS Permission Issues:**
```bash
sudo chown -R $(whoami) ~/.npm
sudo chown -R $(whoami) /usr/local/lib/node_modules
```

## Database Setup

1. **Create Database**
   ```sql
   -- Connect to PostgreSQL as superuser
   psql -U postgres
   
   -- Create database and user
   CREATE DATABASE octamy_db;
   CREATE USER octamy_user WITH PASSWORD 'your_password';
   GRANT ALL PRIVILEGES ON DATABASE octamy_db TO octamy_user;
   
   -- Exit psql
   \q
   ```

2. **Run Database Migrations**
   ```bash
   # Push schema to database
   npm run db:push
   
   # Optional: Generate migration files
   npm run db:generate
   
   # Seed database with initial data
   npm run db:seed
   ```

3. **Database Management Commands**
   ```bash
   # View database schema
   npm run db:studio
   
   # Reset database (development only)
   npm run db:reset
   
   # Backup database
   pg_dump octamy_db > backup.sql
   
   # Restore database
   psql octamy_db < backup.sql
   ```

## Running the Application

### Development Mode

```bash
# Start both frontend and backend
npm run dev

# Or start them separately
npm run dev:server    # Backend only (port 5000)
npm run dev:client    # Frontend only (port 3000)
```

### Production Build

```bash
# Build for production
npm run build

# Start production server
npm start
```

### Testing

```bash
# Run unit tests
npm test

# Run tests with coverage
npm run test:coverage

# Run integration tests
npm run test:integration
```

## API Documentation

### Authentication Endpoints

```
POST /api/auth/login    - User login
POST /api/auth/logout   - User logout
GET  /api/auth/user     - Get current user
```

### Course Management

```
GET    /api/courses           - List all courses
GET    /api/courses/:id       - Get course details
POST   /api/courses           - Create course (admin)
PUT    /api/courses/:id       - Update course (admin)
DELETE /api/courses/:id       - Delete course (admin)
```

### Exam & Certificates

```
POST /api/exam/submit         - Submit exam answers
POST /api/certificates/create - Generate certificate
GET  /api/certificates/:id    - Download certificate
GET  /api/certificates/verify/:id - Verify certificate
```

### Progress & Achievements

```
GET  /api/progress            - Get user progress
POST /api/progress            - Update progress
GET  /api/achievements        - List all achievements
GET  /api/user/achievements   - Get user achievements
POST /api/achievements/check  - Check for new achievements
```

### Payment Processing

```
POST /api/payment/initiate    - Initiate payment
POST /api/payment/success     - Payment success callback
POST /api/payment/failure     - Payment failure callback
GET  /api/payment/status/:id  - Check payment status
```

## Deployment

### Production Environment Variables

```env
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@host:5432/dbname
JWT_SECRET=production_jwt_secret
SESSION_SECRET=production_session_secret
PAYUMONEY_MERCHANT_ID=live_merchant_id
PAYUMONEY_MERCHANT_KEY=live_merchant_key
PAYUMONEY_SALT=live_salt_key
```

### Build and Deploy

```bash
# Build for production
npm run build

# Start production server
npm start

# Or use PM2 for process management
npm install -g pm2
pm2 start ecosystem.config.js
```

### Docker Deployment (Optional)

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 5000
CMD ["npm", "start"]
```

## Contributing

1. **Fork the repository**
2. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Make your changes**
4. **Run tests**
   ```bash
   npm test
   npm run type-check
   ```
5. **Commit your changes**
   ```bash
   git commit -m "Add your feature description"
   ```
6. **Push to your fork**
   ```bash
   git push origin feature/your-feature-name
   ```
7. **Create a Pull Request**

### Code Style Guidelines

- Use TypeScript for all new code
- Follow existing naming conventions
- Add JSDoc comments for functions
- Use Prettier for code formatting
- Run ESLint before committing

### Development Workflow

1. Always work on feature branches
2. Write tests for new functionality
3. Update documentation for API changes
4. Ensure all checks pass before PR
5. Get code review before merging

## Support

For issues and questions:

- **Documentation**: Check this README first
- **Issues**: Create a GitHub issue with detailed description
- **Email**: Contact support team for urgent matters

## License

This project is licensed under the MIT License - see the LICENSE file for details.

---

**Note**: This platform handles sensitive user data and payment information. Always follow security best practices and ensure all secrets are properly secured in production environments.