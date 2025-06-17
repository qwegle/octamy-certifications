# Octamy Professional Certification Platform

## Overview

Octamy is a comprehensive professional certification platform built as a full-stack web application. It enables users to take online assessments across various domains (AI, Development, Business, Internships) and obtain verified certificates upon successful completion. The platform features a modern React frontend with a Node.js/Express backend, using PostgreSQL for data persistence and Drizzle ORM for database operations.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter for client-side routing
- **State Management**: TanStack Query (React Query) for server state management
- **UI Framework**: Tailwind CSS with shadcn/ui component library
- **Build Tool**: Vite for development and production builds
- **Authentication**: JWT-based authentication with context provider pattern

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: JWT tokens with bcrypt for password hashing
- **API Design**: RESTful API endpoints
- **Session Management**: JWT-based stateless authentication

### Data Storage Solutions
- **Primary Database**: PostgreSQL hosted on Neon serverless platform
- **ORM**: Drizzle ORM with connection pooling
- **Database Schema**: Comprehensive schema with users, categories, courses, questions, exam attempts, certificates, and payments
- **Migrations**: Drizzle Kit for database migrations and schema management

## Key Components

### Database Schema
- **Users**: User authentication and profile management with admin roles
- **Categories**: Course categorization (AI, Development, Business, Internships)
- **Courses**: Course metadata including duration, pricing, and passing scores
- **Questions**: Multiple-choice questions with correct answer tracking
- **Exam Attempts**: User exam submissions with scoring
- **Certificates**: Generated certificates with verification capabilities
- **Payments**: Payment processing integration with Razorpay

### Authentication and Authorization
- JWT-based authentication with secure token storage
- Role-based access control (admin vs regular users)
- Protected routes and API endpoints
- Optional authentication middleware for public routes

### UI Components
- Comprehensive shadcn/ui component library integration
- Responsive design with mobile-first approach
- Dark mode support through CSS custom properties
- Accessible components following ARIA guidelines

### Exam System
- Timed examinations with countdown timers
- Real-time progress tracking
- Automatic submission on timeout
- Score calculation and pass/fail determination

## Data Flow

1. **User Registration/Login**: Users authenticate through JWT tokens stored in localStorage
2. **Course Selection**: Users browse categorized courses and select assessments
3. **Exam Taking**: Timed multiple-choice exams with progress tracking
4. **Result Processing**: Automatic scoring and certificate generation
5. **Payment Processing**: Razorpay integration for certificate purchases
6. **Certificate Generation**: PDF certificates with verification codes
7. **Certificate Verification**: Public verification system for certificate authenticity

## External Dependencies

### Core Dependencies
- **Database**: Neon PostgreSQL serverless database
- **Payment Processing**: Razorpay payment gateway
- **UI Components**: Radix UI primitives with shadcn/ui styling
- **Form Handling**: React Hook Form with Zod validation
- **HTTP Client**: Native fetch API with TanStack Query

### Development Tools
- **TypeScript**: Type safety across frontend and backend
- **ESBuild**: Fast backend compilation for production
- **PostCSS**: CSS processing with Tailwind CSS
- **Drizzle Kit**: Database migration and introspection tools

## Deployment Strategy

### Development Environment
- **Runtime**: Node.js 20 with Replit integration
- **Database**: PostgreSQL 16 module in Replit
- **Hot Reload**: Vite HMR for frontend, tsx for backend development
- **Port**: Application runs on port 5000

### Production Build
- **Frontend**: Vite production build with static asset optimization
- **Backend**: ESBuild compilation to single bundle
- **Deployment**: Replit Autoscale deployment target
- **Environment**: Production environment variable configuration

### Build Process
1. Frontend assets compiled to `dist/public`
2. Backend compiled to `dist/index.js`
3. Static file serving in production mode
4. Database migrations applied via Drizzle Kit

## Recent Updates

