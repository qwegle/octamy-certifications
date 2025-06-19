# Octamy Platform - Quick Start Guide

## 🚀 Get Started in 5 Minutes

### Prerequisites
- Node.js 20+ installed
- PostgreSQL running locally
- Git installed

### 1. Clone and Install
```bash
git clone <your-repository-url>
cd octamy-platform
npm install
```

### 2. Database Setup
```bash
# Create database
createdb octamy_dev

# Or using PostgreSQL console:
psql -U postgres
CREATE DATABASE octamy_dev;
\q
```

### 3. Environment Setup
```bash
# Copy environment template
cp .env.example .env

# Edit .env with your database credentials
nano .env
```

**Required .env variables:**
```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/octamy_dev"
JWT_SECRET="your-32-character-secret-key-here"
SESSION_SECRET="your-32-character-session-secret"
```

### 4. Initialize Database
```bash
# Push schema and seed data
npm run db:push
npm run seed:comprehensive
```

### 5. Start Development
```bash
npm run dev
```

Visit: http://localhost:5000

## 📱 Quick Mobile App Setup

### 1. Navigate to Mobile Directory
```bash
cd octamy-mobile/OctamyMobile
```

### 2. Install Mobile Dependencies
```bash
npm install
```

### 3. Start Mobile Development
```bash
npm start
```

### 4. Preview Options
- **Expo Go**: Install Expo Go app and scan QR code
- **iOS Simulator**: Press `i` in terminal
- **Android Emulator**: Press `a` in terminal
- **Web**: Press `w` in terminal

## 🔑 Default Credentials

### Admin Access
- **Email**: admin@octamy.com
- **Password**: admin123
- **URL**: http://localhost:5000/admin

### Partner Access
- **Email**: partner@octamy.com  
- **Password**: password
- **URL**: http://localhost:5000/seller-auth

### Test User
- Register a new account or login with any email/password combination

## 📋 Common Commands

### Development
```bash
npm run dev          # Start full application
npm run server       # Backend only
npm run client       # Frontend only
```

### Database
```bash
npm run db:push      # Apply schema changes
npm run db:studio    # Database GUI
npm run seed         # Basic seed data
npm run seed:comprehensive  # Full demo data
```

### Production
```bash
npm run build        # Build for production
npm start           # Start production server
```

## 🛠️ Troubleshooting

### Port Already in Use
```bash
# Kill process on port 5000
lsof -i :5000
kill -9 <PID>

# Or use different port
PORT=3000 npm run dev
```

### Database Connection Issues
```bash
# Check PostgreSQL status
brew services list | grep postgresql  # macOS
sudo systemctl status postgresql      # Linux

# Test connection
psql -U postgres -d octamy_dev
```

### Import Errors (Local Development)
If you encounter `import.meta.url` errors:
```bash
# Create local vite config
cp vite.config.ts vite.config.local.ts

# Edit vite.config.local.ts and change:
define: {
  'import.meta.url': '"file://" + __filename'
}

# Run with local config
npm run dev -- --config vite.config.local.ts
```

## 📚 API Testing

### Test Endpoints
```bash
# Health check
curl http://localhost:5000/api/health

# Get courses
curl http://localhost:5000/api/courses

# Register user
curl -X POST http://localhost:5000/api/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123","firstName":"Test","lastName":"User"}'
```

## 🔄 Development Workflow

### Making Changes
1. Create feature branch: `git checkout -b feature/name`
2. Make changes and test locally
3. Run type check: `npm run type-check`
4. Commit: `git commit -m "feat: description"`
5. Push: `git push origin feature/name`

### Database Changes
1. Modify `shared/schema.ts`
2. Push changes: `npm run db:push`
3. Update seed data if needed: `npm run seed`
4. Test changes: `npm run dev`

## 📱 Mobile Development

### API Configuration
Update `octamy-mobile/OctamyMobile/src/constants/api.ts`:
```typescript
export const API_BASE_URL = 'http://localhost:5000/api';
```

### Testing Mobile Features
- **Authentication**: Register/login with web credentials
- **Courses**: Browse same courses as web version
- **Exams**: Take timed exams with auto-submit
- **Certificates**: View and share certificates
- **Offline**: Test airplane mode functionality

## 🚀 Production Deployment

### Quick Deploy to Replit
1. Push code to GitHub
2. Import to Replit
3. Set environment variables
4. Deploy using Replit Deployments

### Environment Variables (Production)
```env
NODE_ENV=production
DATABASE_URL=<production-database-url>
JWT_SECRET=<secure-production-secret>
PAYUMONEY_MERCHANT_ID=<live-merchant-id>
PAYUMONEY_MERCHANT_KEY=<live-merchant-key>
PAYUMONEY_SALT=<live-salt>
```

## 📞 Support

- **Documentation**: See `LOCAL_SETUP.md` for detailed setup
- **Mobile Guide**: See `octamy-mobile/MOBILE_PREVIEW.md`
- **Advanced Features**: See `PHASE_5_DOCUMENTATION.md`
- **Issues**: Create GitHub issue with error details

## ✅ Verification Checklist

After setup, verify these work:
- [ ] Web app loads at http://localhost:5000
- [ ] Admin login works
- [ ] Course browsing works  
- [ ] Exam submission works
- [ ] Certificate generation works
- [ ] Mobile app connects to local API
- [ ] Database queries execute successfully

Ready to develop! 🎉