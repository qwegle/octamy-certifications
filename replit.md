# Octamy Platform - Replit Development Guide

## Project Overview
Comprehensive professional certification platform with AI-powered interviews, integrated payment systems, and now includes a separate recruiter portal for talent acquisition.

## Architecture
- **Frontend**: React + TypeScript + Tailwind CSS + Wouter routing
- **Backend**: Express.js + Node.js + TypeScript  
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: JWT tokens with secure session management
- **Payments**: PayUMoney integration for Indian market
- **File Storage**: Cloudinary for document uploads
- **AI**: OpenAI GPT-4o for interview analysis and scoring

## Key Features
### Main Platform
- Multi-domain certifications (AI, Development, Business, Internships)
- AI-powered video interview system with screen recording
- Advanced question management with multiple choice and AI interactions
- Certificate generation with QR codes and verification
- Admin dashboard with comprehensive analytics
- Seller/partner referral system

### Recruiter Portal (NEW)
- **Location**: `/recruiter` folder - completely separate feature
- **Routes**: `/recruiter/auth`, `/recruiter/dashboard`, `/recruiter/search`, `/recruiter/wallet`
- **Multi-step Registration**: Individual info → Company details → KYC documents
- **Credit System**: Pay-per-access (1 credit: profile/CV, 2 credits: interviews)
- **Advanced Search**: Filter by technology, experience, location, work type
- **Authentication**: Separate JWT system with KYC verification workflow

## Recent Changes
### 2025-01-02: Comprehensive Test Suite Implementation
- Created complete Jest-based testing framework with 65+ test cases
- Implemented unit tests for authentication, courses, exams, and certificates
- Added integration tests for all API endpoints with proper authentication
- Created test database setup with automated cleanup between tests
- Added test documentation covering all testing scenarios and best practices
- Test suite covers: user registration/login, course CRUD, exam flow, certificate generation
- Configured Jest with TypeScript and ES modules support
- Added comprehensive error handling and security testing scenarios

### 2025-01-02: Partners Login and Slug-Based URL Generation Fix
- ✅ Verified partners/sellers login functionality working correctly
- ✅ Fixed referral URL generation to use course slugs instead of IDs
- ✅ Updated both SellerController and direct routes to use slug-based URLs
- ✅ Tested complete workflow: login → generate URL → track referral clicks
- ✅ URLs now generate as `/course/business-strategy-fundamentals?ref=CODE` instead of `/course/36?ref=CODE`
- ✅ Referral tracking and shareable items endpoints functioning properly

### 2025-01-02: AI Interview Retake Functionality Implementation
- ✅ Added retake button for completed AI interviews in interview history
- ✅ Modified backend logic to allow retakes for completed interviews (only blocks uncompleted paid interviews)
- ✅ Updated interview initiation to check for non-completed interviews instead of all paid interviews
- ✅ Enhanced UI with proper button styling and loading states for retake functionality
- ✅ Users can now retake any completed interview for ₹99 by clicking "Retake" button
- ✅ Payment flow works correctly for retakes, generating new transaction IDs and interview records

### 2025-01-02: Tawk.to Live Chat Integration & Demo Test Course
- ✅ Added Tawk.to live chat widget to help center page with real credentials
- ✅ Made Live Chat section clickable with hover effects and proper UX
- ✅ Implemented proper script loading and cleanup for chat widget
- ✅ Created "Certification System Test" course in database for testing purposes
- ✅ Demo course: ID 45, Price ₹1.00, 1 question, 80% passing score, slug: demo-test-course
- ✅ Perfect for testing payment flow and certification system with minimal cost
- ✅ Updated course name from "Demo Test Course" to "Certification System Test" based on question content
- ✅ Updated "Test Course Update" to "Digital Marketing Fundamentals" based on 15 marketing questions covering SEO, PPC, social media, email marketing, and analytics