### Simplified Exam Scoring Logic (June 17, 2025)
- **Fixed critical exam bug** where 100% scores were failing due to complex retake system
- **Simplified passing logic** to use each course's defined passing score (e.g., 60% for Demo Course)
- **Removed confusing retake requirements** that prevented high scores from passing
- **Updated response messages** to show correct passing thresholds from course settings
- **Streamlined exam logic** making it easy to understand: score >= course.passingScore = pass
- **Developer-friendly code structure** with clear comments explaining the simple passing criteria

### Interactive Course Recommendation System with Personalized Learning Paths (June 17, 2025)
- **Complete learning path system** with structured course sequences and progress tracking
- **Advanced recommendation engine** analyzing user behavior, preferences, and completion patterns
- **Skill assessment integration** for personalized learning path suggestions based on competency levels
- **Learning path controller** with sophisticated algorithms for course recommendations and path matching
- **Database schema extensions** for learning paths, user enrollments, skill assessments, and progress tracking
- **Frontend learning paths page** with discovery, enrollment, progress visualization, and recommendation tabs
- **Navigation integration** making learning paths accessible through the main header navigation
- **Comprehensive API endpoints** for learning path management, enrollment, and recommendation generation
- **User preference tracking** for category preferences, learning goals, and notification settings
- **Smart recommendation algorithms** considering completion history, skill levels, and trending courses

### Production Deployment Documentation and Build System (June 17, 2025)
- **Comprehensive deployment guide** with DEPLOYMENT.md covering all deployment scenarios
- **Automated build script** (build.sh) with complete production preparation workflow
- **Multiple deployment options** including traditional server, Docker, PM2, and cloud platforms
- **Security hardening** with SSL configuration, environment management, and monitoring setup
- **Database migration** and backup strategies for production environments
- **Performance optimization** guidelines with caching, compression, and load balancing
- **Docker configuration** with multi-stage builds and health checks
- **PM2 ecosystem** configuration for process management and clustering
- **Nginx reverse proxy** setup with SSL termination and static file serving

### Certificate Management System Fixes (June 17, 2025)
- **Prevented duplicate certificates** - only one certificate per user per course allowed
- **Best score tracking** - users can only purchase certificates for improved scores
- **Fixed certificate count display** - home page now shows actual certified users instead of 0
- **Enhanced certificate creation logic** - updates existing certificates with better performance
- **Resolved checkout flow issues** - proper certificate retrieval and payment processing
- **Database integrity** - comprehensive certificate validation and duplicate prevention

### Comprehensive Sponsor Support System (June 17, 2025)
- **Interactive sponsor page** with custom payment amounts and preset options (₹1 to ₹1,000,000)
- **Team member showcase** featuring Qwegle team information and professional backgrounds
- **Future roadmap display** highlighting AI-based learning paths, skill improvement, and career guidance
- **Current features overview** showcasing existing platform capabilities and achievements
- **Unique value propositions** section explaining Octamy's competitive advantages
- **PayUMoney payment integration** for secure sponsor payment processing with transaction tracking
- **Database schema** with sponsors table for donation tracking and payment status management
- **Navigation integration** with "Sponsors" links in both desktop and mobile headers (removed Business Pricing)
- **API endpoints** for sponsor creation, payment processing, and transaction status updates

### Click Tracking Analytics and Certificate Display Fixes (June 17, 2025)
- **Fixed click tracking analytics** - referral link clicks now properly recorded in database
- **Resolved database schema issues** - added missing conversion_date column for proper tracking
- **Partner dashboard analytics working** - shows real-time click data with course-wise breakdown
- **Certificate course names displaying correctly** - API and frontend alignment verified
- **Referral URL generation and tracking** - complete flow from generation to analytics working
- **Database column mapping fixed** - storage methods now use correct schema field names

### Enhanced Checkout System with Physical Certificate Shipping (June 17, 2025)
- **Complete address management system** with CRUD operations for user shipping addresses
- **Physical certificate shipping option** with ₹50 additional cost for premium paper delivery
- **Enhanced checkout page** with dual certificate options (digital-only vs digital + physical)
- **Default address management** with user-friendly address selection interface
- **Database schema extensions** for shipping addresses, payment amounts, and physical copy tracking
- **API endpoints** for comprehensive address management and shipping cost calculation
- **Updated course detail flow** directing users through enhanced checkout instead of direct exam access
- **Seamless integration** with existing payment gateway supporting physical certificate orders

