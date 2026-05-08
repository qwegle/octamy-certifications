import { pgTable, text, varchar, serial, integer, boolean, timestamp, decimal, json, index, jsonb, unique } from "drizzle-orm/pg-core";
import { relations, eq, desc, and, asc } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Sponsors table for donations/sponsorships
export const sponsors = pgTable("sponsors", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  amount: integer("amount").notNull(), // Amount in INR
  message: text("message"), // Optional message from sponsor
  paymentMethod: text("payment_method").default("payumoney").notNull(),
  transactionId: text("transaction_id"),
  paymentStatus: text("payment_status").default("pending").notNull(), // pending, success, failed
  isAnonymous: boolean("is_anonymous").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertSponsorSchema = createInsertSchema(sponsors).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSponsor = z.infer<typeof insertSponsorSchema>;
export type Sponsor = typeof sponsors.$inferSelect;

// Contact submissions table for contact form
export const contactSubmissions = pgTable("contact_submissions", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  status: text("status").default("new").notNull(), // new, read, responded
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
  respondedAt: timestamp("responded_at"),
  adminNotes: text("admin_notes"),
});

export const insertContactSubmissionSchema = createInsertSchema(contactSubmissions).omit({
  id: true,
  submittedAt: true,
});

export type InsertContactSubmission = z.infer<typeof insertContactSubmissionSchema>;
export type ContactSubmission = typeof contactSubmissions.$inferSelect;

// Recruiter portal tables
export const recruiters = pgTable('recruiters', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  password: text('password').notNull(),
  
  // Individual Information (Step 1)
  firstName: text('first_name').notNull().default(''),
  lastName: text('last_name').notNull().default(''),
  phone: text('phone').notNull().default(''),
  designation: text('designation').notNull().default(''),
  linkedinProfile: text('linkedin_profile'),
  
  // Company Information (Step 2)
  companyName: text('company_name').notNull().default(''),
  companyWebsite: text('company_website'),
  companySize: text('company_size').notNull().default('1-10'),
  industry: text('industry').notNull().default(''),
  companyAddress: text('company_address').notNull().default(''),
  companyCity: text('company_city').notNull().default(''),
  companyState: text('company_state').notNull().default(''),
  companyCountry: text('company_country').notNull().default('India'),
  
  // KYC Information (Step 3)
  gstNumber: text('gst_number'),
  panNumber: text('pan_number'),
  companyRegistrationNumber: text('company_registration_number'),
  
  // Document URLs
  gstCertificate: text('gst_certificate_url'),
  panCard: text('pan_card_url'),
  companyRegistrationCertificate: text('company_registration_certificate_url'),
  
  // Status and Credits
  isActive: boolean('is_active').default(true),
  kycStatus: text('kyc_status').notNull().default('pending'),
  creditsBalance: decimal('credits_balance', { precision: 10, scale: 2 }).default('0.00'),
  
  // Metadata
  registrationStep: integer('registration_step').default(1),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  lastLoginAt: timestamp('last_login_at'),
});