### 2025-01-23: Premium UI Redesign for Recruiter Portal
- Redesigned authentication page with split-screen layout (left: branding/quotes, right: forms)
- Implemented black and white premium startup branding throughout
- Enhanced onboarding flow with professional step indicators and improved UX
- Updated dashboard with gradient cards and modern status indicators
- Redesigned wallet interface with premium pricing cards and better visual hierarchy
- Applied consistent black/white theme across all recruiter components

### 2025-01-24: Complete Rating/Review System with SEO
- Implemented comprehensive user rating and review system for courses/exams
- Added database tables: ratings, rating_aggregates with real-time calculations
- Updated exam URLs to use slugs (/exam/course-slug instead of /exam/id)
- Added slug field to courses table with auto-generation from titles
- Integrated rating components throughout course cards, detail pages, and exam results
- Added SEO structured data (JSON-LD) for courses and exams with rating information
- Implemented Helmet for dynamic meta tags and canonical URLs
- Rating system includes: star ratings, reviews, aggregate calculations, user-specific ratings
- Post-exam rating prompt for authenticated users who pass
- Search engine optimization for better Google rankings with rich snippets

### 2025-01-22: Recruiter Portal Implementation
- Created complete recruiter portal in `/recruiter` folder
- Built multi-step onboarding wizard with form validation
- Implemented credit-based access system for candidate data
- Added advanced search with multiple filter options
- Created separate authentication system for recruiters
- Integrated with existing user/certificate/interview data
- Added wallet system for credit management and transactions

### Authentication Issues Fixed
- Resolved JWT token expiration handling across all components
- Fixed import conflicts between auth.ts and auth.tsx files
- Updated logout functionality to work consistently
- Added proper token validation and cleanup

## Database Schema
### Main Platform Tables
- `users`, `courses`, `categories`, `questions`, `certificates`
- `exam_attempts`, `interviews`, `interview_questions`
- `sellers`, `referral_clicks`, `referral_conversions`

### Recruiter Portal Tables (NEW)
- `recruiters`: Multi-step registration data with KYC status
- `credit_transactions`: Credit purchases and spending history
- `profile_access_logs`: Tracks candidate profile access
- `saved_searches`: Recruiter's saved search filters

## Environment Configuration
Required secrets:
- `DATABASE_URL`, `JWT_SECRET`
- `CLOUDINARY_*` (for file uploads)
- `OPENAI_API_KEY` (for AI features)
- `PAYUMONEY_*` (for payments)

## Development Guidelines
- Use TypeScript strictly with proper type definitions
- Follow component separation (auth, pages, components, utils)
- Maintain separate routing for main platform vs recruiter portal
- Credit system calculations must be precise for billing accuracy
- KYC verification workflow requires admin approval process

## Testing Infrastructure
### Test Suite Structure
- **Unit Tests** (`tests/unit/`): Authentication, courses, exams, certificates
- **Integration Tests** (`tests/integration/`): API endpoints and workflows
- **Jest Configuration**: ES modules, TypeScript, database integration
- **Coverage**: 65+ test cases covering all critical functionality

### Testing Commands
- `npx jest` - Run all tests with Jest
- `npx jest --coverage` - Generate coverage reports
- `npx jest tests/unit` - Run unit tests only
- `npx jest tests/integration` - Run integration tests only

### Test Database Management
- Automated setup/teardown with PostgreSQL test pool
- Clean state between tests with comprehensive cleanup
- Mock external services (OpenAI, Cloudinary, PayUMoney)
- Test data factories for consistent test scenarios

## Deployment Notes
- Multi-step database migrations required for recruiter tables
- Separate auth contexts prevent interference between platforms
- Credit transaction logging ensures financial audit trail
- File upload integration works with existing Cloudinary setup

## User Credentials (Testing)
- **Main Platform**: `nitikeshpro@gmail.com` / `nitikesh123`
- **Admin**: `admin@octamy.com` / `admin123`
- **Recruiter Portal**: New registrations via `/recruiter/auth`