### Complete MVC Architecture Refactoring (June 17, 2025)
- **Full MVC structure implementation** with separated controllers, middleware, and routes
- **Modular controller architecture** with AuthController, CourseController, ExamController, CertificateController, and PaymentController
- **Authentication middleware** with proper JWT token validation and user context
- **Database-first approach** removing all dummy JSON data in favor of admin-manageable database content
- **Comprehensive storage interface** with all required methods for database operations
- **Professional certificate generator** with HTML-based PDF generation and premium styling
- **Clean separation of concerns** for better maintainability and scalability
- **Fixed exam submission 401 Unauthorized error** by resolving routing conflicts between MVC and legacy routes
- **Optional authentication support** for anonymous exam submissions working correctly

### Seller/Partner System Implementation (June 16, 2025)
- **Complete seller authentication system** with separate registration/login
- **10% commission tracking** on all course sales with referral code system
- **Real-time analytics dashboard** showing earnings, sales, and withdrawal history
- **UPI and bank account withdrawal** system with admin approval workflow
- **Admin seller management** for approval/rejection of partner accounts
- **Commission calculation and tracking** with pending/paid status management

### Black and White Cred-Style Branding (June 16, 2025)
- **Complete UI redesign** with black and white Cred-inspired aesthetic
- **Bold typography** with high contrast design elements
- **Minimalist interface** focusing on functionality and professionalism
- **Updated landing page** with partner program integration
- **Consistent branding** across all pages and components

### PayUMoney Payment Gateway Integration (June 16, 2025)
- **Complete PayUMoney integration** with secure hash generation and verification
- **Payment initiation API** with proper form generation for PayUMoney gateway
- **Success and failure callback handling** with automatic certificate generation
- **Commission tracking integration** with seller referral codes during payment
- **Payment status verification** and transaction tracking system
- **Secure payment forms** with 256-bit SSL encryption and fraud protection

### Database Schema Extensions
- **Sellers table** with approval status, earnings tracking, and payment details
- **Sales table** for commission tracking with referral codes
- **Withdrawal requests table** with UPI/bank account support and admin processing
- **Payment tracking** with PayUMoney transaction IDs and gateway responses
- **Smart notifications tables** for user preferences, notifications, course recommendations, and activity tracking
- **Complete relations** between users, sellers, sales, withdrawals, payments, and smart notification system

## Local Development Support

### README Documentation
- **Comprehensive setup guide** for Windows and Mac development environments
- **Environment configuration** with detailed .env file examples
- **Common issues solutions** including dotenv and import.meta.url fixes
- **Database setup instructions** with PostgreSQL configuration
- **API documentation** with all endpoint specifications
- **Deployment guidelines** for production environments

### Development Configuration Fixes
- **Local vite.config.ts** compatibility for import.meta.url issues
- **Environment variable loading** with proper dotenv configuration
- **Database connection** setup for local PostgreSQL instances
- **Port management** solutions for development conflicts

## Changelog

