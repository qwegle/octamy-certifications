import { pgTable, text, serial, timestamp, boolean, integer, decimal, jsonb } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// Recruiters table
export const recruiters = pgTable('recruiters', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  password: text('password').notNull(),
  
  // Individual Information (Step 1)
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  phone: text('phone').notNull(),
  designation: text('designation').notNull(),
  linkedinProfile: text('linkedin_profile'),
  
  // Company Information (Step 2)
  companyName: text('company_name').notNull(),
  companyWebsite: text('company_website'),
  companySize: text('company_size').notNull(), // '1-10', '11-50', '51-200', '201-500', '500+'
  industry: text('industry').notNull(),
  companyAddress: text('company_address').notNull(),
  companyCity: text('company_city').notNull(),
  companyState: text('company_state').notNull(),
  companyCountry: text('company_country').notNull().default('India'),
  
  // KYC Information (Step 3)
  gstNumber: text('gst_number'),
  panNumber: text('pan_number'),
  companyRegistrationNumber: text('company_registration_number'),
  
  // Document URLs (uploaded to Cloudinary)
  gstCertificate: text('gst_certificate_url'),
  panCard: text('pan_card_url'),
  companyRegistrationCertificate: text('company_registration_certificate_url'),
  
  // Status and Credits
  isActive: boolean('is_active').default(true),
  kycStatus: text('kyc_status').notNull().default('pending'), // 'pending', 'under_review', 'approved', 'rejected'
  creditsBalance: decimal('credits_balance', { precision: 10, scale: 2 }).default('0.00'),
  
  // Metadata
  registrationStep: integer('registration_step').default(1), // 1, 2, 3, 4 (completed)
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  lastLoginAt: timestamp('last_login_at'),
});

// Credit transactions table
export const creditTransactions = pgTable('credit_transactions', {
  id: serial('id').primaryKey(),
  recruiterId: integer('recruiter_id').notNull().references(() => recruiters.id),
  type: text('type').notNull(), // 'purchase', 'spend', 'refund'
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  description: text('description').notNull(),
  relatedUserId: integer('related_user_id'), // User whose profile was accessed
  relatedAction: text('related_action'), // 'profile_view', 'cv_download', 'interview_access'
  balanceAfter: decimal('balance_after', { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// User profile access logs
export const profileAccessLogs = pgTable('profile_access_logs', {
  id: serial('id').primaryKey(),
  recruiterId: integer('recruiter_id').notNull().references(() => recruiters.id),
  userId: integer('user_id').notNull(), // References main users table
  accessType: text('access_type').notNull(), // 'profile_view', 'cv_download', 'interview_access'
  creditsUsed: decimal('credits_used', { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Saved searches/filters
export const savedSearches = pgTable('saved_searches', {
  id: serial('id').primaryKey(),
  recruiterId: integer('recruiter_id').notNull().references(() => recruiters.id),
  name: text('name').notNull(),
  filters: jsonb('filters').notNull(), // JSON object with all filter criteria
  createdAt: timestamp('created_at').defaultNow(),
});

// Insert schemas for form validation
export const insertRecruiterSchema = createInsertSchema(recruiters).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastLoginAt: true,
});

export const insertCreditTransactionSchema = createInsertSchema(creditTransactions).omit({
  id: true,
  createdAt: true,
});

export const insertProfileAccessLogSchema = createInsertSchema(profileAccessLogs).omit({
  id: true,
  createdAt: true,
});

export const insertSavedSearchSchema = createInsertSchema(savedSearches).omit({
  id: true,
  createdAt: true,
});

// Types
export type Recruiter = typeof recruiters.$inferSelect;
export type InsertRecruiter = z.infer<typeof insertRecruiterSchema>;
export type CreditTransaction = typeof creditTransactions.$inferSelect;
export type InsertCreditTransaction = z.infer<typeof insertCreditTransactionSchema>;
export type ProfileAccessLog = typeof profileAccessLogs.$inferSelect;
export type InsertProfileAccessLog = z.infer<typeof insertProfileAccessLogSchema>;
export type SavedSearch = typeof savedSearches.$inferSelect;
export type InsertSavedSearch = z.infer<typeof insertSavedSearchSchema>;

// Form validation schemas for each registration step
export const step1Schema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  phone: z.string().min(10, 'Valid phone number is required'),
  designation: z.string().min(1, 'Designation is required'),
  linkedinProfile: z.string().url('Valid LinkedIn URL is required').optional().or(z.literal('')),
});

export const step2Schema = z.object({
  companyName: z.string().min(1, 'Company name is required'),
  companyWebsite: z.string().url('Valid website URL is required').optional().or(z.literal('')),
  companySize: z.enum(['1-10', '11-50', '51-200', '201-500', '500+'], {
    required_error: 'Company size is required',
  }),
  industry: z.string().min(1, 'Industry is required'),
  companyAddress: z.string().min(1, 'Company address is required'),
  companyCity: z.string().min(1, 'City is required'),
  companyState: z.string().min(1, 'State is required'),
  companyCountry: z.string().default('India'),
});

export const step3Schema = z.object({
  gstNumber: z.string().optional(),
  panNumber: z.string().optional(),
  companyRegistrationNumber: z.string().optional(),
  gstCertificate: z.string().optional(),
  panCard: z.string().optional(),
  companyRegistrationCertificate: z.string().optional(),
});

export type Step1Data = z.infer<typeof step1Schema>;
export type Step2Data = z.infer<typeof step2Schema>;
export type Step3Data = z.infer<typeof step3Schema>;