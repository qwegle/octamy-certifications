import { pgTable, text, serial, integer, boolean, timestamp, decimal, json } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password"),
  name: text("name").notNull(),
  isAdmin: boolean("is_admin").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
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
});

export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  certificateId: integer("certificate_id").references(() => certificates.id).notNull(),
  razorpayPaymentId: text("razorpay_payment_id").notNull(),
  razorpayOrderId: text("razorpay_order_id").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").default("INR").notNull(),
  status: text("status").notNull(),
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
  password: text("password").notNull(),
  name: text("name").notNull(),
  phone: text("phone"),
  isApproved: boolean("is_approved").default(false).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  commissionRate: decimal("commission_rate", { precision: 5, scale: 2 }).default("10.00").notNull(),
  totalEarnings: decimal("total_earnings", { precision: 10, scale: 2 }).default("0.00").notNull(),
  pendingEarnings: decimal("pending_earnings", { precision: 10, scale: 2 }).default("0.00").notNull(),
  upiId: text("upi_id"),
  bankAccountNumber: text("bank_account_number"),
  bankIFSC: text("bank_ifsc"),
  bankName: text("bank_name"),
  accountHolderName: text("account_holder_name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const sales = pgTable("sales", {
  id: serial("id").primaryKey(),
  sellerId: integer("seller_id").references(() => sellers.id).notNull(),
  certificateId: integer("certificate_id").references(() => certificates.id).notNull(),
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

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  examAttempts: many(examAttempts),
  certificates: many(certificates),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  courses: many(courses),
}));

export const coursesRelations = relations(courses, ({ one, many }) => ({
  category: one(categories, {
    fields: [courses.categoryId],
    references: [categories.id],
  }),
  questions: many(questions),
  examAttempts: many(examAttempts),
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

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertCategorySchema = createInsertSchema(categories).omit({
  id: true,
});

export const insertCourseSchema = createInsertSchema(courses).omit({
  id: true,
  createdAt: true,
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

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Category = typeof categories.$inferSelect;
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Course = typeof courses.$inferSelect;
export type InsertCourse = z.infer<typeof insertCourseSchema>;
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
