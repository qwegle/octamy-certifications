# Octamy Professional Certification Platform

## Overview

Octamy is a comprehensive professional certification platform built as a full-stack web application. It enables users to take online assessments across various domains (AI, Development, Business, Internships) and obtain verified certificates upon successful completion.

## Architecture

### MVC Structure
The application follows a clean MVC (Model-View-Controller) architecture:

```
server/
├── controllers/         # Business logic handlers
│   ├── authController.ts
│   ├── courseController.ts
│   ├── examController.ts
│   ├── certificateController.ts
│   └── paymentController.ts
├── middleware/          # Authentication and validation
│   └── auth.ts
├── models/             # Database models (Drizzle ORM)
├── routes/             # API route definitions
│   └── index.ts
├── utils/              # Utility functions
└── storage.ts          # Database storage interface
```

### Database Schema
- **Users**: Authentication and profile management
- **Categories**: Course categorization (AI, Development, Business, Internships)
- **Courses**: Course metadata with pricing and passing scores
- **Questions**: Multiple-choice questions with correct answers
- **Exam Attempts**: User exam submissions with scoring
- **Certificates**: Generated certificates with verification
- **Payments**: PayUMoney payment gateway integration
- **Sellers**: Partner/affiliate system with commission tracking

## Technology Stack

### Frontend
- **React 18** with TypeScript
- **Wouter** for client-side routing
- **TanStack Query** for server state management
- **Tailwind CSS** with shadcn/ui components
- **Vite** for development and production builds

### Backend
- **Node.js** with Express.js framework
- **TypeScript** with ES modules
- **PostgreSQL** with Drizzle ORM
- **JWT** authentication with bcrypt password hashing
- **PayUMoney** payment gateway integration

## Setup Instructions

### Prerequisites
- Node.js 18+ 
- PostgreSQL database
- PayUMoney merchant account (for payments)

### Environment Variables
Create a `.env` file in the root directory:

```env
# Database
DATABASE_URL=postgresql://username:password@localhost:5432/octamy

# JWT Secret
JWT_SECRET=your-jwt-secret-key

# PayUMoney Configuration
PAYUMONEY_MERCHANT_ID=your-merchant-id
PAYUMONEY_MERCHANT_KEY=your-merchant-key
PAYUMONEY_SALT=your-salt-key
```

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd octamy-platform
```

2. **Install dependencies**
```bash
npm install
```

3. **Setup database**
```bash
# Push database schema
npm run db:push

# Seed initial data
npm run seed
```

4. **Start development server**
```bash
npm run dev
```

The application will be available at `http://localhost:5000`

## Development

### Database Operations
```bash
# Push schema changes
npm run db:push

# Generate migration files
npm run db:generate

# View database in browser
npm run db:studio
```

### API Endpoints

#### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login

#### Courses
- `GET /api/categories` - Get all categories
- `GET /api/courses` - Get all courses
- `GET /api/courses/:id` - Get specific course
- `GET /api/courses/category/:categoryId` - Get courses by category

#### Exams
- `POST /api/exam/submit` - Submit exam attempt
- `GET /api/exam/results/:id` - Get exam results

#### Certificates
- `POST /api/certificates/create` - Create certificate
- `GET /api/certificates/:id/download` - Download certificate
- `GET /api/certificates/verify/:certificateId` - Verify certificate

#### Payments
- `POST /api/payment/initiate` - Initiate payment
- `POST /api/payment/success` - Payment success callback
- `POST /api/payment/failure` - Payment failure callback

## Features

### Core Features
- **Multi-domain Assessments**: AI, Development, Business, and Internship certifications
- **Timed Examinations**: Countdown timers with automatic submission
- **Certificate Generation**: Professional PDF certificates with verification codes
- **Payment Integration**: Secure PayUMoney payment processing
- **Admin Panel**: Course and question management

### Advanced Features
- **Seller/Partner System**: 10% commission tracking with withdrawal management
- **Smart Notifications**: Personalized course recommendations
- **Progress Tracking**: Interactive course progress visualization
- **Achievement System**: Performance-based badges and leaderboards
- **Certificate Verification**: Public verification system

### Security Features
- **JWT Authentication**: Secure token-based authentication
- **Password Hashing**: bcrypt password encryption
- **SSL Enforcement**: HTTPS redirection for payment security
- **Anti-fraud Measures**: Payment verification and validation

## Deployment

### Production Build
```bash
# Build frontend assets
npm run build

# Start production server
npm start
```

### Environment Configuration
Ensure all environment variables are set in production:
- Database connection string
- JWT secret key
- Canonical `APP_URL` (for example `https://octamy.com`)
- Google OAuth web client ID and secret, with the user and seller callback URLs from `.env.example`
- PayUMoney credentials
- SSL certificates for HTTPS

### Product differentiation

Octamy's core promise is the **Skill Evidence Passport**: a portable record that
connects a learner's identity, scored assessment, credential tier, and live QR
verification. Courses may prepare a learner, but the passport is the durable,
inspectable proof that institutions and hiring teams can trust.

## Common Issues & Solutions

### Local Development Issues

1. **Import.meta.url Error**
```bash
# If you encounter import.meta.url issues, ensure Node.js 18+ is installed
node --version
```

2. **Database Connection Issues**
```bash
# Verify PostgreSQL is running
sudo service postgresql status

# Check database connection
npm run db:studio
```

3. **Environment Variables Not Loading**
```bash
# Ensure .env file is in root directory
# Verify dotenv configuration in vite.config.ts
```

4. **Port Conflicts**
```bash
# Change port in package.json dev script if needed
"dev": "NODE_ENV=development tsx server/index.ts --port=3000"
```

## API Documentation

### Authentication Flow
1. User registers/logs in via `/api/auth/register` or `/api/auth/login`
2. JWT token returned and stored in localStorage
3. Token included in Authorization header for protected routes
4. Middleware validates token and adds user to request object

### Payment Flow
1. User initiates payment via `/api/payment/initiate`
2. PayUMoney form generated with secure hash
3. User redirected to PayUMoney gateway
4. Success/failure callbacks handle payment completion
5. Certificate automatically generated on successful payment

### Certificate Generation
1. User completes exam with passing score
2. Certificate data validated and stored
3. PDF generated with professional styling
4. Verification code created for public verification
5. Certificate available for download and verification

## Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/new-feature`
3. Commit changes: `git commit -am 'Add new feature'`
4. Push to branch: `git push origin feature/new-feature`
5. Submit pull request

## License

This project is proprietary software. All rights reserved.

## Support

For technical support or questions:
- Email: support@octamy.com
- Documentation: [Internal Wiki]
- Issues: [GitHub Issues]

---

**Note**: This platform is designed for professional certification and assessment. Ensure all content and assessments meet industry standards and regulatory requirements.