```
Changelog:
- June 17, 2025: Created comprehensive sponsor support system with interactive payment page, team showcase, and PayUMoney integration
- June 17, 2025: Added sponsor page to navigation with "Support Us" links in desktop and mobile headers
- June 17, 2025: Built sponsors database table with payment tracking and transaction status management
- June 17, 2025: Implemented comprehensive exam scoring logic with developer-friendly comments throughout codebase
- June 17, 2025: Added improved exam passing rules: First-time users need ≥50%, retakers need higher than previous best
- June 17, 2025: Created getExamAttemptsByUserAndCourse storage method for retake logic validation
- June 17, 2025: Enhanced exam submission response with detailed retake information and helpful user messages  
- June 17, 2025: Updated certificate creation logic to only generate certificates for actual passing attempts
- June 17, 2025: Added comprehensive developer comments to dashboard, storage, and routes for code maintainability
- June 17, 2025: Fixed critical seller authentication infinite redirect loop between /seller-auth and /partner-dashboard
- June 17, 2025: Fixed payment loading issue - certificates now created automatically after passing exams
- June 17, 2025: Added seller-auth route (/seller-auth) for proper partner authentication access
- June 17, 2025: Created learning_paths and user_learning_paths database tables for learning path functionality
- June 17, 2025: Removed playful mascot character system as requested - not well defined
- June 17, 2025: Fixed critical dashboard validCertificates error by using correct variable name
- June 17, 2025: Simplified exam success flow to prevent premature certificate creation
- June 17, 2025: Proper exam → checkout redirect only when exam is passed
- June 17, 2025: Complete MVC architecture refactoring with modular controllers, middleware, and database-first approach
- June 17, 2025: Implemented AuthController, CourseController, ExamController, CertificateController, and PaymentController
- June 17, 2025: Added comprehensive authentication middleware with JWT token validation
- June 17, 2025: Created professional certificate generator with HTML-based PDF generation
- June 17, 2025: Removed all dummy JSON data in favor of admin-manageable database content
- June 17, 2025: Added comprehensive README documentation with setup instructions and API documentation
- June 16, 2025: Added comprehensive README with Windows/Mac setup instructions and local development fixes
- June 16, 2025: Documented solutions for common development issues including dotenv and import.meta.url problems
- June 16, 2025: Interactive course progress visualization with animated achievement unlocks fully implemented
- June 16, 2025: Authentication integration with proper error handling and progress page routing completed
- June 16, 2025: Redesigned certificates with premium professional styling featuring Playfair Display and Inter fonts
- June 16, 2025: Added ornate corners, sophisticated black borders, and luxury typography to certificates
- June 16, 2025: Enhanced certificate branding with proper Octamy Solutions company information
- June 16, 2025: Synchronized certificate preview and download versions with identical premium styling
- June 16, 2025: Implemented professional certificate layout matching high-end certification standards
- June 16, 2025: Fixed certificate download functionality with HTML-based solution and print-to-PDF capability
- June 16, 2025: Resolved ES module compatibility issues in PDF generation endpoint
- June 16, 2025: Updated both certificate page and dashboard download handlers to work with new HTML format
- June 16, 2025: Enhanced payment security with SSL enforcement and comprehensive security headers
- June 16, 2025: Fixed certificate delivery after successful payment with proper success callback
- June 16, 2025: Added payment success/failure pages with proper certificate access
- June 16, 2025: Implemented hack-proof checkout process with HTTPS redirection and anti-fraud measures
- June 16, 2025: Enhanced PayUMoney form with security headers and encrypted form submission
- June 16, 2025: Fixed SmartNotifications runtime error with proper null checks and data structure handling
- June 16, 2025: Fixed authentication token handling for Generate Recommendations feature
- June 16, 2025: Resolved localStorage key mismatch between authToken and token in API client
- June 16, 2025: Smart notifications and recommendations system now fully functional
- June 16, 2025: Updated PayUMoney to production environment with live credentials
- June 16, 2025: Fixed critical exam submission and certificate creation bugs
- June 16, 2025: Resolved pricing discrepancy from ₹199 to ₹99 in payment flow
- June 16, 2025: Added courseId field to certificate schema and updated database
- June 16, 2025: Fixed answers array format handling in exam submission API
- June 16, 2025: Implemented smart notifications system with personalized course recommendations
- June 16, 2025: Added user preferences management for learning goals and notification settings
- June 16, 2025: Created intelligent recommendation engine based on user activity and interests
- June 16, 2025: Integrated real-time notifications with activity tracking
- June 16, 2025: Integrated PayUMoney payment gateway with secure hash verification and commission tracking
- June 16, 2025: Implemented comprehensive seller/partner system with 10% commission tracking
- June 16, 2025: Applied black and white Cred-style branding across entire platform
- June 16, 2025: Added real-time analytics dashboard for partners
- June 16, 2025: Integrated UPI and bank withdrawal system with admin approval
- June 16, 2025: Initial setup and comprehensive course catalog implementation
```

## User Preferences

```
Preferred communication style: Simple, everyday language.
Branding preference: Black and white Cred-style design with minimalist aesthetic.
```