export const creditTransactions = pgTable('credit_transactions', {
  id: serial('id').primaryKey(),
  recruiterId: integer('recruiter_id').notNull().references(() => recruiters.id),
  type: text('type').notNull(),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  description: text('description').notNull(),
  relatedUserId: integer('related_user_id'),
  relatedAction: text('related_action'),
  balanceAfter: decimal('balance_after', { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const profileAccessLogs = pgTable('profile_access_logs', {
  id: serial('id').primaryKey(),
  recruiterId: integer('recruiter_id').notNull().references(() => recruiters.id),
  userId: integer('user_id').notNull(),
  accessType: text('access_type').notNull(),
  creditsUsed: decimal('credits_used', { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const savedSearches = pgTable('saved_searches', {
  id: serial('id').primaryKey(),
  recruiterId: integer('recruiter_id').notNull().references(() => recruiters.id),
  name: text('name').notNull(),
  filters: jsonb('filters').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const insertRecruiterSchema = createInsertSchema(recruiters).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastLoginAt: true,
});

export type Recruiter = typeof recruiters.$inferSelect;
export type InsertRecruiter = z.infer<typeof insertRecruiterSchema>;

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password"),
  name: text("name").notNull(),
  phone: text("phone"),
  company: text("company"),
  position: text("position"),
  isAdmin: boolean("is_admin").default(false).notNull(),
  
  // Google OAuth fields
  googleId: text("google_id"),
  isGoogleUser: boolean("is_google_user").default(false).notNull(),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  
  // Professional Profile Fields (for recruiters to search)
  location: text("location"),
  experience: integer("experience"), // years of experience
  currentRole: text("current_role"),
  skills: text("skills").array(), // technical skills
  availability: text("availability"), // immediate, 1-month, etc.
  noticePeriod: text("notice_period"), // 30 days, 60 days, etc.
  expectedSalary: text("expected_salary"), // salary range
  workType: text("work_type").array(), // remote, hybrid, onsite
  category: text("category").array(), // preferred job categories
  linkedinProfile: text("linkedin_profile"),
  portfolioUrl: text("portfolio_url"),
  resume: text("resume_url"),
  bio: text("bio"),
  careerGoals: text("career_goals"),
  
  // Profile visibility and metrics
  profileVisibility: boolean("profile_visibility").default(true),
  lastActive: timestamp("last_active").defaultNow(),
  profileCompleteness: integer("profile_completeness").default(0), // percentage
  
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User profile insert and update schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastActive: true,
});

export const updateUserProfileSchema = createInsertSchema(users).omit({
  id: true,
  email: true,
  password: true,
  isAdmin: true,
  createdAt: true,
  updatedAt: true,
  lastActive: true,
}).partial();

export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpdateUserProfile = z.infer<typeof updateUserProfileSchema>;
export type User = typeof users.$inferSelect;

export const userAddresses = pgTable("user_addresses", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  type: text("type").notNull().default("shipping"), // shipping, billing
  fullName: text("full_name").notNull(),
  addressLine1: text("address_line1").notNull(),
  addressLine2: text("address_line2"),
  city: text("city").notNull(),
  state: text("state").notNull(),
  postalCode: text("postal_code").notNull(),
  country: text("country").notNull().default("India"),
  phoneNumber: text("phone_number").notNull(),
  isDefault: boolean("is_default").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  icon: text("icon").notNull(),
  slug: text("slug").notNull().unique(),
});

export const courses = pgTable("courses", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  slug: text("slug").notNull().unique(),
  categoryId: integer("category_id").references(() => categories.id).notNull(),
  duration: integer("duration").notNull(), // in minutes
  passingScore: integer("passing_score").default(50).notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).default("199.00").notNull(),
  originalPrice: decimal("original_price", { precision: 10, scale: 2 }),
  isOnSale: boolean("is_on_sale").default(false).notNull(),
  saleEndDate: timestamp("sale_end_date"),
  level: text("level").notNull().default("novice"), // novice, intermediate, advanced, expert
  isActive: boolean("is_active").default(true).notNull(),
  isInternship: boolean("is_internship").default(false).notNull(),
  metaTitle: text("meta_title"),
  metaDescription: text("meta_description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const questions = pgTable("questions", {
  id: serial("id").primaryKey(),
  courseId: integer("course_id").references(() => courses.id).notNull(),
  question: text("question").notNull(),
  options: json("options").$type<string[]>().notNull(),
  correctAnswer: integer("correct_answer").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  questionType: text("question_type").default("multiple_choice").notNull(), // multiple_choice, ai_interactive
  aiScenario: text("ai_scenario"), // Detailed scenario for AI questions
  aiEvaluationCriteria: json("ai_evaluation_criteria").$type<string[]>(), // Evaluation criteria for AI
  expectedKeywords: text("expected_keywords").array(), // Keywords to look for in responses
  maxPoints: integer("max_points").default(100).notNull(), // Points for this question
  difficulty: text("difficulty").default("medium").notNull(), // easy, medium, hard
});

export const examAttempts = pgTable("exam_attempts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  courseId: integer("course_id").references(() => courses.id).notNull(),
  userEmail: text("user_email").notNull(),
  userName: text("user_name").notNull(),
  score: integer("score").notNull(),
  totalQuestions: integer("total_questions").notNull(),
  answers: json("answers").$type<Record<string, number>>().notNull(),
  timeTaken: integer("time_taken").notNull(), // in seconds
  passed: boolean("passed").notNull(),
  mastered: boolean("mastered").default(false).notNull(),
  sessionId: text("session_id"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  tabSwitches: integer("tab_switches").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const certificates = pgTable("certificates", {
  id: serial("id").primaryKey(),
  certificateId: text("certificate_id").notNull().unique(),
  examAttemptId: integer("exam_attempt_id").references(() => examAttempts.id).notNull(),
  courseId: integer("course_id").references(() => courses.id).notNull(),
  userId: integer("user_id").references(() => users.id),
  userEmail: text("user_email").notNull(),
  userName: text("user_name").notNull(),
  courseTitle: text("course_title").notNull(),
  score: integer("score").notNull(),
  mastered: boolean("mastered").default(false).notNull(),
  issuedAt: timestamp("issued_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  isPaid: boolean("is_paid").default(false).notNull(),
  paymentId: text("payment_id"),
  qrCode: text("qr_code"),
  pdfUrl: text("pdf_url"),
  isActive: boolean("is_active").default(true).notNull(),
  // New fields for enhanced certificate system
  businessName: text("business_name"),
  badge: text("badge").notNull(), // bronze, silver, gold, platinum
  certificateNumber: text("certificate_number").notNull().unique(),
  issuedBy: text("issued_by").default("Octamy Solutions Private Limited").notNull(),
  retakeCount: integer("retake_count").default(0).notNull(),
  // Physical certificate shipping
  needsPhysicalCopy: boolean("needs_physical_copy").default(false).notNull(),
  shippingAddressId: integer("shipping_address_id").references(() => userAddresses.id),
  shippingStatus: text("shipping_status").default("not_required"), // not_required, pending, processing, shipped, delivered
  trackingNumber: text("tracking_number"),
  shippedAt: timestamp("shipped_at"),
  deliveredAt: timestamp("delivered_at"),
});

export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  certificateId: integer("certificate_id").references(() => certificates.id),
  userId: integer("user_id").references(() => users.id),
  courseId: integer("course_id").references(() => courses.id),
  transactionId: text("transaction_id").notNull().unique(),
  paymentMethod: text("payment_method").default("payumoney").notNull(),
  razorpayPaymentId: text("razorpay_payment_id"),
  razorpayOrderId: text("razorpay_order_id"),

  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").default("INR").notNull(),
  status: text("status").notNull(),
  // Physical certificate shipping
  certificateAmount: decimal("certificate_amount", { precision: 10, scale: 2 }).notNull(),
  shippingAmount: decimal("shipping_amount", { precision: 10, scale: 2 }).default("0.00").notNull(),
  includesPhysicalCopy: boolean("includes_physical_copy").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const internshipApplications = pgTable("internship_applications", {
  id: serial("id").primaryKey(),
  certificateId: integer("certificate_id").references(() => certificates.id).notNull(),
  applicantName: text("applicant_name").notNull(),
  dateOfBirth: text("date_of_birth").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  durationMonths: integer("duration_months").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const sellers = pgTable("sellers", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password"),
  name: text("name").notNull(),
  phone: text("phone"),
  referralCode: text("referral_code").unique(),
  isApproved: boolean("is_approved").default(false).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  
  // Google OAuth fields
  googleId: text("google_id"),
  isGoogleUser: boolean("is_google_user").default(false).notNull(),
  commissionRate: decimal("commission_rate", { precision: 5, scale: 2 }).default("10.00").notNull(),
  totalEarnings: decimal("total_earnings", { precision: 10, scale: 2 }).default("0.00").notNull(),
  pendingEarnings: decimal("pending_earnings", { precision: 10, scale: 2 }).default("0.00").notNull(),
  upiId: text("upi_id"),
  bankAccountNumber: text("bank_account_number"),
  bankIFSC: text("bank_ifsc"),
  bankName: text("bank_name"),
  accountHolderName: text("account_holder_name"),
  panNumber: text("pan_number"),
  gstin: text("gstin"),
  address: text("address"),
  agreementAccepted: boolean("agreement_accepted").default(false).notNull(),
  agreementAcceptedAt: timestamp("agreement_accepted_at"),
  agreementVersion: text("agreement_version"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const sales = pgTable("sales", {
  id: serial("id").primaryKey(),
  sellerId: integer("seller_id").references(() => sellers.id).notNull(),
  certificateId: integer("certificate_id").references(() => certificates.id).notNull().unique(),
  courseId: integer("course_id").references(() => courses.id).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  commission: decimal("commission", { precision: 10, scale: 2 }).notNull(),
  status: text("status").default("pending").notNull(), // pending, paid
  referralCode: text("referral_code").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const withdrawalRequests = pgTable("withdrawal_requests", {
  id: serial("id").primaryKey(),
  sellerId: integer("seller_id").references(() => sellers.id).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  status: text("status").default("pending").notNull(), // pending, approved, rejected, processed
  upiId: text("upi_id"),
  bankAccountNumber: text("bank_account_number"),
  bankIFSC: text("bank_ifsc"),
  bankName: text("bank_name"),
  accountHolderName: text("account_holder_name"),
  adminNotes: text("admin_notes"),
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});



// Click tracking for partner referral links
export const referralClicks = pgTable("referral_clicks", {
  id: serial("id").primaryKey(),
  sellerId: integer("seller_id").references(() => sellers.id).notNull(),
  courseId: integer("course_id").references(() => courses.id).notNull(),
  referralCode: text("referral_code").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  clickedAt: timestamp("clicked_at").defaultNow().notNull(),
  converted: boolean("is_converted").default(false).notNull(),
  conversionDate: timestamp("conversion_date"),
  userId: integer("user_id").references(() => users.id), // set when user actually purchases
});

// Persistent exam state — replaces in-process global.questionMappings.
// Maps a session id to the per-question correct-answer index after option shuffle.
export const examSessions = pgTable("exam_sessions", {
  id: text("id").primaryKey(),
  courseId: integer("course_id"),
  correctMap: jsonb("correct_map").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
});

// Persistent payment-time exam handoff — replaces global.tempExamData.
// Holds the calculated score + metadata until PayU redirects back, at which
// point the row is consumed and an exam_attempt row is created.
export const pendingExams = pgTable("pending_exams", {
  id: text("id").primaryKey(),
  payload: jsonb("payload").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
});

// Leaderboard table for gamification
export const leaderboard = pgTable("leaderboard", {
  id: serial("id").primaryKey(),
  courseId: integer("course_id").references(() => courses.id).notNull(),
  userId: integer("user_id").references(() => users.id),
  userName: text("user_name").notNull(),
  userEmail: text("user_email").notNull(),
  score: integer("score").notNull(),
  badge: text("badge").notNull(),
  certificateId: text("certificate_id").notNull(),
  achievedAt: timestamp("achieved_at").defaultNow().notNull(),
  businessName: text("business_name"), // for business certificates
});

// Smart Notifications for Course Recommendations
export const userPreferences = pgTable("user_preferences", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  preferredCategories: json("preferred_categories").$type<string[]>().default([]),
  skillLevel: text("skill_level").default("novice").notNull(), // novice, intermediate, advanced, expert
  learningGoals: json("learning_goals").$type<string[]>().default([]),
  notificationSettings: json("notification_settings").$type<{
    email: boolean;
    push: boolean;
    frequency: 'daily' | 'weekly' | 'monthly';
    courseRecommendations: boolean;
    newCourses: boolean;
    achievements: boolean;
  }>().default({
    email: true,
    push: true,
    frequency: 'weekly',
    courseRecommendations: true,
    newCourses: true,
    achievements: true
  }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  type: text("type").notNull(), // course_recommendation, new_course, achievement, reminder
  title: text("title").notNull(),
  message: text("message").notNull(),
  data: json("data").$type<{
    courseId?: number;
    certificateId?: string;
    actionUrl?: string;
    priority?: 'low' | 'medium' | 'high';
  }>(),
  isRead: boolean("is_read").default(false).notNull(),
  isDelivered: boolean("is_delivered").default(false).notNull(),
  deliveryMethod: text("delivery_method"), // email, push, in_app
  scheduledFor: timestamp("scheduled_for"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const courseRecommendations = pgTable("course_recommendations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  courseId: integer("course_id").references(() => courses.id).notNull(),
  reason: text("reason").notNull(), // based_on_category, skill_progression, popular, trending
  score: decimal("score", { precision: 3, scale: 2 }).notNull(), // 0.00 to 1.00
  metadata: json("metadata").$type<{
    completedCourseIds?: number[];
    categoryMatch?: boolean;
    skillLevelMatch?: boolean;
    popularityScore?: number;
    trendingScore?: number;
  }>(),
  isShown: boolean("is_shown").default(false).notNull(),
  isClicked: boolean("is_clicked").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const userActivity = pgTable("user_activity", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  activityType: text("activity_type").notNull(), // course_view, exam_start, exam_complete, certificate_download
  entityId: integer("entity_id"), // courseId, examAttemptId, certificateId
  entityType: text("entity_type"), // course, exam, certificate
  metadata: json("metadata").$type<{
    timeSpent?: number;
    score?: number;
    completed?: boolean;
    deviceType?: string;
    source?: string;
  }>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Learning Paths for Personalized Course Sequences (matches actual database schema)
export const learningPaths = pgTable("learning_paths", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  difficulty: varchar("difficulty", { length: 50 }).notNull(), // beginner, intermediate, advanced
  estimatedDuration: integer("estimated_duration").notNull(), // in hours
  courseIds: integer("course_ids").array().notNull(), // ordered course IDs
  prerequisites: integer("prerequisites").array().default([]),
  categoryId: integer("category_id").references(() => categories.id).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const userLearningPaths = pgTable("user_learning_paths", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  learningPathId: integer("learning_path_id").references(() => learningPaths.id).notNull(),
  progress: integer("progress").notNull().default(0), // percentage 0-100
  completedCourses: integer("completed_courses").array().default([]),
  enrolledAt: timestamp("enrolled_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  isActive: boolean("is_active").default(true).notNull(),
});

export const skillAssessments = pgTable("skill_assessments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  categoryId: integer("category_id").references(() => categories.id).notNull(),
  skillLevel: text("skill_level").notNull(), // novice, intermediate, advanced, expert
  strengths: json("strengths").$type<string[]>().default([]),
  weaknesses: json("weaknesses").$type<string[]>().default([]),
  recommendedCourses: json("recommended_courses").$type<number[]>().default([]),
  assessmentData: json("assessment_data").$type<{
    questions?: number;
    correctAnswers?: number;
    timeSpent?: number;
    confidenceScore?: number;
  }>(),
  validUntil: timestamp("valid_until"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Course progress tracking
export const userCourseProgress = pgTable("user_course_progress", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  courseId: integer("course_id").references(() => courses.id).notNull(),
  status: text("status").notNull().default("not_started"), // not_started, in_progress, completed, failed
  progressPercentage: integer("progress_percentage").notNull().default(0),
  timeSpent: integer("time_spent").notNull().default(0), // in minutes
  bestScore: integer("best_score").notNull().default(0),
  attemptCount: integer("attempt_count").notNull().default(0),
  streakDays: integer("streak_days").notNull().default(0),
  lastActivity: timestamp("last_activity").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Achievement system
export const achievements = pgTable("achievements", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  icon: text("icon").notNull(),
  category: text("category").notNull(), // completion, performance, engagement, special
  tier: text("tier").notNull(), // bronze, silver, gold, platinum, diamond
  criteria: json("criteria").$type<{
    type: 'completion_count' | 'score' | 'time_spent' | 'streak' | 'perfect_score' | 'speed';
    threshold: number;
    courseId?: number;
    categoryId?: number;
  }>().notNull(),
  points: integer("points").notNull().default(10),
  rarity: text("rarity").notNull().default("common"), // common, rare, epic, legendary
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// User achievements tracking
export const userAchievements = pgTable("user_achievements", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  achievementId: integer("achievement_id").references(() => achievements.id).notNull(),
  unlockedAt: timestamp("unlocked_at").defaultNow().notNull(),
  progress: integer("progress").notNull().default(100), // 0-100 for partial achievements
  metadata: json("metadata").$type<{
    scoreAchieved?: number;
    courseId?: number;
    examAttemptId?: number;
    timeSpent?: number;
    streak?: number;
    categoryId?: number;
  }>(),
  isViewed: boolean("is_viewed").notNull().default(false),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  examAttempts: many(examAttempts),
  certificates: many(certificates),
  courseProgress: many(userCourseProgress),
  achievements: many(userAchievements),
  addresses: many(userAddresses),
  preferences: many(userPreferences),
  learningPaths: many(userLearningPaths),
  skillAssessments: many(skillAssessments),
  recommendations: many(courseRecommendations),
  activity: many(userActivity),
}));

export const userAddressesRelations = relations(userAddresses, ({ one }) => ({
  user: one(users, {
    fields: [userAddresses.userId],
    references: [users.id],
  }),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  courses: many(courses),
  learningPaths: many(learningPaths),
  skillAssessments: many(skillAssessments),
}));

export const coursesRelations = relations(courses, ({ one, many }) => ({
  category: one(categories, {
    fields: [courses.categoryId],
    references: [categories.id],
  }),
  questions: many(questions),
  examAttempts: many(examAttempts),
  userProgress: many(userCourseProgress),
}));

export const userCourseProgressRelations = relations(userCourseProgress, ({ one }) => ({
  user: one(users, {
    fields: [userCourseProgress.userId],
    references: [users.id],
  }),
  course: one(courses, {
    fields: [userCourseProgress.courseId],
    references: [courses.id],
  }),
}));

export const achievementsRelations = relations(achievements, ({ many }) => ({
  userAchievements: many(userAchievements),
}));

export const userAchievementsRelations = relations(userAchievements, ({ one }) => ({
  user: one(users, {
    fields: [userAchievements.userId],
    references: [users.id],
  }),
  achievement: one(achievements, {
    fields: [userAchievements.achievementId],
    references: [achievements.id],
  }),
}));

export const questionsRelations = relations(questions, ({ one }) => ({
  course: one(courses, {
    fields: [questions.courseId],
    references: [courses.id],
  }),
}));

export const examAttemptsRelations = relations(examAttempts, ({ one }) => ({
  user: one(users, {
    fields: [examAttempts.userId],
    references: [users.id],
  }),
  course: one(courses, {
    fields: [examAttempts.courseId],
    references: [courses.id],
  }),
  certificate: one(certificates),
}));

export const certificatesRelations = relations(certificates, ({ one }) => ({
  user: one(users, {
    fields: [certificates.userId],
    references: [users.id],
  }),
  examAttempt: one(examAttempts, {
    fields: [certificates.examAttemptId],
    references: [examAttempts.id],
  }),
  payment: one(payments),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  certificate: one(certificates, {
    fields: [payments.certificateId],
    references: [certificates.id],
  }),
}));

export const internshipApplicationsRelations = relations(internshipApplications, ({ one }) => ({
  certificate: one(certificates, {
    fields: [internshipApplications.certificateId],
    references: [certificates.id],
  }),
}));

export const sellersRelations = relations(sellers, ({ many }) => ({
  sales: many(sales),
  withdrawalRequests: many(withdrawalRequests),
}));

export const salesRelations = relations(sales, ({ one }) => ({
  seller: one(sellers, {
    fields: [sales.sellerId],
    references: [sellers.id],
  }),
  certificate: one(certificates, {
    fields: [sales.certificateId],
    references: [certificates.id],
  }),
  course: one(courses, {
    fields: [sales.courseId],
    references: [courses.id],
  }),
}));

export const withdrawalRequestsRelations = relations(withdrawalRequests, ({ one }) => ({
  seller: one(sellers, {
    fields: [withdrawalRequests.sellerId],
    references: [sellers.id],
  }),
}));

// Smart Notifications Relations
export const userPreferencesRelations = relations(userPreferences, ({ one }) => ({
  user: one(users, {
    fields: [userPreferences.userId],
    references: [users.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));

export const courseRecommendationsRelations = relations(courseRecommendations, ({ one }) => ({
  user: one(users, {
    fields: [courseRecommendations.userId],
    references: [users.id],
  }),
  course: one(courses, {
    fields: [courseRecommendations.courseId],
    references: [courses.id],
  }),
}));

export const userActivityRelations = relations(userActivity, ({ one }) => ({
  user: one(users, {
    fields: [userActivity.userId],
    references: [users.id],
  }),
}));

// Learning Path Relations
export const learningPathsRelations = relations(learningPaths, ({ one, many }) => ({
  category: one(categories, {
    fields: [learningPaths.categoryId],
    references: [categories.id],
  }),

  userPaths: many(userLearningPaths),
}));

export const userLearningPathsRelations = relations(userLearningPaths, ({ one }) => ({
  user: one(users, {
    fields: [userLearningPaths.userId],
    references: [users.id],
  }),
  learningPath: one(learningPaths, {
    fields: [userLearningPaths.learningPathId],
    references: [learningPaths.id],
  }),
}));

export const skillAssessmentsRelations = relations(skillAssessments, ({ one }) => ({
  user: one(users, {
    fields: [skillAssessments.userId],
    references: [users.id],
  }),
  category: one(categories, {
    fields: [skillAssessments.categoryId],
    references: [categories.id],
  }),
}));

// Insert schemas (userSchema already defined above with profile fields)

export const insertCategorySchema = createInsertSchema(categories).omit({
  id: true,
});

// Rating tables
export const ratings = pgTable('ratings', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  courseId: integer('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
  rating: integer('rating').notNull(),
  reviewText: text('review_text'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  userCourseUnique: unique().on(table.userId, table.courseId),
}));

export const ratingAggregates = pgTable('rating_aggregates', {
  id: serial('id').primaryKey(),
  courseId: integer('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }).unique(),
  averageRating: decimal('average_rating', { precision: 3, scale: 2 }).default('0.00'),
  totalReviews: integer('total_reviews').default(0),
  rating1Count: integer('rating_1_count').default(0),
  rating2Count: integer('rating_2_count').default(0),
  rating3Count: integer('rating_3_count').default(0),
  rating4Count: integer('rating_4_count').default(0),
  rating5Count: integer('rating_5_count').default(0),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const insertCourseSchema = createInsertSchema(courses).omit({
  id: true,
  createdAt: true,
});

export const insertRatingSchema = createInsertSchema(ratings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertQuestionSchema = createInsertSchema(questions).omit({
  id: true,
}).extend({
  options: z.array(z.string()),
});

export const insertExamAttemptSchema = createInsertSchema(examAttempts).omit({
  id: true,
  createdAt: true,
});

export const insertCertificateSchema = createInsertSchema(certificates).omit({
  id: true,
  issuedAt: true,
});

export const insertPaymentSchema = createInsertSchema(payments).omit({
  id: true,
  createdAt: true,
});

export const insertUserCourseProgressSchema = createInsertSchema(userCourseProgress).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAchievementSchema = createInsertSchema(achievements).omit({
  id: true,
  createdAt: true,
});

export const insertUserAchievementSchema = createInsertSchema(userAchievements).omit({
  id: true,
  unlockedAt: true,
});

// Types (User and InsertUser types defined above with profile fields)

export const insertUserAddressSchema = createInsertSchema(userAddresses).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type UserAddress = typeof userAddresses.$inferSelect;
export type InsertUserAddress = z.infer<typeof insertUserAddressSchema>;

export type Category = typeof categories.$inferSelect;
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Course = typeof courses.$inferSelect;
export type InsertCourse = z.infer<typeof insertCourseSchema>;
export type Rating = typeof ratings.$inferSelect;
export type InsertRating = z.infer<typeof insertRatingSchema>;
export type RatingAggregate = typeof ratingAggregates.$inferSelect;
export type Question = typeof questions.$inferSelect;
export type InsertQuestion = z.infer<typeof insertQuestionSchema>;
export type ExamAttempt = typeof examAttempts.$inferSelect;
export type InsertExamAttempt = z.infer<typeof insertExamAttemptSchema>;
export type Certificate = typeof certificates.$inferSelect;
export type InsertCertificate = z.infer<typeof insertCertificateSchema>;
export type Payment = typeof payments.$inferSelect;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;

export const insertInternshipApplicationSchema = createInsertSchema(internshipApplications).omit({
  id: true,
  createdAt: true,
});

export const insertSellerSchema = createInsertSchema(sellers).omit({
  id: true,
  createdAt: true,
  totalEarnings: true,
  pendingEarnings: true,
});

export const insertSaleSchema = createInsertSchema(sales).omit({
  id: true,
  createdAt: true,
});

export const insertWithdrawalRequestSchema = createInsertSchema(withdrawalRequests).omit({
  id: true,
  createdAt: true,
  processedAt: true,
});

export const insertLeaderboardSchema = createInsertSchema(leaderboard).omit({
  id: true,
  achievedAt: true,
});

export type InternshipApplication = typeof internshipApplications.$inferSelect;
export type InsertInternshipApplication = z.infer<typeof insertInternshipApplicationSchema>;
export type Seller = typeof sellers.$inferSelect;
export type InsertSeller = z.infer<typeof insertSellerSchema>;
export type Sale = typeof sales.$inferSelect;
export type InsertSale = z.infer<typeof insertSaleSchema>;
export type WithdrawalRequest = typeof withdrawalRequests.$inferSelect;
export type InsertWithdrawalRequest = z.infer<typeof insertWithdrawalRequestSchema>;

export const insertReferralClickSchema = createInsertSchema(referralClicks).omit({
  id: true,
  clickedAt: true,
});

export type ReferralClick = typeof referralClicks.$inferSelect;
export type InsertReferralClick = z.infer<typeof insertReferralClickSchema>;

export type Leaderboard = typeof leaderboard.$inferSelect;
export type InsertLeaderboard = z.infer<typeof insertLeaderboardSchema>;

// Progress and Achievement types
export type UserCourseProgress = typeof userCourseProgress.$inferSelect;
export type InsertUserCourseProgress = typeof userCourseProgress.$inferInsert;

export type Achievement = typeof achievements.$inferSelect;
export type InsertAchievement = typeof achievements.$inferInsert;

export type UserAchievement = typeof userAchievements.$inferSelect;
export type InsertUserAchievement = typeof userAchievements.$inferInsert;

// AI Interview Tables
export const interviewQuestions = pgTable("interview_questions", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  question: text("question").notNull(),
  technology: text("technology").notNull(), // React, Node.js, Python, etc.
  difficulty: text("difficulty").notNull(), // beginner, intermediate, advanced
  questionType: text("question_type").notNull().default('interview'), // 'interview', 'practical', 'handson'
  timeLimit: integer("time_limit").notNull(), // time in seconds
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const interviews = pgTable("interviews", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  title: text("title").notNull(),
  technology: text("technology").notNull(),
  status: text("status").default("pending").notNull(), // pending, in_progress, completed, expired
  totalQuestions: integer("total_questions").notNull(),
  completedQuestions: integer("completed_questions").default(0).notNull(),
  score: integer("score"), // out of 100
  grade: text("grade"), // A+, A, B+, B, C+, C, D, F
  videoUrl: text("video_url"), // Camera recording URL
  screenRecordingUrl: text("screen_recording_url"), // Screen recording URL
  swotAnalysis: jsonb("swot_analysis").$type<{
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
    threats: string[];
  }>(),
  aiSummary: text("ai_summary"),
  paymentStatus: text("payment_status").default("pending").notNull(), // pending, paid, failed
  paymentId: text("payment_id"),
  transactionId: text("transaction_id"),
  paymentAmount: decimal("payment_amount", { precision: 10, scale: 2 }).default("99.00").notNull(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const interviewResponses = pgTable("interview_responses", {
  id: serial("id").primaryKey(),
  interviewId: integer("interview_id").references(() => interviews.id).notNull(),
  questionId: integer("question_id").references(() => interviewQuestions.id).notNull(),
  videoSegmentUrl: text("video_segment_url"), // Cloudinary URL for this question's video
  audioTranscription: text("audio_transcription"), // Audio transcription from video only
  screenAnalysis: text("screen_analysis"), // AI analysis of screen recording for practical questions
  eyeTrackingData: jsonb("eye_tracking_data").$type<{
    averageFocus: number;
    lookAwayCount: number;
    totalTime: number;
  }>(),
  timeSpent: integer("time_spent"), // in seconds
  aiScore: integer("ai_score"), // individual question score
  aiAnalysis: text("ai_analysis"),
  introductionScore: integer("introduction_score"), // Score for self-introduction (0-20)
  technicalScore: integer("technical_score"), // Score for technical content (0-80)
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertInterviewQuestionSchema = createInsertSchema(interviewQuestions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertInterviewSchema = createInsertSchema(interviews).omit({
  id: true,
  createdAt: true,
});

export const insertInterviewResponseSchema = createInsertSchema(interviewResponses).omit({
  id: true,
  createdAt: true,
});

export type InsertInterviewQuestion = z.infer<typeof insertInterviewQuestionSchema>;
export type InterviewQuestion = typeof interviewQuestions.$inferSelect;
export type InsertInterview = z.infer<typeof insertInterviewSchema>;
export type Interview = typeof interviews.$inferSelect;
export type InsertInterviewResponse = z.infer<typeof insertInterviewResponseSchema>;
export type InterviewResponse = typeof interviewResponses.$inferSelect;

// Smart Notifications Insert Schemas
export const insertUserPreferencesSchema = createInsertSchema(userPreferences).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
});

export const insertCourseRecommendationSchema = createInsertSchema(courseRecommendations).omit({
  id: true,
  createdAt: true,
});

export const insertUserActivitySchema = createInsertSchema(userActivity).omit({
  id: true,
  createdAt: true,
});

// Smart Notifications Types
export type UserPreferences = typeof userPreferences.$inferSelect;
export type InsertUserPreferences = z.infer<typeof insertUserPreferencesSchema>;
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type CourseRecommendation = typeof courseRecommendations.$inferSelect;
export type InsertCourseRecommendation = z.infer<typeof insertCourseRecommendationSchema>;
export type UserActivity = typeof userActivity.$inferSelect;
export type InsertUserActivity = z.infer<typeof insertUserActivitySchema>;

// Learning Path Insert Schemas
export const insertLearningPathSchema = createInsertSchema(learningPaths).omit({
  id: true,
});

export const insertUserLearningPathSchema = createInsertSchema(userLearningPaths).omit({
  id: true,
});

export const insertSkillAssessmentSchema = createInsertSchema(skillAssessments).omit({
  id: true,
  createdAt: true,
});

// Learning Path Types
export type LearningPath = typeof learningPaths.$inferSelect;
export type InsertLearningPath = z.infer<typeof insertLearningPathSchema>;
export type UserLearningPath = typeof userLearningPaths.$inferSelect;
export type InsertUserLearningPath = z.infer<typeof insertUserLearningPathSchema>;
export type SkillAssessment = typeof skillAssessments.$inferSelect;
export type InsertSkillAssessment = z.infer<typeof insertSkillAssessmentSchema>;
