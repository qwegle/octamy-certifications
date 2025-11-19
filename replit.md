# Octamy Platform - Replit Development Guide

## Overview
Octamy is a comprehensive professional certification platform featuring AI-powered interviews, integrated payment systems, and a dedicated recruiter portal. The platform offers multi-domain certifications, advanced question management, and secure certificate generation with QR code verification. Its business vision is to provide a robust solution for skill validation and talent acquisition, aiming for significant market potential in professional development and recruitment.

## User Preferences
I want to use iterative development. Ask me before making major changes. I prefer detailed explanations.

## System Architecture
The platform is built with a React, TypeScript, Tailwind CSS, and Wouter frontend, an Express.js, Node.js, and TypeScript backend, and a PostgreSQL database with Drizzle ORM. Authentication is managed via JWT tokens.

**UI/UX Decisions:**
- **Main Platform:** Standardized navigation with a shared `Header` component (white background, black text, dark logo), consistent UI across landing, exams, public sector, leaderboard, and help center pages. Individual course images are high-quality and course-specific, utilizing an intelligent image mapping system.
- **Recruiter Portal:** Premium black and white branding with a split-screen authentication page, professional step indicators for onboarding, gradient cards and modern status indicators on the dashboard, and a visually hierarchical wallet interface.

**Technical Implementations:**
- **AI Integration:** OpenAI GPT-4o for interview analysis and scoring.
- **Payment Gateway:** PayUMoney integration for the Indian market.
- **File Storage:** Cloudinary for document uploads, especially for interview videos and KYC documents.
- **Authentication:** Separate JWT systems for the main platform and the recruiter portal, including Google OAuth2 integration for both users and sellers. KYC verification workflow for recruiters.
- **Certification:** QR code generation and verification for certificates.
- **Search & Filtering:** Advanced search capabilities for recruiters, including filters by technology, experience, location, and work type.
- **Rating/Review System:** Comprehensive user rating and review system for courses/exams, including aggregate calculations and SEO-friendly structured data (JSON-LD) with dynamic meta tags via Helmet.
- **Recruiter Credit System:** A pay-per-access model for candidate profiles and interviews, with credit deduction, transaction logging, and secure video access.
- **Referral System:** Seller/partner referral system with slug-based URL generation for tracking.
- **Live Chat:** Tawk.to live chat integration on the help center page.

**Feature Specifications:**
- **Main Platform:** Multi-domain certifications (AI, Development, Business, Internships), AI-powered video interview system with screen recording, advanced question management, certificate generation, admin dashboard with analytics, seller/partner referral system.
- **Recruiter Portal:** Located in the `/recruiter` folder with dedicated routes (`/recruiter/auth`, `/recruiter/dashboard`, `/recruiter/search`, `/recruiter/wallet`). Features multi-step registration, a credit system for accessing candidate data, and advanced search functionality.
- **AI Interview Retake:** Users can retake completed AI interviews for a fee, triggering a new payment flow and interview record.

**System Design Choices:**
- Strict TypeScript usage with proper type definitions.
- Component separation (auth, pages, components, utils).
- Separate routing for main platform and recruiter portal to prevent interference.
- Credit system calculations are precise for billing accuracy.
- KYC verification workflow requires an admin approval process.
- Robust testing infrastructure with Jest for unit and integration tests, covering critical functionalities.
- Multi-step database migrations for recruiter tables.

## External Dependencies
- **Database:** PostgreSQL
- **AI Services:** OpenAI GPT-4o
- **Cloud Storage:** Cloudinary
- **Payment Gateway:** PayUMoney
- **Authentication:** Google OAuth2 (via `passport-google-oauth20`)
- **Live Chat:** Tawk.to