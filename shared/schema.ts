import { pgTable, text, varchar, serial, integer, boolean, timestamp, date, decimal, json, index, uniqueIndex, jsonb, unique, check, foreignKey, type AnyPgColumn } from "drizzle-orm/pg-core";
import { relations, eq, desc, and, asc, sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import type {
  InterviewStudioBlueprint,
  InterviewStudioConsentSnapshot,
  InterviewStudioItemEvaluation,
  InterviewStudioOverallEvaluation,
  InterviewStudioPermissionSnapshot,
  InterviewStudioPrivateArtifactManifest,
  InterviewStudioTestRunResult,
} from "./interview-studio";

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
  creditsBalance: decimal('credits_balance', { precision: 10, scale: 2 }).default('0.00').notNull(),

  // Subscription plan
  plan: text('plan').notNull().default('starter'), // starter | growth | enterprise
  planRenewsAt: timestamp('plan_renews_at'),
  
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
  // Gateway/order reference used to make wallet credits idempotent.
  externalReference: text('external_reference'),
  balanceAfter: decimal('balance_after', { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const profileAccessLogs = pgTable('profile_access_logs', {
  id: serial('id').primaryKey(),
  recruiterId: integer('recruiter_id').notNull().references(() => recruiters.id),
  userId: integer('user_id').notNull(),
  accessType: text('access_type').notNull(),
  creditsUsed: decimal('credits_used', { precision: 10, scale: 2 }).notNull(),
  // Deterministic recruiter:candidate:access key. Historical rows may be NULL.
  idempotencyKey: text('idempotency_key'),
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
  googleId: text("google_id").unique(),
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
  // Both recruiter discovery and public evidence sharing are explicit opt-ins.
  profileVisibility: boolean("profile_visibility").default(false).notNull(),
  evidencePassportPublic: boolean("evidence_passport_public").default(false).notNull(),
  lastActive: timestamp("last_active").defaultNow(),
  profileCompleteness: integer("profile_completeness").default(0), // percentage
  
  updatedAt: timestamp("updated_at").defaultNow(),
  accountDeletedAt: timestamp("account_deleted_at", { withTimezone: true }),
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

// Reusable user-owned media library. Assets are uploaded once and can be
// selected across course, lesson, question, profile, and institute workflows.
// Media URLs are intentionally public-by-link because they may be embedded in
// public catalog pages; management endpoints remain owner-only.
export const mediaAssets = pgTable("media_assets", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  originalName: text("original_name").notNull(),
  mimeType: text("mime_type").notNull(),
  kind: text("kind").notNull(), // image | video | document
  url: text("url").notNull(),
  storageProvider: text("storage_provider").default("local").notNull(), // local | cloudinary
  storageKey: text("storage_key").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  width: integer("width"),
  height: integer("height"),
  altText: text("alt_text"),
  caption: text("caption"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  byOwnerCreated: index("media_assets_owner_created_idx").on(t.userId, t.createdAt),
  byOwnerKind: index("media_assets_owner_kind_idx").on(t.userId, t.kind),
}));

export type MediaAsset = typeof mediaAssets.$inferSelect;
export type InsertMediaAsset = typeof mediaAssets.$inferInsert;

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  icon: text("icon").notNull(),
  slug: text("slug").notNull().unique(),
  parentId: integer("parent_id").references((): AnyPgColumn => categories.id, { onDelete: "restrict" }),
  kind: text("kind").default("collection").notNull(), // collection | audience | subject | exam_family | skill
  isActive: boolean("is_active").default(true).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  metaTitle: text("meta_title"),
  metaDescription: text("meta_description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  byParent: index("categories_parent_idx").on(t.parentId, t.sortOrder),
  byKind: index("categories_kind_active_idx").on(t.kind, t.isActive),
}));

export const courses = pgTable("courses", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  slug: text("slug").notNull().unique(),
  categoryId: integer("category_id").references(() => categories.id).notNull(),
  duration: integer("duration").notNull(), // in minutes
  passingScore: integer("passing_score").default(50).notNull(),
  // `price` remains the optional post-pass credential activation fee.
  price: decimal("price", { precision: 10, scale: 2 }).default("199.00").notNull(),
  productType: text("product_type").default("assessment").notNull(), // assessment | video_course | ebook | bundle
  contentPrice: decimal("content_price", { precision: 10, scale: 2 }),
  originalPrice: decimal("original_price", { precision: 10, scale: 2 }),
  isOnSale: boolean("is_on_sale").default(false).notNull(),
  saleEndDate: timestamp("sale_end_date"),
  level: text("level").notNull().default("novice"), // novice, intermediate, advanced, expert
  isActive: boolean("is_active").default(true).notNull(),
  isInternship: boolean("is_internship").default(false).notNull(),
  metaTitle: text("meta_title"),
  metaDescription: text("meta_description"),
  thumbnailUrl: text("thumbnail_url"),
  // Ownership & visibility (P0 multi-tenant identity)
  ownerType: text("owner_type").default("admin").notNull(), // admin | creator | institute
  ownerId: integer("owner_id"),
  visibility: text("visibility").default("public").notNull(), // public | unlisted | private
  language: text("language").default("en").notNull(),
  certificationMode: text("certification_mode").default("none").notNull(),
  assessmentPurpose: text("assessment_purpose").default("certification").notNull(), // certification | practice
  reviewStatus: text("review_status").default("draft").notNull(),
  defaultReviewPolicy: text("default_review_policy").default("after_final_attempt").notNull(),
  subscriptionEligible: boolean("subscription_eligible").default(false).notNull(),
  resellerEligible: boolean("reseller_eligible").default(false).notNull(),
  featuredAt: timestamp("featured_at"),
  // P1: opt-in flag — when true, exam questions are materialized from the
  // course's blueprint + bank rather than the legacy `questions.courseId` rows.
  useBlueprintEngine: boolean("use_blueprint_engine").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  reviewStatus: check("courses_review_status_check", sql`
    ${t.reviewStatus} IN ('draft','pending','approved','rejected','suspended','archived')
  `),
  byPublicAssessment: index("courses_public_assessment_idx").on(
    t.ownerType,
    t.productType,
    t.assessmentPurpose,
    t.reviewStatus,
    t.isActive,
  ),
}));

// Admin-authored public blog. Body is deliberately stored as plain text with
// optional Markdown-style links; HTML angle brackets are rejected both by the
// API and the database so content is never an executable HTML fragment.
export const blogPosts = pgTable("blog_posts", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull(),
  title: text("title").notNull(),
  excerpt: text("excerpt").notNull(),
  body: text("body").notNull(),
  status: text("status").default("draft").notNull(),
  authorUserId: integer("author_user_id").references(() => users.id, { onDelete: "restrict" }).notNull(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  canonicalPath: text("canonical_path").notNull(),
  seoTitle: text("seo_title"),
  seoDescription: text("seo_description"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  slugFormat: check("blog_posts_slug_format_check", sql`
    length(${t.slug}) BETWEEN 1 AND 160
    AND ${t.slug} ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  `),
  titleLength: check("blog_posts_title_check", sql`length(btrim(${t.title})) BETWEEN 5 AND 180`),
  excerptLength: check("blog_posts_excerpt_check", sql`length(btrim(${t.excerpt})) BETWEEN 20 AND 320`),
  safeBody: check("blog_posts_body_check", sql`
    length(btrim(${t.body})) BETWEEN 20 AND 50000
    AND position('<' IN ${t.body}) = 0
    AND position('>' IN ${t.body}) = 0
  `),
  statusValue: check("blog_posts_status_check", sql`${t.status} IN ('draft', 'published')`),
  publicationState: check("blog_posts_publication_check", sql`
    (${t.status} = 'draft' AND ${t.publishedAt} IS NULL)
    OR (${t.status} = 'published' AND ${t.publishedAt} IS NOT NULL)
  `),
  canonicalPathMatchesSlug: check("blog_posts_canonical_path_check", sql`${t.canonicalPath} = '/blog/' || ${t.slug}`),
  seoTitleLength: check("blog_posts_seo_title_check", sql`${t.seoTitle} IS NULL OR length(btrim(${t.seoTitle})) BETWEEN 5 AND 70`),
  seoDescriptionLength: check("blog_posts_seo_description_check", sql`${t.seoDescription} IS NULL OR length(btrim(${t.seoDescription})) BETWEEN 20 AND 180`),
  slugIndex: uniqueIndex("blog_posts_slug_idx").on(t.slug),
  publishedListing: index("blog_posts_published_listing_idx")
    .on(desc(t.publishedAt), desc(t.id))
    .where(sql`${t.status} = 'published'`),
}));

export const blogPostAssessments = pgTable("blog_post_assessments", {
  blogPostId: integer("blog_post_id").references(() => blogPosts.id, { onDelete: "cascade" }).notNull(),
  courseId: integer("course_id").references(() => courses.id, { onDelete: "restrict" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  uniquePostCourse: unique("blog_post_assessments_unique").on(t.blogPostId, t.courseId),
  byCourse: index("blog_post_assessments_course_idx").on(t.courseId, t.blogPostId),
}));

export const insertBlogPostSchema = createInsertSchema(blogPosts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type BlogPost = typeof blogPosts.$inferSelect;
export type InsertBlogPost = typeof blogPosts.$inferInsert;
export type BlogPostAssessment = typeof blogPostAssessments.$inferSelect;

export const audienceBands = pgTable("audience_bands", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  label: text("label").notNull(),
  description: text("description"),
  sortOrder: integer("sort_order").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const courseAudienceBands = pgTable("course_audience_bands", {
  courseId: integer("course_id").references(() => courses.id, { onDelete: "cascade" }).notNull(),
  audienceBandId: integer("audience_band_id").references(() => audienceBands.id, { onDelete: "cascade" }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  uniqueCourseBand: unique("course_audience_bands_unique").on(t.courseId, t.audienceBandId),
  byAudience: index("course_audience_bands_audience_idx").on(t.audienceBandId, t.courseId),
}));

// A course keeps its legacy primary category while this join supports the
// separate subject, exam-family, skill, and merchandising facets required by
// enterprise catalogue filters.
export const courseCategories = pgTable("course_categories", {
  courseId: integer("course_id").references(() => courses.id, { onDelete: "cascade" }).notNull(),
  categoryId: integer("category_id").references(() => categories.id, { onDelete: "restrict" }).notNull(),
  relationType: text("relation_type").default("secondary").notNull(), // primary | secondary
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  uniqueCourseCategory: unique("course_categories_unique").on(t.courseId, t.categoryId),
  byCategory: index("course_categories_category_idx").on(t.categoryId, t.courseId),
}));

// Creators — individuals selling courses on Octamy. 1:1 with users.
export const creators = pgTable("creators", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull().unique(),
  displayName: text("display_name").notNull(),
  slug: text("slug").notNull().unique(),
  bio: text("bio"),
  avatarUrl: text("avatar_url"),
  websiteUrl: text("website_url"),
  twitterHandle: text("twitter_handle"),
  instagramHandle: text("instagram_handle"),
  status: text("status").default("pending").notNull(), // pending | approved | rejected
  approvedAt: timestamp("approved_at"),
  approvedBy: integer("approved_by").references(() => users.id),
  plan: text("plan").default("free").notNull(), // free | pro | premium
  planRenewsAt: timestamp("plan_renews_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Institutes — organizations using Octamy for cohorts / skill verification.
export const institutes = pgTable("institutes", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  legalName: text("legal_name"),
  logoUrl: text("logo_url"),
  websiteUrl: text("website_url"),
  industry: text("industry"),
  sizeRange: text("size_range"), // 1-10 | 11-50 | 51-200 | 201-1000 | 1000+
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  addressLine1: text("address_line1"),
  addressLine2: text("address_line2"),
  city: text("city"),
  state: text("state"),
  country: text("country").default("India"),
  pincode: text("pincode"),
  gstin: text("gstin"),
  pan: text("pan"),
  status: text("status").default("pending").notNull(), // pending | verified | rejected
  plan: text("plan").default("starter").notNull(), // starter | growth | enterprise
  planRenewsAt: timestamp("plan_renews_at"),
  studentSeatLimit: integer("student_seat_limit").default(500).notNull(),
  cohortLimit: integer("cohort_limit").default(5).notNull(),
  // This only authorizes institute-affiliation discovery. The learner's own
  // profileVisibility opt-in remains mandatory and cannot be overridden here.
  recruiterDiscoveryEnabled: boolean("recruiter_discovery_enabled").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Institute members — M:N between users and institutes.
export const instituteMembers = pgTable("institute_members", {
  id: serial("id").primaryKey(),
  instituteId: integer("institute_id").references(() => institutes.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  role: text("role").default("teacher").notNull(), // owner | admin | teacher | staff
  status: text("status").default("active").notNull(), // active | invited | suspended
  invitedBy: integer("invited_by").references(() => users.id),
  invitedAt: timestamp("invited_at"),
  joinedAt: timestamp("joined_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  uniqMember: unique().on(t.instituteId, t.userId),
}));

// Pending invites for institute team members who don't yet have a user account.
// Resolved on signup (auth controller links new user to any matching invite).
export const instituteInvites = pgTable("institute_invites", {
  id: serial("id").primaryKey(),
  instituteId: integer("institute_id").references(() => institutes.id).notNull(),
  email: text("email").notNull(),
  role: text("role").default("teacher").notNull(),
  invitedBy: integer("invited_by").references(() => users.id),
  acceptedAt: timestamp("accepted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  uniqInvite: unique().on(t.instituteId, t.email),
}));

export const insertCreatorSchema = createInsertSchema(creators).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  approvedAt: true,
});
export const insertInstituteSchema = createInsertSchema(institutes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertInstituteMemberSchema = createInsertSchema(instituteMembers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Cohorts — institute-scoped student groups (e.g. "Batch 2026 - CS").
export const cohorts = pgTable("cohorts", {
  id: serial("id").primaryKey(),
  instituteId: integer("institute_id").references(() => institutes.id).notNull(),
  name: text("name").notNull(),
  code: text("code"),
  description: text("description"),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  status: text("status").default("active").notNull(), // active | archived | upcoming
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Cohort students — students enrolled in an institute cohort (may be invited or active).
export const cohortStudents = pgTable("cohort_students", {
  id: serial("id").primaryKey(),
  cohortId: integer("cohort_id").references(() => cohorts.id).notNull(),
  instituteId: integer("institute_id").references(() => institutes.id).notNull(),
  email: text("email").notNull(),
  name: text("name"),
  rollNumber: text("roll_number"),
  userId: integer("user_id").references(() => users.id),
  status: text("status").default("invited").notNull(), // invited | active | inactive
  invitedAt: timestamp("invited_at").defaultNow(),
  joinedAt: timestamp("joined_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  uniqMember: unique().on(t.cohortId, t.email),
}));


// Learner self-service account deletion. Raw verification tokens are never
// persisted; completion keeps only this lifecycle and its de-identified,
// append-only erase/retain audit.
export const accountDeletionRequests = pgTable("account_deletion_requests", {
  id: text("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "restrict" }).notNull(),
  actorUserId: integer("actor_user_id").references(() => users.id, { onDelete: "restrict" }).notNull(),
  state: text("state").default("requested").notNull(),
  verificationTokenHash: varchar("verification_token_hash", { length: 64 }),
  tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
  tokenUsedAt: timestamp("token_used_at", { withTimezone: true }),
  requestedAt: timestamp("requested_at", { withTimezone: true }).defaultNow().notNull(),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  rejectedAt: timestamp("rejected_at", { withTimezone: true }),
  rejectionReason: text("rejection_reason"),
  completionAuditId: integer("completion_audit_id"),
}, (t) => ({
  byUserTime: index("account_deletion_requests_user_time_idx").on(t.userId, t.requestedAt),
  validState: check("account_deletion_requests_state_check", sql`${t.state} IN ('requested','verified','completed','cancelled','rejected')`),
}));

export const accountDeletionAudits = pgTable("account_deletion_audits", {
  id: serial("id").primaryKey(),
  requestId: text("request_id").references(() => accountDeletionRequests.id, { onDelete: "restrict" }).notNull().unique(),
  subjectReference: varchar("subject_reference", { length: 64 }).notNull(),
  actorType: text("actor_type").notNull(),
  policyVersion: text("policy_version").notNull(),
  erased: text("erased").array().notNull(),
  retained: text("retained").array().notNull(),
  counts: jsonb("counts").$type<Record<string, number>>().notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),
});

export type AccountDeletionRequest = typeof accountDeletionRequests.$inferSelect;
export type AccountDeletionAudit = typeof accountDeletionAudits.$inferSelect;
// Subscriptions — recurring plans for learner/creator/institute/recruiter personas.
// Backed by Cashfree one-off orders today (renewal tracked manually);
// will switch to Cashfree Subscriptions API in a follow-up.
export const subscriptions = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  ownerType: text("owner_type").notNull(), // learner | creator | institute | recruiter
  ownerId: integer("owner_id").notNull(),
  userId: integer("user_id").references(() => users.id),
  plan: text("plan").notNull(), // all_access | free | pro | premium | starter | growth | enterprise
  status: text("status").default("pending").notNull(), // pending | active | past_due | cancelled
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").default("INR").notNull(),
  cycle: text("cycle").default("monthly").notNull(), // monthly | yearly
  cashfreeOrderId: text("cashfree_order_id").unique(),
  cashfreePaymentId: text("cashfree_payment_id"),
  startsAt: timestamp("starts_at"),
  renewsAt: timestamp("renews_at"),
  cancelledAt: timestamp("cancelled_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertCohortSchema = createInsertSchema(cohorts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertCohortStudentSchema = createInsertSchema(cohortStudents).omit({
  id: true,
  createdAt: true,
});
export const insertSubscriptionSchema = createInsertSchema(subscriptions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Creator = typeof creators.$inferSelect;
export type InsertCreator = z.infer<typeof insertCreatorSchema>;
export type Institute = typeof institutes.$inferSelect;
export type InsertInstitute = z.infer<typeof insertInstituteSchema>;
export type InstituteMember = typeof instituteMembers.$inferSelect;
export type InsertInstituteMember = z.infer<typeof insertInstituteMemberSchema>;
export type Cohort = typeof cohorts.$inferSelect;
export type InsertCohort = z.infer<typeof insertCohortSchema>;
export type CohortStudent = typeof cohortStudents.$inferSelect;
export type InsertCohortStudent = z.infer<typeof insertCohortStudentSchema>;
export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;

// Audit log — append-only, captures sensitive actions for forensic / compliance review.
export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  actorEmail: text("actor_email"),
  actorRole: text("actor_role"), // user | admin | seller | recruiter | creator | institute | system
  action: text("action").notNull(), // e.g. login.success, admin.user.delete, payment.refund
  resourceType: text("resource_type"), // user | course | payment | certificate | subscription
  resourceId: text("resource_id"),
  ip: text("ip"),
  userAgent: text("user_agent"),
  metadata: jsonb("metadata"),
  status: text("status").default("success").notNull(), // success | failure
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  byActor: index("audit_logs_user_idx").on(t.userId),
  byAction: index("audit_logs_action_idx").on(t.action),
  byCreated: index("audit_logs_created_idx").on(t.createdAt),
}));

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;

// =================================================================
// LMS — course curriculum (creator builder + lesson progress)
// =================================================================
export const courseSections = pgTable("course_sections", {
  id: serial("id").primaryKey(),
  courseId: integer("course_id").references(() => courses.id).notNull(),
  title: text("title").notNull(),
  position: integer("position").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Durable request ledger for atomic AI curriculum imports. The unique request
// identity belongs to a course/workspace, so retries (including concurrent
// retries after a client timeout) can replay the committed identifiers without
// creating duplicate sections or lessons. Only a payload hash and the compact
// import result are retained; the generated outline itself is not duplicated
// into this operational table.
export const courseCurriculumImports = pgTable("course_curriculum_imports", {
  id: serial("id").primaryKey(),
  courseId: integer("course_id").references(() => courses.id, { onDelete: "cascade" }).notNull(),
  workspace: text("workspace").notNull(), // creator | institute
  actorUserId: integer("actor_user_id").references(() => users.id).notNull(),
  idempotencyKey: text("idempotency_key").notNull(),
  requestHash: text("request_hash").notNull(),
  status: text("status").default("processing").notNull(), // processing | completed
  response: jsonb("response"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
}, (t) => ({
  uniqueRequest: unique().on(t.courseId, t.workspace, t.idempotencyKey),
  byActor: index("course_curriculum_imports_actor_idx").on(t.actorUserId, t.createdAt),
}));

export const lessons = pgTable("lessons", {
  id: serial("id").primaryKey(),
  sectionId: integer("section_id").references(() => courseSections.id).notNull(),
  courseId: integer("course_id").references(() => courses.id).notNull(),
  title: text("title").notNull(),
  kind: text("kind").default("video").notNull(), // video | pdf | text | quiz | link
  contentUrl: text("content_url"),
  contentText: text("content_text"),
  durationSec: integer("duration_sec").default(0),
  position: integer("position").default(0).notNull(),
  isPreview: boolean("is_preview").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  bySection: index("lessons_section_idx").on(t.sectionId),
  byCourse: index("lessons_course_idx").on(t.courseId),
}));

export const lessonProgress = pgTable("lesson_progress", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  lessonId: integer("lesson_id").references(() => lessons.id).notNull(),
  courseId: integer("course_id").references(() => courses.id).notNull(),
  status: text("status").default("started").notNull(), // started | completed
  positionSec: integer("position_sec").default(0),
  completedAt: timestamp("completed_at"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  uniq: unique().on(t.userId, t.lessonId),
  byUserCourse: index("lesson_progress_user_course_idx").on(t.userId, t.courseId),
}));

export const courseReviews = pgTable("course_reviews", {
  id: serial("id").primaryKey(),
  courseId: integer("course_id").references(() => courses.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  rating: integer("rating").notNull(), // 1..5
  comment: text("comment"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  uniq: unique().on(t.courseId, t.userId),
}));

// =================================================================
// EXAM — standalone scheduled exams (separate from course free exams)
// =================================================================
export const examInstances = pgTable("exam_instances", {
  id: serial("id").primaryKey(),
  bankId: integer("bank_id").references(() => questionBanks.id),
  courseId: integer("course_id").references(() => courses.id),
  ownerType: text("owner_type").notNull(), // creator | institute | admin
  ownerId: integer("owner_id").notNull(),
  title: text("title").notNull(),
  shareCode: text("share_code").notNull().unique(),
  passwordHash: text("password_hash"),
  cohortId: integer("cohort_id").references(() => cohorts.id),
  // Cohort assessments use per-recipient bearer invitations. Public links are
  // retained for Octamy/creator assessments and legacy institute drafts only.
  accessMode: text("access_mode").default("public_link").notNull(), // public_link | cohort_invite
  // Institute exams are paid for by the workspace, never by the candidate.
  // This snapshots the subscription most recently verified when the exam was
  // published or accessed; runtime checks still require a currently active row.
  fundingSubscriptionId: integer("funding_subscription_id").references(() => subscriptions.id),
  fundingVerifiedAt: timestamp("funding_verified_at"),
  startsAt: timestamp("starts_at"),
  endsAt: timestamp("ends_at"),
  durationMin: integer("duration_min").default(30).notNull(),
  passingScore: integer("passing_score").default(50).notNull(),
  maxAttempts: integer("max_attempts").default(1).notNull(),
  questionCount: integer("question_count").default(50).notNull(),
  reviewPolicy: text("review_policy").default("after_window").notNull(),
  reviewReleaseAt: timestamp("review_release_at"),
  retakeCooldownMin: integer("retake_cooldown_min").default(0).notNull(),
  // standard: assessment + resilient autosave/connectivity evidence only
  // browser_evidence: also records proportionate browser focus/fullscreen/paste signals
  // (never webcam, microphone, screen recording, or automated cheating verdicts)
  proctorMode: text("proctor_mode").default("standard").notNull(),
  status: text("status").default("draft").notNull(), // draft | live | closed
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Delivery ledger for private institute cohort exams. Only a SHA-256 digest of
// the high-entropy bearer token is persisted. The raw token exists solely in
// the candidate's emailed link and transient request memory.
export const examInstanceInvitations = pgTable("exam_instance_invitations", {
  id: serial("id").primaryKey(),
  examInstanceId: integer("exam_instance_id").references(() => examInstances.id, { onDelete: "cascade" }).notNull(),
  cohortStudentId: integer("cohort_student_id").references(() => cohortStudents.id, { onDelete: "set null" }),
  email: text("email").notNull(),
  recipientName: text("recipient_name"),
  tokenHash: text("token_hash").notNull().unique(),
  status: text("status").default("pending").notNull(), // pending | sent | delivery_failed | opened | started | revoked
  expiresAt: timestamp("expires_at").notNull(),
  sentAt: timestamp("sent_at"),
  lastSentAt: timestamp("last_sent_at"),
  openedAt: timestamp("opened_at"),
  lastStartedAt: timestamp("last_started_at"),
  sendCount: integer("send_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  uniqExamEmail: unique("exam_instance_invitations_exam_email_unique").on(t.examInstanceId, t.email),
  byExamStatus: index("exam_instance_invitations_exam_status_idx").on(t.examInstanceId, t.status),
  byCohortStudent: index("exam_instance_invitations_cohort_student_idx").on(t.cohortStudentId),
}));

export const examInstanceAttempts = pgTable("exam_instance_attempts", {
  id: serial("id").primaryKey(),
  instanceId: integer("instance_id").references(() => examInstances.id).notNull(),
  invitationId: integer("invitation_id").references(() => examInstanceInvitations.id, { onDelete: "restrict" }),
  userId: integer("user_id").references(() => users.id),
  email: text("email"),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  // Authoritative deadline captured from min(startedAt + duration, exam.endsAt).
  // Nullable during the expand/contract rollout for attempts created by an old process.
  deadlineAt: timestamp("deadline_at"),
  passingScoreSnapshot: integer("passing_score_snapshot"),
  maxAttemptsSnapshot: integer("max_attempts_snapshot"),
  reviewPolicySnapshot: text("review_policy_snapshot"),
  reviewReleaseAtSnapshot: timestamp("review_release_at_snapshot"),
  questionSnapshotSource: text("question_snapshot_source"), // start | legacy_reconstructed
  lastHeartbeatAt: timestamp("last_heartbeat_at").defaultNow().notNull(),
  submittedAt: timestamp("submitted_at"),
  score: integer("score").default(0),
  totalQuestions: integer("total_questions").default(0),
  // Sum of immutable item maxPoints. Keep separate from the item count so
  // weighted and negative-mark assessments produce an honest percentage.
  totalPoints: integer("total_points").default(0).notNull(),
  // Captured when the attempt starts so later bank edits cannot rewrite the
  // candidate-facing unsupported-format notice for an existing attempt.
  excludedQuestionCount: integer("excluded_question_count").default(0).notNull(),
  passed: boolean("passed").default(false),
  answers: jsonb("answers"),
  // Snapshot the mode so changing an exam later cannot rewrite an attempt's evidence contract.
  proctorMode: text("proctor_mode").default("standard").notNull(),
  evidenceConsentAt: timestamp("evidence_consent_at"),
  evidenceConsentVersion: text("evidence_consent_version"),
  lastAutosaveAt: timestamp("last_autosave_at"),
  status: text("status").default("in_progress").notNull(), // in_progress | submitted | abandoned
}, (t) => ({
  byInstance: index("exam_instance_attempts_instance_idx").on(t.instanceId),
  nonnegativeTotalPoints: check("exam_instance_attempts_total_points_check", sql`${t.totalPoints} >= 0`),
}));

// Immutable question materialisation for a scheduled exam attempt. questionId
// is deliberately not a foreign key: deleting source content must not erase or
// mutate the evidence that was actually shown and graded in an existing run.
export const examInstanceAttemptItems = pgTable("exam_instance_attempt_items", {
  id: serial("id").primaryKey(),
  attemptId: integer("attempt_id").references(() => examInstanceAttempts.id, { onDelete: "cascade" }).notNull(),
  questionId: integer("question_id").notNull(),
  position: integer("position").notNull(),
  questionVersion: integer("question_version").default(1).notNull(),
  question: text("question").notNull(),
  options: jsonb("options").$type<string[]>().notNull(),
  questionType: text("question_type").default("multiple_choice").notNull(),
  questionFormat: text("question_format").default("mcq_single").notNull(),
  imageUrl: text("image_url"),
  codeLanguage: text("code_language"),
  timeLimitSec: integer("time_limit_sec"),
  maxPoints: integer("max_points").default(1).notNull(),
  negativeMarks: integer("negative_marks").default(0).notNull(),
  correctAnswer: integer("correct_answer").notNull(),
  expectedAnswer: text("expected_answer"),
  explanation: text("explanation"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  uniqQuestion: unique("exam_instance_attempt_items_attempt_question_unique").on(t.attemptId, t.questionId),
  uniqPosition: unique("exam_instance_attempt_items_attempt_position_unique").on(t.attemptId, t.position),
  nonnegativePosition: check("exam_instance_attempt_items_position_check", sql`${t.position} >= 0`),
}));

// Proportionate, reviewable browser evidence for a scheduled exam attempt.
// Metadata must never contain answer text, clipboard contents, media, or keystrokes.
export const examProctorEvents = pgTable("exam_proctor_events", {
  id: serial("id").primaryKey(),
  attemptId: integer("attempt_id").references(() => examInstanceAttempts.id, { onDelete: "cascade" }).notNull(),
  clientEventId: text("client_event_id").notNull(),
  eventType: text("event_type").notNull(),
  clientAt: timestamp("client_at"),
  occurredAt: timestamp("occurred_at").defaultNow().notNull(),
  metadata: jsonb("metadata"),
}, (t) => ({
  uniqClientEvent: unique("exam_proctor_events_attempt_client_event_unique").on(t.attemptId, t.clientEventId),
  byAttemptTime: index("exam_proctor_events_attempt_time_idx").on(t.attemptId, t.occurredAt),
}));

// =================================================================
// PAY — split payouts + payout requests
// =================================================================
export const splitPayouts = pgTable("split_payouts", {
  id: serial("id").primaryKey(),
  paymentId: integer("payment_id").references(() => payments.id),
  cashfreeOrderId: text("cashfree_order_id"),
  beneficiaryType: text("beneficiary_type").notNull(), // creator | institute | nodukan | platform
  beneficiaryId: integer("beneficiary_id"),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").default("INR").notNull(),
  status: text("status").default("pending").notNull(), // pending | settled | failed
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const payoutRequests = pgTable("payout_requests", {
  id: serial("id").primaryKey(),
  ownerType: text("owner_type").notNull(), // creator | institute
  ownerId: integer("owner_id").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").default("INR").notNull(),
  upi: text("upi"),
  bankAccount: text("bank_account"),
  ifsc: text("ifsc"),
  status: text("status").default("pending").notNull(), // pending | approved | paid | rejected
  notes: text("notes"),
  approvedBy: integer("approved_by").references(() => users.id),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// =================================================================
// CREATOR — third-party integrations (Nodukan etc)
// =================================================================
export const creatorIntegrations = pgTable("creator_integrations", {
  id: serial("id").primaryKey(),
  creatorId: integer("creator_id").references(() => creators.id).notNull(),
  provider: text("provider").notNull(), // nodukan | youtube | substack
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  externalAccountId: text("external_account_id"),
  config: jsonb("config"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  uniq: unique().on(t.creatorId, t.provider),
}));

export type CourseSection = typeof courseSections.$inferSelect;
export type CourseCurriculumImport = typeof courseCurriculumImports.$inferSelect;
export type InsertCourseCurriculumImport = typeof courseCurriculumImports.$inferInsert;
export type Lesson = typeof lessons.$inferSelect;
export type LessonProgress = typeof lessonProgress.$inferSelect;
export type CourseReview = typeof courseReviews.$inferSelect;
export type ExamInstance = typeof examInstances.$inferSelect;
export type ExamInstanceInvitation = typeof examInstanceInvitations.$inferSelect;
export type ExamInstanceAttempt = typeof examInstanceAttempts.$inferSelect;
export type ExamInstanceAttemptItem = typeof examInstanceAttemptItems.$inferSelect;
export type ExamProctorEvent = typeof examProctorEvents.$inferSelect;
export type SplitPayout = typeof splitPayouts.$inferSelect;
export type PayoutRequest = typeof payoutRequests.$inferSelect;
export type CreatorIntegration = typeof creatorIntegrations.$inferSelect;

// =================================================================
// AUTH — password reset tokens
// =================================================================
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  byHash: index("password_reset_tokens_hash_idx").on(t.tokenHash),
  byUser: index("password_reset_tokens_user_idx").on(t.userId),
}));
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;

// Registered question-pack sources are immutable rights/provenance manifests.
// The ingestion CLI only accepts sources whose commercial and derivative-use
// rights have been explicitly reviewed; repository/code licensing alone is not
// treated as chain-of-title for third-party assessment content.
export const questionPackSources = pgTable("question_pack_sources", {
  id: serial("id").primaryKey(),
  sourceKey: text("source_key").notNull().unique(),
  name: text("name").notNull(),
  publisher: text("publisher").notNull(),
  datasetVersion: text("dataset_version").notNull(),
  description: text("description"),
  sourceUrl: text("source_url").notNull(),
  retrievedAt: timestamp("retrieved_at").notNull(),
  manifestSha256: text("manifest_sha256").notNull(),
  licenseIdentifier: text("license_identifier").notNull(),
  licenseName: text("license_name").notNull(),
  licenseUrl: text("license_url").notNull(),
  rightsBasis: text("rights_basis").notNull(), // owned | contract | permission | open_license | public_domain
  commercialUseAllowed: boolean("commercial_use_allowed").default(false).notNull(),
  derivativesAllowed: boolean("derivatives_allowed").default(false).notNull(),
  shareAlikeObligation: text("share_alike_obligation").default("none").notNull(),
  attributionText: text("attribution_text").notNull(),
  evidenceReference: text("evidence_reference").notNull(),
  provenance: jsonb("provenance").$type<Record<string, unknown>>().default({}).notNull(),
  rightsReviewStatus: text("rights_review_status").default("pending").notNull(), // pending | verified | rejected
  rightsReviewedAt: timestamp("rights_reviewed_at"),
  rightsReviewedBy: text("rights_reviewed_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  rightsInventory: index("question_pack_sources_rights_idx").on(t.rightsReviewStatus, t.publisher),
  validSourceKey: check("question_pack_sources_key_check", sql`${t.sourceKey} ~ '^[a-z0-9][a-z0-9._:/-]{2,159}$'`),
  manifestHash: check("question_pack_sources_manifest_hash_check", sql`${t.manifestSha256} ~ '^[0-9a-f]{64}$'`),
  rightsBasis: check("question_pack_sources_rights_basis_check", sql`${t.rightsBasis} IN ('owned','contract','permission','open_license','public_domain')`),
  reviewStatus: check("question_pack_sources_review_status_check", sql`${t.rightsReviewStatus} IN ('pending','verified','rejected')`),
  provenanceObject: check("question_pack_sources_provenance_object_check", sql`jsonb_typeof(${t.provenance}) = 'object'`),
  verifiedRights: check("question_pack_sources_verified_rights_check", sql`
    ${t.rightsReviewStatus} <> 'verified'
    OR (
      ${t.commercialUseAllowed} = true
      AND ${t.derivativesAllowed} = true
      AND ${t.rightsReviewedAt} IS NOT NULL
      AND length(btrim(COALESCE(${t.rightsReviewedBy}, ''))) >= 3
      AND length(btrim(${t.licenseIdentifier})) >= 3
      AND length(btrim(${t.licenseUrl})) >= 8
      AND length(btrim(${t.sourceUrl})) >= 8
      AND length(btrim(${t.evidenceReference})) >= 8
    )
  `),
}));

export const questions = pgTable("questions", {
  id: serial("id").primaryKey(),
  // Legacy: questions tied directly to a course. Now nullable; bank-scoped
  // questions are linked via bankId/topicId and may have no course.
  courseId: integer("course_id").references(() => courses.id),
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

  // P1 Question Bank Pro additions
  bankId: integer("bank_id").references(() => questionBanks.id),
  topicId: integer("topic_id").references(() => questionTopics.id),
  questionFormat: text("question_format").default("mcq_single").notNull(),
  // mcq_single | mcq_multi | true_false | fill_blank | short | long | code | numeric | match
  imageUrl: text("image_url"),
  imageAltText: text("image_alt_text"),
  optionMedia: jsonb("option_media").$type<Array<{ url: string; alt: string }> | null>(),
  codeLanguage: text("code_language"),
  expectedAnswer: text("expected_answer"), // for non-mcq formats (free-text)
  negativeMarks: integer("negative_marks").default(0).notNull(),
  timeLimitSec: integer("time_limit_sec"),
  tags: json("tags").$type<string[]>().default([]),
  explanation: text("explanation"),
  // Canonical pedagogical-content identity for scalable, per-bank dedupe.
  // Legacy/manual questions remain nullable until deliberately normalized.
  contentHash: text("content_hash"),
  answerMetadata: jsonb("answer_metadata").$type<Record<string, unknown> | null>(),
  reviewStatus: text("review_status").default("draft").notNull(),
  generationSource: text("generation_source").default("human").notNull(),
  reviewedBy: integer("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  version: integer("version").default(1).notNull(),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => ({
  canonicalHash: check("questions_content_hash_check", sql`${t.contentHash} IS NULL OR ${t.contentHash} ~ '^[0-9a-f]{64}$'`),
  answerMetadataObject: check("questions_answer_metadata_object_check", sql`${t.answerMetadata} IS NULL OR jsonb_typeof(${t.answerMetadata}) = 'object'`),
  bankContentHashUnique: uniqueIndex("questions_bank_content_hash_unique")
    .on(t.bankId, t.contentHash)
    .where(sql`${t.bankId} IS NOT NULL AND ${t.contentHash} IS NOT NULL`),
  ingestionInventory: index("questions_ingestion_inventory_idx")
    .on(t.bankId, t.generationSource, t.reviewStatus, t.isActive),
}));

// ── P1 Question Bank Pro tables ────────────────────────────────────────────
export const questionBanks = pgTable("question_banks", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  ownerType: text("owner_type").default("admin").notNull(), // admin | creator | institute
  ownerId: integer("owner_id"), // null = admin global
  visibility: text("visibility").default("private").notNull(), // private | unlisted | public
  bankPurpose: text("bank_purpose").default("certification").notNull(), // certification | practice
  bankKind: text("bank_kind").default("custom").notNull(), // assessment_pool | subject_pool | master | custom
  status: text("status").default("draft").notNull(), // draft | active | archived
  subject: text("subject"),
  examFamily: text("exam_family"),
  gradeBand: text("grade_band"),
  syllabusVersion: text("syllabus_version"),
  language: text("language").default("en").notNull(),
  tags: json("tags").$type<string[]>().default([]),
  questionCount: integer("question_count").default(0).notNull(),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  ownerSlugUniq: unique("qb_owner_slug_uniq").on(t.ownerType, t.ownerId, t.slug),
}));

export const questionTopics = pgTable("question_topics", {
  id: serial("id").primaryKey(),
  bankId: integer("bank_id").references(() => questionBanks.id, { onDelete: "cascade" }).notNull(),
  parentId: integer("parent_id"),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  bankSlugUnique: uniqueIndex("question_topics_bank_slug_unique").on(t.bankId, t.slug),
}));

// One durable row per physical JSONL input. A unique source/bank/file hash
// makes whole-pack retries idempotent, while batch counters allow safe resume
// after a process or network interruption.
export const questionPackImportRuns = pgTable("question_pack_import_runs", {
  id: serial("id").primaryKey(),
  sourceId: integer("source_id").references(() => questionPackSources.id, { onDelete: "restrict" }).notNull(),
  bankId: integer("bank_id").references(() => questionBanks.id, { onDelete: "restrict" }).notNull(),
  inputName: text("input_name").notNull(),
  inputSha256: text("input_sha256").notNull(),
  status: text("status").default("validating").notNull(), // validating | importing | completed | failed
  operator: text("operator").notNull(),
  batchSize: integer("batch_size").notNull(),
  maxRows: integer("max_rows").default(100_000).notNull(),
  totalRows: integer("total_rows").default(0).notNull(),
  validRows: integer("valid_rows").default(0).notNull(),
  invalidRows: integer("invalid_rows").default(0).notNull(),
  sourceDuplicateRows: integer("source_duplicate_rows").default(0).notNull(),
  contentDuplicateRows: integer("content_duplicate_rows").default(0).notNull(),
  processedRows: integer("processed_rows").default(0).notNull(),
  insertedQuestions: integer("inserted_questions").default(0).notNull(),
  linkedProvenance: integer("linked_provenance").default(0).notNull(),
  failureCode: text("failure_code"),
  failureMessage: text("failure_message"),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  sourceBankInputUnique: unique("question_pack_runs_source_bank_input_unique").on(t.sourceId, t.bankId, t.inputSha256),
  idSourceUnique: unique("question_pack_runs_id_source_unique").on(t.id, t.sourceId),
  byStatus: index("question_pack_runs_status_idx").on(t.status, t.startedAt),
  byBank: index("question_pack_runs_bank_idx").on(t.bankId, t.startedAt),
  status: check("question_pack_runs_status_check", sql`${t.status} IN ('validating','importing','completed','failed')`),
  inputHash: check("question_pack_runs_input_hash_check", sql`${t.inputSha256} ~ '^[0-9a-f]{64}$'`),
  batchBounds: check("question_pack_runs_batch_size_check", sql`${t.batchSize} BETWEEN 1 AND 2000`),
  rowBounds: check("question_pack_runs_max_rows_check", sql`${t.maxRows} BETWEEN 1 AND 100000`),
  counts: check("question_pack_runs_counts_check", sql`
    ${t.totalRows} >= 0 AND ${t.validRows} >= 0 AND ${t.invalidRows} >= 0
    AND ${t.sourceDuplicateRows} >= 0 AND ${t.contentDuplicateRows} >= 0
    AND ${t.processedRows} >= 0 AND ${t.insertedQuestions} >= 0 AND ${t.linkedProvenance} >= 0
    AND ${t.validRows} + ${t.invalidRows} <= ${t.totalRows}
    AND ${t.sourceDuplicateRows} <= ${t.validRows}
    AND ${t.contentDuplicateRows} <= ${t.validRows}
    AND ${t.processedRows} <= ${t.validRows}
    AND ${t.insertedQuestions} <= ${t.processedRows}
    AND ${t.linkedProvenance} <= ${t.processedRows}
  `),
}));

// Immutable source-record lineage. Multiple licensed source records may resolve
// to one canonical question when their pedagogical content hashes match.
export const questionProvenance = pgTable("question_provenance", {
  id: serial("id").primaryKey(),
  questionId: integer("question_id").references(() => questions.id, { onDelete: "restrict" }).notNull(),
  sourceId: integer("source_id").references(() => questionPackSources.id, { onDelete: "restrict" }).notNull(),
  importRunId: integer("import_run_id").references(() => questionPackImportRuns.id, { onDelete: "restrict" }).notNull(),
  sourceRecordId: text("source_record_id").notNull(),
  sourceRecordHash: text("source_record_hash").notNull(),
  contentHash: text("content_hash").notNull(),
  disposition: text("disposition").notNull(), // created | deduplicated
  language: text("language").notNull(),
  syllabus: text("syllabus"),
  examName: text("exam_name"),
  examYear: integer("exam_year"),
  subject: text("subject").notNull(),
  sourceTopic: text("source_topic").notNull(),
  objective: text("objective"),
  sourceLocator: text("source_locator").notNull(),
  questionOrigin: text("question_origin").notNull(),
  answerEvidence: text("answer_evidence").notNull(),
  explanationOrigin: text("explanation_origin").notNull(),
  sourceMetadata: jsonb("source_metadata").$type<Record<string, unknown>>().default({}).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  sourceRecordUnique: unique("question_provenance_source_record_unique").on(t.sourceId, t.sourceRecordId),
  runSourceReference: foreignKey({
    columns: [t.importRunId, t.sourceId],
    foreignColumns: [questionPackImportRuns.id, questionPackImportRuns.sourceId],
    name: "question_provenance_run_source_fk",
  }).onDelete("restrict"),
  byQuestion: index("question_provenance_question_idx").on(t.questionId),
  byRun: index("question_provenance_run_idx").on(t.importRunId),
  byContent: index("question_provenance_source_content_idx").on(t.sourceId, t.contentHash),
  sourceRecordId: check("question_provenance_record_id_check", sql`${t.sourceRecordId} = btrim(${t.sourceRecordId}) AND length(${t.sourceRecordId}) BETWEEN 3 AND 300`),
  sourceRecordHash: check("question_provenance_record_hash_check", sql`${t.sourceRecordHash} ~ '^[0-9a-f]{64}$'`),
  canonicalHash: check("question_provenance_content_hash_check", sql`${t.contentHash} ~ '^[0-9a-f]{64}$'`),
  disposition: check("question_provenance_disposition_check", sql`${t.disposition} IN ('created','deduplicated')`),
  questionOrigin: check("question_provenance_origin_check", sql`${t.questionOrigin} IN ('original','licensed_verbatim','licensed_adapted')`),
  explanationOrigin: check("question_provenance_explanation_origin_check", sql`${t.explanationOrigin} IN ('original','licensed_verbatim','licensed_adapted')`),
  examYear: check("question_provenance_exam_year_check", sql`${t.examYear} IS NULL OR ${t.examYear} BETWEEN 1900 AND 2100`),
  evidence: check("question_provenance_evidence_check", sql`length(btrim(${t.sourceLocator})) >= 3 AND length(btrim(${t.answerEvidence})) >= 10`),
  sourceMetadataObject: check("question_provenance_metadata_object_check", sql`jsonb_typeof(${t.sourceMetadata}) = 'object'`),
}));

export const questionVersions = pgTable("question_versions", {
  id: serial("id").primaryKey(),
  questionId: integer("question_id").references(() => questions.id, { onDelete: "cascade" }).notNull(),
  version: integer("version").notNull(),
  snapshot: json("snapshot").$type<Record<string, unknown>>().notNull(),
  changeNote: text("change_note"),
  changedBy: integer("changed_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const courseQuestionBlueprint = pgTable("course_question_blueprint", {
  id: serial("id").primaryKey(),
  courseId: integer("course_id").references(() => courses.id, { onDelete: "cascade" }).notNull(),
  // Explicit bank assignment keeps the pool visible and governable. A topic
  // is optional when a rule deliberately draws from the entire bank.
  bankId: integer("bank_id").references(() => questionBanks.id, { onDelete: "restrict" }).notNull(),
  topicId: integer("topic_id").references(() => questionTopics.id),
  questionCount: integer("question_count").notNull(),
  difficulty: text("difficulty").default("mixed").notNull(), // easy | medium | hard | mixed
  marksPerQuestion: integer("marks_per_question").default(1).notNull(),
  negativeMarks: integer("negative_marks").default(0).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  byCourse: index("course_question_blueprint_course_idx").on(t.courseId, t.sortOrder),
  byBank: index("course_question_blueprint_bank_idx").on(t.bankId, t.topicId, t.difficulty),
}));

export const courseQuestionBlueprintVersions = pgTable("course_question_blueprint_versions", {
  id: serial("id").primaryKey(),
  courseId: integer("course_id").references(() => courses.id, { onDelete: "cascade" }).notNull(),
  revision: integer("revision").notNull(),
  items: jsonb("items").$type<Array<Record<string, unknown>>>().notNull(),
  changeNote: text("change_note"),
  changedBy: integer("changed_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  courseRevisionUnique: unique("course_question_blueprint_versions_course_revision_unique").on(t.courseId, t.revision),
  byCourse: index("course_question_blueprint_versions_course_idx").on(t.courseId, t.revision),
}));

export const insertQuestionBankSchema = createInsertSchema(questionBanks).omit({
  id: true,
  questionCount: true,
  createdAt: true,
  updatedAt: true,
});

// Immutable, attributable evidence for governed assessment release. Every row
// is bound to an exact blueprint revision; database triggers in migration 0035
// reject updates/deletes and enforce cross-role separation.
export const assessmentAccessibilityAcceptances = pgTable("assessment_accessibility_acceptances", {
  id: serial("id").primaryKey(),
  assessmentId: integer("assessment_id").notNull(),
  blueprintRevision: integer("blueprint_revision").notNull(),
  reviewerUserId: integer("reviewer_user_id").references(() => users.id, { onDelete: "restrict" }).notNull(),
  standard: text("standard").notNull(),
  evidenceReference: text("evidence_reference").notNull(),
  evidenceSha256: text("evidence_sha256").notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }).notNull(),
  operator: text("operator").notNull(),
  recordedByUserId: integer("recorded_by_user_id").references(() => users.id, { onDelete: "restrict" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  revisionUnique: unique("assessment_accessibility_acceptances_revision_unique").on(t.assessmentId, t.blueprintRevision),
  revisionReference: foreignKey({
    columns: [t.assessmentId, t.blueprintRevision],
    foreignColumns: [courseQuestionBlueprintVersions.courseId, courseQuestionBlueprintVersions.revision],
    name: "assessment_accessibility_acceptances_revision_fk",
  }).onDelete("restrict"),
  byAssessment: index("assessment_accessibility_acceptances_assessment_idx").on(t.assessmentId, t.blueprintRevision, t.acceptedAt),
  revision: check("assessment_accessibility_acceptances_revision_check", sql`${t.blueprintRevision} >= 1`),
  standard: check("assessment_accessibility_acceptances_standard_check", sql`length(btrim(${t.standard})) BETWEEN 3 AND 120`),
  reference: check("assessment_accessibility_acceptances_reference_check", sql`length(btrim(${t.evidenceReference})) BETWEEN 8 AND 500`),
  hash: check("assessment_accessibility_acceptances_hash_check", sql`${t.evidenceSha256} ~ '^[0-9a-f]{64}$'`),
  operator: check("assessment_accessibility_acceptances_operator_check", sql`length(btrim(${t.operator})) BETWEEN 3 AND 200`),
}));

export const assessmentRightsRoleReviews = pgTable("assessment_rights_role_reviews", {
  id: serial("id").primaryKey(),
  assessmentId: integer("assessment_id").notNull(),
  blueprintRevision: integer("blueprint_revision").notNull(),
  sourceId: integer("source_id").references(() => questionPackSources.id, { onDelete: "restrict" }).notNull(),
  reviewerUserId: integer("reviewer_user_id").references(() => users.id, { onDelete: "restrict" }).notNull(),
  evidenceReference: text("evidence_reference").notNull(),
  evidenceSha256: text("evidence_sha256").notNull(),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }).notNull(),
  operator: text("operator").notNull(),
  recordedByUserId: integer("recorded_by_user_id").references(() => users.id, { onDelete: "restrict" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  sourceUnique: unique("assessment_rights_role_reviews_source_unique").on(t.assessmentId, t.blueprintRevision, t.sourceId),
  revisionReference: foreignKey({
    columns: [t.assessmentId, t.blueprintRevision],
    foreignColumns: [courseQuestionBlueprintVersions.courseId, courseQuestionBlueprintVersions.revision],
    name: "assessment_rights_role_reviews_revision_fk",
  }).onDelete("restrict"),
  byAssessment: index("assessment_rights_role_reviews_assessment_idx").on(t.assessmentId, t.blueprintRevision, t.sourceId),
  revision: check("assessment_rights_role_reviews_revision_check", sql`${t.blueprintRevision} >= 1`),
  reference: check("assessment_rights_role_reviews_reference_check", sql`length(btrim(${t.evidenceReference})) BETWEEN 8 AND 500`),
  hash: check("assessment_rights_role_reviews_hash_check", sql`${t.evidenceSha256} ~ '^[0-9a-f]{64}$'`),
  operator: check("assessment_rights_role_reviews_operator_check", sql`length(btrim(${t.operator})) BETWEEN 3 AND 200`),
}));

export const assessmentReleaseBundles = pgTable("assessment_release_bundles", {
  id: serial("id").primaryKey(),
  assessmentId: integer("assessment_id").notNull(),
  blueprintRevision: integer("blueprint_revision").notNull(),
  contentManifestSha256: text("content_manifest_sha256").notNull(),
  formSimulationReference: text("form_simulation_reference").notNull(),
  formSimulationSha256: text("form_simulation_sha256").notNull(),
  cutScore: integer("cut_score").notNull(),
  cutScoreMethod: text("cut_score_method").notNull(),
  cutScoreApprovalReference: text("cut_score_approval_reference").notNull(),
  cutScoreApprovalSha256: text("cut_score_approval_sha256").notNull(),
  cutScoreApproverUserId: integer("cut_score_approver_user_id").references(() => users.id, { onDelete: "restrict" }).notNull(),
  cutScoreApprovedAt: timestamp("cut_score_approved_at", { withTimezone: true }).notNull(),
  releaseQaReference: text("release_qa_reference").notNull(),
  releaseQaSha256: text("release_qa_sha256").notNull(),
  qaReviewerUserId: integer("qa_reviewer_user_id").references(() => users.id, { onDelete: "restrict" }).notNull(),
  qaAcceptedAt: timestamp("qa_accepted_at", { withTimezone: true }).notNull(),
  contentReviewerUserId: integer("content_reviewer_user_id").references(() => users.id, { onDelete: "restrict" }).notNull(),
  publisherUserId: integer("publisher_user_id").references(() => users.id, { onDelete: "restrict" }).notNull(),
  publisherSignedAt: timestamp("publisher_signed_at", { withTimezone: true }).notNull(),
  releaseCommit: text("release_commit").notNull(),
  releasedAt: timestamp("released_at", { withTimezone: true }).notNull(),
  rollbackOwnerUserId: integer("rollback_owner_user_id").references(() => users.id, { onDelete: "restrict" }).notNull(),
  takedownProcedure: text("takedown_procedure").notNull(),
  takedownProcedureSha256: text("takedown_procedure_sha256").notNull(),
  bundleSha256: text("bundle_sha256").notNull(),
  attestationMode: text("attestation_mode").default("multi_party").notNull(),
  accountableOfficerUserId: integer("accountable_officer_user_id").references(() => users.id, { onDelete: "restrict" }),
  singleOfficerAttestation: text("single_officer_attestation"),
  operator: text("operator").notNull(),
  recordedByUserId: integer("recorded_by_user_id").references(() => users.id, { onDelete: "restrict" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  revisionUnique: unique("assessment_release_bundles_revision_unique").on(t.assessmentId, t.blueprintRevision),
  revisionReference: foreignKey({
    columns: [t.assessmentId, t.blueprintRevision],
    foreignColumns: [courseQuestionBlueprintVersions.courseId, courseQuestionBlueprintVersions.revision],
    name: "assessment_release_bundles_revision_fk",
  }).onDelete("restrict"),
  byAssessment: index("assessment_release_bundles_assessment_idx").on(t.assessmentId, t.blueprintRevision, t.releasedAt),
  revision: check("assessment_release_bundles_revision_check", sql`${t.blueprintRevision} >= 1`),
  hashes: check("assessment_release_bundles_hashes_check", sql`
    ${t.contentManifestSha256} ~ '^[0-9a-f]{64}$'
    AND ${t.formSimulationSha256} ~ '^[0-9a-f]{64}$'
    AND ${t.cutScoreApprovalSha256} ~ '^[0-9a-f]{64}$'
    AND ${t.releaseQaSha256} ~ '^[0-9a-f]{64}$'
    AND ${t.takedownProcedureSha256} ~ '^[0-9a-f]{64}$'
    AND ${t.bundleSha256} ~ '^[0-9a-f]{64}$'
  `),
  references: check("assessment_release_bundles_references_check", sql`
    length(btrim(${t.formSimulationReference})) BETWEEN 8 AND 500
    AND length(btrim(${t.cutScoreApprovalReference})) BETWEEN 8 AND 500
    AND length(btrim(${t.releaseQaReference})) BETWEEN 8 AND 500
  `),
  cutScore: check("assessment_release_bundles_cut_score_check", sql`${t.cutScore} BETWEEN 0 AND 100`),
  cutScoreMethod: check("assessment_release_bundles_cut_score_method_check", sql`length(btrim(${t.cutScoreMethod})) BETWEEN 3 AND 500`),
  releaseCommit: check("assessment_release_bundles_commit_check", sql`${t.releaseCommit} ~ '^([0-9a-f]{40}|[0-9a-f]{64})$'`),
  takedown: check("assessment_release_bundles_takedown_check", sql`length(btrim(${t.takedownProcedure})) BETWEEN 20 AND 4000`),
  operator: check("assessment_release_bundles_operator_check", sql`length(btrim(${t.operator})) BETWEEN 3 AND 200`),
  timeOrder: check("assessment_release_bundles_time_order_check", sql`
    ${t.cutScoreApprovedAt} <= ${t.releasedAt}
    AND ${t.qaAcceptedAt} <= ${t.releasedAt}
    AND ${t.publisherSignedAt} <= ${t.releasedAt}
  `),
  attestationMode: check("assessment_release_bundles_attestation_mode_check", sql`
    (${t.attestationMode} = 'multi_party'
      AND ${t.accountableOfficerUserId} IS NULL
      AND ${t.singleOfficerAttestation} IS NULL
      AND ${t.contentReviewerUserId} <> ${t.cutScoreApproverUserId}
      AND ${t.contentReviewerUserId} <> ${t.qaReviewerUserId}
      AND ${t.contentReviewerUserId} <> ${t.publisherUserId}
      AND ${t.cutScoreApproverUserId} <> ${t.qaReviewerUserId}
      AND ${t.cutScoreApproverUserId} <> ${t.publisherUserId}
      AND ${t.qaReviewerUserId} <> ${t.publisherUserId})
    OR (${t.attestationMode} = 'single_accountable_officer'
      AND ${t.accountableOfficerUserId} IS NOT NULL
      AND length(btrim(${t.singleOfficerAttestation})) BETWEEN 20 AND 1000
      AND ${t.contentReviewerUserId} = ${t.accountableOfficerUserId}
      AND ${t.cutScoreApproverUserId} = ${t.accountableOfficerUserId}
      AND ${t.qaReviewerUserId} = ${t.accountableOfficerUserId}
      AND ${t.publisherUserId} = ${t.accountableOfficerUserId}
      AND ${t.rollbackOwnerUserId} = ${t.accountableOfficerUserId})
  `),
}));

// Immutable void records preserve the original false attribution for audit while
// preventing ordinary evaluators from accepting it. Role authorization is also
// an append-only grant/revoke event stream; migration 0036 enforces its policy.
export const assessmentReleaseEvidenceRevocations = pgTable("assessment_release_evidence_revocations", {
  id: serial("id").primaryKey(),
  releaseBundleId: integer("release_bundle_id").references(() => assessmentReleaseBundles.id, { onDelete: "restrict" }),
  accessibilityAcceptanceId: integer("accessibility_acceptance_id").references(() => assessmentAccessibilityAcceptances.id, { onDelete: "restrict" }),
  reason: text("reason").notNull(),
  recordedByUserId: integer("recorded_by_user_id").references(() => users.id, { onDelete: "restrict" }).notNull(),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  exactTarget: check("assessment_release_evidence_revocations_exact_target_check", sql`num_nonnulls(${t.releaseBundleId}, ${t.accessibilityAcceptanceId}) = 1`),
  reason: check("assessment_release_evidence_revocations_reason_check", sql`length(btrim(${t.reason})) BETWEEN 20 AND 1000`),
  bundleUnique: unique("assessment_release_evidence_revocations_bundle_unique").on(t.releaseBundleId),
  accessibilityUnique: unique("assessment_release_evidence_revocations_accessibility_unique").on(t.accessibilityAcceptanceId),
  byRecordedAt: index("assessment_release_evidence_revocations_recorded_at_idx").on(t.recordedAt, t.id),
}));

export const assessmentReleaseRoleAuthorizations = pgTable("assessment_release_role_authorizations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "restrict" }).notNull(),
  releaseRole: text("release_role").notNull(),
  authorizationAction: text("authorization_action").notNull(),
  supersedesAuthorizationId: integer("supersedes_authorization_id").references(
    (): AnyPgColumn => assessmentReleaseRoleAuthorizations.id,
    { onDelete: "restrict" },
  ),
  reason: text("reason").notNull(),
  recordedByUserId: integer("recorded_by_user_id").references(() => users.id, { onDelete: "restrict" }).notNull(),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  role: check("assessment_release_role_authorizations_role_check", sql`${t.releaseRole} IN ('release_operator', 'accessibility_reviewer', 'content_reviewer', 'rights_reviewer', 'cut_score_approver', 'qa_reviewer', 'publisher', 'rollback_owner')`),
  action: check("assessment_release_role_authorizations_action_check", sql`${t.authorizationAction} IN ('grant', 'revoke')`),
  eventShape: check("assessment_release_role_authorizations_event_shape_check", sql`(${t.authorizationAction} = 'grant' AND ${t.supersedesAuthorizationId} IS NULL) OR (${t.authorizationAction} = 'revoke' AND ${t.supersedesAuthorizationId} IS NOT NULL)`),
  reason: check("assessment_release_role_authorizations_reason_check", sql`length(btrim(${t.reason})) BETWEEN 20 AND 1000`),
  supersedesUnique: unique("assessment_release_role_authorizations_supersedes_unique").on(t.supersedesAuthorizationId),
  current: index("assessment_release_role_authorizations_current_idx").on(t.userId, t.releaseRole, t.authorizationAction, t.id),
}));

export const assessmentShellArchivalRecords = pgTable("assessment_shell_archival_records", {
  id: serial("id").primaryKey(),
  courseId: integer("course_id").references(() => courses.id, { onDelete: "restrict" }).notNull(),
  rationaleCode: text("rationale_code").notNull(),
  rationale: text("rationale").notNull(),
  decisionReference: text("decision_reference").notNull(),
  archivedAt: timestamp("archived_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  courseUnique: unique("assessment_shell_archival_records_course_unique").on(t.courseId),
  rationaleCode: check("assessment_shell_archival_records_code_check", sql`${t.rationaleCode} IN ('undefined_certification_claim', 'non_mcq_evidence_required', 'experience_claim_not_assessment')`),
  rationale: check("assessment_shell_archival_records_rationale_check", sql`length(btrim(${t.rationale})) BETWEEN 20 AND 1000`),
  decisionReference: check("assessment_shell_archival_records_reference_check", sql`length(btrim(${t.decisionReference})) BETWEEN 8 AND 200`),
  byArchivedAt: index("assessment_shell_archival_records_archived_at_idx").on(t.archivedAt, t.id),
}));

// Migration 0040 supersedes the legacy 0036 action stream with explicit,
// expirable grants and separate append-only revocations. Exceptional role
// consolidation is visible on the grant rather than hidden in operator notes.
export const assessmentReleaseRoleGrants = pgTable("assessment_release_role_grants", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "restrict" }).notNull(),
  releaseRole: text("release_role").notNull(),
  grantedByUserId: integer("granted_by_user_id").references(() => users.id, { onDelete: "restrict" }).notNull(),
  grantedAt: timestamp("granted_at", { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  reason: text("reason").notNull(),
  singleOfficerException: boolean("single_officer_exception").default(false).notNull(),
  singleOfficerExceptionReason: text("single_officer_exception_reason"),
}, (t) => ({
  role: check("assessment_release_role_grants_role_check", sql`${t.releaseRole} IN ('release_operator', 'accessibility_reviewer', 'content_reviewer', 'rights_reviewer', 'cut_score_approver', 'qa_reviewer', 'publisher', 'rollback_owner')`),
  expiry: check("assessment_release_role_grants_expiry_check", sql`${t.expiresAt} IS NULL OR ${t.expiresAt} > ${t.grantedAt}`),
  reason: check("assessment_release_role_grants_reason_check", sql`length(btrim(${t.reason})) BETWEEN 20 AND 1000`),
  exception: check("assessment_release_role_grants_exception_check", sql`(${t.singleOfficerException} = false AND ${t.singleOfficerExceptionReason} IS NULL) OR (${t.singleOfficerException} = true AND length(btrim(${t.singleOfficerExceptionReason})) BETWEEN 20 AND 1000)`),
  byPrincipal: index("assessment_release_role_grants_principal_idx").on(t.userId, t.releaseRole, t.grantedAt, t.id),
}));

export const assessmentReleaseRoleRevocations = pgTable("assessment_release_role_revocations", {
  id: serial("id").primaryKey(),
  grantId: integer("grant_id").references(() => assessmentReleaseRoleGrants.id, { onDelete: "restrict" }).notNull(),
  revokedByUserId: integer("revoked_by_user_id").references(() => users.id, { onDelete: "restrict" }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }).defaultNow().notNull(),
  reason: text("reason").notNull(),
}, (t) => ({
  grantUnique: unique("assessment_release_role_revocations_grant_unique").on(t.grantId),
  reason: check("assessment_release_role_revocations_reason_check", sql`length(btrim(${t.reason})) BETWEEN 20 AND 1000`),
  byRevokedAt: index("assessment_release_role_revocations_revoked_at_idx").on(t.revokedAt, t.id),
}));

export type AssessmentAccessibilityAcceptance = typeof assessmentAccessibilityAcceptances.$inferSelect;
export type InsertAssessmentAccessibilityAcceptance = typeof assessmentAccessibilityAcceptances.$inferInsert;
export type AssessmentRightsRoleReview = typeof assessmentRightsRoleReviews.$inferSelect;
export type InsertAssessmentRightsRoleReview = typeof assessmentRightsRoleReviews.$inferInsert;
export type AssessmentReleaseBundle = typeof assessmentReleaseBundles.$inferSelect;
export type InsertAssessmentReleaseBundle = typeof assessmentReleaseBundles.$inferInsert;
export type AssessmentReleaseEvidenceRevocation = typeof assessmentReleaseEvidenceRevocations.$inferSelect;
export type InsertAssessmentReleaseEvidenceRevocation = typeof assessmentReleaseEvidenceRevocations.$inferInsert;
export type AssessmentReleaseRoleAuthorization = typeof assessmentReleaseRoleAuthorizations.$inferSelect;
export type InsertAssessmentReleaseRoleAuthorization = typeof assessmentReleaseRoleAuthorizations.$inferInsert;
export type AssessmentShellArchivalRecord = typeof assessmentShellArchivalRecords.$inferSelect;
export type InsertAssessmentShellArchivalRecord = typeof assessmentShellArchivalRecords.$inferInsert;
export type AssessmentReleaseRoleGrant = typeof assessmentReleaseRoleGrants.$inferSelect;
export type InsertAssessmentReleaseRoleGrant = typeof assessmentReleaseRoleGrants.$inferInsert;
export type AssessmentReleaseRoleRevocation = typeof assessmentReleaseRoleRevocations.$inferSelect;
export type InsertAssessmentReleaseRoleRevocation = typeof assessmentReleaseRoleRevocations.$inferInsert;

export const insertQuestionTopicSchema = createInsertSchema(questionTopics).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertCourseBlueprintSchema = createInsertSchema(courseQuestionBlueprint).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type QuestionBank = typeof questionBanks.$inferSelect;
export type InsertQuestionBank = z.infer<typeof insertQuestionBankSchema>;
export type QuestionTopic = typeof questionTopics.$inferSelect;
export type InsertQuestionTopic = z.infer<typeof insertQuestionTopicSchema>;
export type QuestionVersion = typeof questionVersions.$inferSelect;
export type QuestionPackSource = typeof questionPackSources.$inferSelect;
export type QuestionPackImportRun = typeof questionPackImportRuns.$inferSelect;
export type QuestionProvenance = typeof questionProvenance.$inferSelect;
export type CourseBlueprintItem = typeof courseQuestionBlueprint.$inferSelect;
export type InsertCourseBlueprintItem = z.infer<typeof insertCourseBlueprintSchema>;
export type CourseBlueprintVersion = typeof courseQuestionBlueprintVersions.$inferSelect;

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
  // One server-issued exam session may produce at most one persisted attempt.
  // PostgreSQL permits multiple NULLs, so legacy/imported attempts remain valid.
  sessionId: text("session_id").unique(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  tabSwitches: integer("tab_switches").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const certificates = pgTable("certificates", {
  id: serial("id").primaryKey(),
  certificateId: text("certificate_id").notNull().unique(),
  examAttemptId: integer("exam_attempt_id").references(() => examAttempts.id),
  scheduledAttemptId: integer("scheduled_attempt_id").references(() => examInstanceAttempts.id).unique(),
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
  certificationMode: text("certification_mode").default("octamy").notNull(),
  fundingSource: text("funding_source").default("direct_payment").notNull(),
  issuerSnapshot: jsonb("issuer_snapshot"),
  coIssuerSnapshot: jsonb("co_issuer_snapshot"),
  retakeCount: integer("retake_count").default(0).notNull(),
  // Physical certificate shipping
  needsPhysicalCopy: boolean("needs_physical_copy").default(false).notNull(),
  shippingAddressId: integer("shipping_address_id").references(() => userAddresses.id),
  shippingStatus: text("shipping_status").default("not_required"), // not_required, pending, processing, shipped, delivered
  trackingNumber: text("tracking_number"),
  shippedAt: timestamp("shipped_at"),
  deliveredAt: timestamp("delivered_at"),
});

// Recruiter evidence disclosure is separate from global discovery. A learner
// selects exact evidence for one recruiter, one stated purpose, and a bounded
// period; profileVisibility is intentionally not part of this authorization.
export const candidateEvidenceGrants = pgTable("candidate_evidence_grants", {
  id: text("id").primaryKey(),
  learnerUserId: integer("learner_user_id").references(() => users.id, { onDelete: "restrict" }).notNull(),
  targetRecruiterId: integer("target_recruiter_id").references(() => recruiters.id, { onDelete: "restrict" }).notNull(),
  sourceProfileAccessLogId: integer("source_profile_access_log_id").references(() => profileAccessLogs.id, { onDelete: "restrict" }).notNull(),
  purpose: text("purpose").notNull(),
  jobReference: text("job_reference"),
  consentVersion: text("consent_version").notNull(),
  grantedAt: timestamp("granted_at", { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  revocationReason: text("revocation_reason"),
  creationRequestId: text("creation_request_id").notNull(),
  version: integer("version").default(1).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  byLearner: index("candidate_evidence_grants_learner_idx").on(t.learnerUserId, t.grantedAt),
  byRecruiterLearner: index("candidate_evidence_grants_recruiter_learner_idx")
    .on(t.targetRecruiterId, t.learnerUserId, t.expiresAt)
    .where(sql`${t.revokedAt} IS NULL`),
  validId: check("candidate_evidence_grants_id_check", sql`${t.id} ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'`),
  validPurpose: check("candidate_evidence_grants_purpose_check", sql`length(btrim(${t.purpose})) BETWEEN 3 AND 500`),
  validJobReference: check("candidate_evidence_grants_job_reference_check", sql`${t.jobReference} IS NULL OR length(btrim(${t.jobReference})) BETWEEN 1 AND 200`),
  validConsent: check("candidate_evidence_grants_consent_check", sql`${t.consentVersion} = 'candidate-evidence-consent.v1'`),
  validExpiry: check("candidate_evidence_grants_expiry_check", sql`${t.expiresAt} > ${t.grantedAt} AND ${t.expiresAt} <= ${t.grantedAt} + interval '30 days'`),
  validRevocation: check("candidate_evidence_grants_revocation_check", sql`${t.revokedAt} IS NULL OR ${t.revokedAt} >= ${t.grantedAt}`),
  validVersion: check("candidate_evidence_grants_version_check", sql`${t.version} >= 1`),
}));

export const candidateEvidenceGrantCertificates = pgTable("candidate_evidence_grant_certificates", {
  grantId: text("grant_id").references(() => candidateEvidenceGrants.id, { onDelete: "restrict" }).notNull(),
  certificateId: integer("certificate_id").references(() => certificates.id, { onDelete: "restrict" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  uniqueGrantCertificate: unique("candidate_evidence_grant_certificates_unique").on(t.grantId, t.certificateId),
  byCertificate: index("candidate_evidence_grant_certificates_certificate_idx").on(t.certificateId, t.grantId),
}));

export const candidateEvidenceGrantPracticeSummaries = pgTable("candidate_evidence_grant_practice_summaries", {
  grantId: text("grant_id").references(() => candidateEvidenceGrants.id, { onDelete: "restrict" }).notNull(),
  examAttemptId: integer("exam_attempt_id").references(() => examAttempts.id, { onDelete: "restrict" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  uniqueGrantAttempt: unique("candidate_evidence_grant_practice_summaries_unique").on(t.grantId, t.examAttemptId),
  byAttempt: index("candidate_evidence_grant_practice_summaries_attempt_idx").on(t.examAttemptId, t.grantId),
}));

export const candidateEvidenceAccessEvents = pgTable("candidate_evidence_access_events", {
  id: serial("id").primaryKey(),
  grantId: text("grant_id").references(() => candidateEvidenceGrants.id, { onDelete: "restrict" }).notNull(),
  learnerUserId: integer("learner_user_id").references(() => users.id, { onDelete: "restrict" }).notNull(),
  recruiterId: integer("recruiter_id").references(() => recruiters.id, { onDelete: "restrict" }).notNull(),
  action: text("action").notNull(),
  scopes: text("scopes").array().notNull(),
  selectedCertificateIds: integer("selected_certificate_ids").array().notNull(),
  selectedPracticeSummaryIds: integer("selected_practice_summary_ids").array().notNull(),
  requestId: text("request_id").notNull(),
  policyVersion: text("policy_version").notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  byLearnerTime: index("candidate_evidence_access_events_learner_time_idx").on(t.learnerUserId, t.occurredAt, t.id),
  byGrantTime: index("candidate_evidence_access_events_grant_time_idx").on(t.grantId, t.occurredAt, t.id),
  validAction: check("candidate_evidence_access_events_action_check", sql`${t.action} = 'evidence_disclosed'`),
  validPolicy: check("candidate_evidence_access_events_policy_check", sql`${t.policyVersion} = 'candidate-evidence-policy.v1'`),
  validScopes: check("candidate_evidence_access_events_scopes_check", sql`${t.scopes} <@ ARRAY['certification','practice_summary']::text[]`),
}));

export type CandidateEvidenceGrant = typeof candidateEvidenceGrants.$inferSelect;
export type InsertCandidateEvidenceGrant = typeof candidateEvidenceGrants.$inferInsert;
export type CandidateEvidenceGrantCertificate = typeof candidateEvidenceGrantCertificates.$inferSelect;
export type CandidateEvidenceGrantPracticeSummary = typeof candidateEvidenceGrantPracticeSummaries.$inferSelect;
export type CandidateEvidenceAccessEvent = typeof candidateEvidenceAccessEvents.$inferSelect;

// Immutable audit of subscription-funded benefits. `externalKey` is the
// pending/scheduled attempt identity, making redemption idempotent even when a
// browser retries after a lost response.
export const subscriptionBenefitUsages = pgTable("subscription_benefit_usages", {
  id: serial("id").primaryKey(),
  subscriptionId: integer("subscription_id").references(() => subscriptions.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  courseId: integer("course_id").references(() => courses.id).notNull(),
  certificateId: integer("certificate_id").references(() => certificates.id),
  benefitType: text("benefit_type").notNull(), // inhouse_assessment_credential
  externalKey: text("external_key").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  uniqueRedemption: unique("subscription_benefit_usages_redemption_unique").on(
    t.subscriptionId,
    t.benefitType,
    t.externalKey,
  ),
  uniqueExternalBenefit: unique("subscription_benefit_usages_external_unique").on(t.benefitType, t.externalKey),
  byUser: index("subscription_benefit_usages_user_idx").on(t.userId, t.createdAt),
}));

// Institute-sponsored certification vouchers are bearer entitlements with a
// narrow course/batch scope. Only a SHA-256 digest is persisted; raw codes are
// returned once at issuance and must be distributed through an approved
// institute workflow. This prevents a database read from exposing live codes.
export const certificationVoucherBatches = pgTable("certification_voucher_batches", {
  id: serial("id").primaryKey(),
  instituteId: integer("institute_id").references(() => institutes.id, { onDelete: "restrict" }),
  creatorId: integer("creator_id").references(() => creators.id, { onDelete: "restrict" }),
  courseId: integer("course_id").references(() => courses.id, { onDelete: "restrict" }),
  name: text("name").notNull(),
  quantity: integer("quantity").notNull(),
  status: text("status").default("active").notNull(), // active | paused | exhausted | revoked
  expiresAt: timestamp("expires_at").notNull(),
  createdBy: integer("created_by").references(() => users.id, { onDelete: "restrict" }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  byInstitute: index("certification_voucher_batches_institute_idx").on(t.instituteId, t.createdAt),
  byCreator: index("certification_voucher_batches_creator_idx").on(t.creatorId, t.createdAt),
  byCourse: index("certification_voucher_batches_course_idx").on(t.courseId, t.status),
}));

// Creators and institutes request sponsored voucher allocations; Octamy
// reviews and issues the actual bearer codes. This keeps free in-house
// credential issuance governed while giving both workspaces a real workflow.
export const voucherProgramRequests = pgTable("voucher_program_requests", {
  id: serial("id").primaryKey(),
  requesterType: text("requester_type").notNull(), // creator | institute
  requesterId: integer("requester_id").notNull(),
  courseId: integer("course_id").references(() => courses.id, { onDelete: "restrict" }),
  quantity: integer("quantity").notNull(),
  purpose: text("purpose").notNull(),
  status: text("status").default("pending").notNull(), // pending | approved | rejected | cancelled
  reviewNote: text("review_note"),
  reviewedBy: integer("reviewed_by").references(() => users.id, { onDelete: "set null" }),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  byRequester: index("voucher_program_requests_requester_idx").on(t.requesterType, t.requesterId, t.createdAt),
  byStatus: index("voucher_program_requests_status_idx").on(t.status, t.createdAt),
}));

export const certificationVouchers = pgTable("certification_vouchers", {
  id: serial("id").primaryKey(),
  batchId: integer("batch_id").references(() => certificationVoucherBatches.id, { onDelete: "restrict" }).notNull(),
  codeHash: varchar("code_hash", { length: 64 }).notNull().unique(),
  codeHint: text("code_hint").notNull(),
  assignedEmail: text("assigned_email"),
  assignedUserId: integer("assigned_user_id").references(() => users.id, { onDelete: "set null" }),
  status: text("status").default("available").notNull(), // available | assigned | redeemed | revoked
  assignedAt: timestamp("assigned_at"),
  redeemedBy: integer("redeemed_by").references(() => users.id, { onDelete: "set null" }),
  certificateId: integer("certificate_id").references(() => certificates.id, { onDelete: "restrict" }).unique(),
  redemptionKeyHash: varchar("redemption_key_hash", { length: 64 }),
  redeemedAt: timestamp("redeemed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  byBatchStatus: index("certification_vouchers_batch_status_idx").on(t.batchId, t.status),
  byAssignedEmail: index("certification_vouchers_assigned_email_idx").on(t.assignedEmail, t.status),
}));

// Coupons discount an otherwise payable price. They never issue a credential
// by themselves and are deliberately separate from sponsorship vouchers.
export const discountCoupons = pgTable("discount_coupons", {
  id: serial("id").primaryKey(),
  codeHash: varchar("code_hash", { length: 64 }).notNull().unique(),
  codeHint: text("code_hint").notNull(),
  name: text("name").notNull(),
  ownerType: text("owner_type").default("admin").notNull(), // admin | creator | institute
  ownerId: integer("owner_id"),
  courseId: integer("course_id").references(() => courses.id, { onDelete: "restrict" }),
  discountType: text("discount_type").notNull(), // percent | fixed
  discountValue: decimal("discount_value", { precision: 10, scale: 2 }).notNull(),
  status: text("status").default("active").notNull(), // active | paused | expired | revoked
  validFrom: timestamp("valid_from").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  maxRedemptions: integer("max_redemptions"),
  perUserLimit: integer("per_user_limit").default(1).notNull(),
  redemptionCount: integer("redemption_count").default(0).notNull(),
  createdBy: integer("created_by").references(() => users.id, { onDelete: "restrict" }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  byOwner: index("discount_coupons_owner_idx").on(t.ownerType, t.ownerId, t.createdAt),
  byCourseStatus: index("discount_coupons_course_status_idx").on(t.courseId, t.status),
  byValidity: index("discount_coupons_validity_idx").on(t.status, t.validFrom, t.expiresAt),
}));

export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  certificateId: integer("certificate_id").references(() => certificates.id),
  userId: integer("user_id").references(() => users.id),
  courseId: integer("course_id").references(() => courses.id),
  transactionId: text("transaction_id").notNull().unique(),
  gateway: text("gateway").default("payumoney").notNull(), // payumoney | cashfree
  paymentMethod: text("payment_method").default("payumoney").notNull(),
  razorpayPaymentId: text("razorpay_payment_id"),
  razorpayOrderId: text("razorpay_order_id"),
  cashfreeOrderId: text("cashfree_order_id"),
  cashfreePaymentId: text("cashfree_payment_id"),
  gatewayStatusRaw: jsonb("gateway_status_raw"),

  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").default("INR").notNull(),
  status: text("status").notNull(),
  // Physical certificate shipping
  certificateAmount: decimal("certificate_amount", { precision: 10, scale: 2 }).notNull(),
  shippingAmount: decimal("shipping_amount", { precision: 10, scale: 2 }).default("0.00").notNull(),
  includesPhysicalCopy: boolean("includes_physical_copy").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const couponRedemptions = pgTable("coupon_redemptions", {
  id: serial("id").primaryKey(),
  couponId: integer("coupon_id").references(() => discountCoupons.id, { onDelete: "restrict" }).notNull(),
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  userEmail: text("user_email").notNull(),
  courseId: integer("course_id").references(() => courses.id, { onDelete: "restrict" }).notNull(),
  paymentId: integer("payment_id").references(() => payments.id, { onDelete: "restrict" }),
  externalKey: text("external_key").notNull().unique(),
  originalAmount: decimal("original_amount", { precision: 10, scale: 2 }).notNull(),
  discountAmount: decimal("discount_amount", { precision: 10, scale: 2 }).notNull(),
  finalAmount: decimal("final_amount", { precision: 10, scale: 2 }).notNull(),
  redeemedAt: timestamp("redeemed_at").defaultNow().notNull(),
}, (t) => ({
  byCoupon: index("coupon_redemptions_coupon_idx").on(t.couponId, t.redeemedAt),
  byUser: index("coupon_redemptions_user_idx").on(t.userId, t.redeemedAt),
}));

// Server-enforced access to paid video/PDF/text course content. Preview lessons
// remain public; non-preview content URLs are redacted without an entitlement.
export const courseEntitlements = pgTable("course_entitlements", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  courseId: integer("course_id").references(() => courses.id, { onDelete: "cascade" }).notNull(),
  paymentId: integer("payment_id").references(() => payments.id),
  status: text("status").default("active").notNull(), // active | revoked | refunded
  source: text("source").default("purchase").notNull(), // purchase | free | admin
  grantedAt: timestamp("granted_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"),
}, (t) => ({
  uniqUserCourse: unique("course_entitlements_user_course_uniq").on(t.userId, t.courseId),
  byUser: index("course_entitlements_user_idx").on(t.userId),
  byCourse: index("course_entitlements_course_idx").on(t.courseId),
}));

export type CourseEntitlement = typeof courseEntitlements.$inferSelect;

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
  googleId: text("google_id").unique(),
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
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  correctMap: jsonb("correct_map").notNull(),
  questionSnapshot: jsonb("question_snapshot").$type<Array<{
    id: number;
    question: string;
    options: string[];
    correctAnswer: number;
  }>>().default([]).notNull(),
  evidenceConsentAt: timestamp("evidence_consent_at"),
  evidenceConsentVersion: text("evidence_consent_version"),
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
}, (table) => [
  unique("user_learning_paths_user_path_unique").on(table.userId, table.learningPathId),
]);

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
}, (table) => [
  unique("user_course_progress_user_course_unique").on(table.userId, table.courseId),
]);

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
  scheduledAttempt: one(examInstanceAttempts, {
    fields: [certificates.scheduledAttemptId],
    references: [examInstanceAttempts.id],
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
  createdAt: true,
  updatedAt: true,
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
export type AudienceBand = typeof audienceBands.$inferSelect;
export type CourseAudienceBand = typeof courseAudienceBands.$inferSelect;
export type CourseCategory = typeof courseCategories.$inferSelect;
export type SubscriptionBenefitUsage = typeof subscriptionBenefitUsages.$inferSelect;
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

// Interview Studio is the auditable replacement for the legacy AI interview
// prototype below. Published template payloads are immutable; sessions keep a
// complete snapshot so later template versions cannot change learner evidence.
export const interviewStudioTemplates = pgTable("interview_studio_templates", {
  id: serial("id").primaryKey(),
  templateKey: text("template_key").notNull(),
  version: integer("version").notNull(),
  ownerType: text("owner_type").default("admin").notNull(), // admin | creator | institute
  ownerId: integer("owner_id"),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  state: text("state").default("draft").notNull(), // draft | published | retired
  isCurrent: boolean("is_current").default(false).notNull(),
  supportedModes: jsonb("supported_modes").$type<Array<"practice" | "verified">>().notNull(),
  rubricVersion: text("rubric_version").notNull(),
  blueprint: jsonb("blueprint").$type<InterviewStudioBlueprint>().notNull(),
  blueprintHash: text("blueprint_hash").notNull(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  keyVersionUnique: unique("interview_studio_templates_key_version_unique").on(t.templateKey, t.version),
  currentKeyUnique: uniqueIndex("interview_studio_templates_current_key_unique")
    .on(t.templateKey)
    .where(sql`${t.isCurrent} = true`),
  byOwnerState: index("interview_studio_templates_owner_state_idx").on(t.ownerType, t.ownerId, t.state, t.createdAt),
  validVersion: check("interview_studio_templates_version_check", sql`${t.version} > 0`),
  validKey: check("interview_studio_templates_key_check", sql`${t.templateKey} ~ '^[a-z0-9][a-z0-9._-]{2,119}$'`),
  validOwner: check("interview_studio_templates_owner_check", sql`
    (${t.ownerType} = 'admin' AND ${t.ownerId} IS NULL)
    OR (${t.ownerType} IN ('creator', 'institute') AND ${t.ownerId} IS NOT NULL)
  `),
  validState: check("interview_studio_templates_state_check", sql`${t.state} IN ('draft','published','retired')`),
  publishedState: check("interview_studio_templates_published_check", sql`
    (${t.state} = 'published' AND ${t.publishedAt} IS NOT NULL)
    OR (${t.state} <> 'published' AND ${t.isCurrent} = false)
  `),
  modesArray: check("interview_studio_templates_modes_check", sql`
    jsonb_typeof(${t.supportedModes}) = 'array'
    AND jsonb_array_length(${t.supportedModes}) BETWEEN 1 AND 2
    AND ${t.supportedModes} <@ '["practice","verified"]'::jsonb
  `),
  blueprintObject: check("interview_studio_templates_blueprint_check", sql`
    jsonb_typeof(${t.blueprint}) = 'object'
    AND ${t.blueprint}->>'schemaVersion' = 'interview-studio-blueprint/v1'
    AND ${t.blueprint}->>'templateKey' = ${t.templateKey}
    AND (${t.blueprint}->>'version')::integer = ${t.version}
    AND ${t.blueprint}->>'rubricVersion' = ${t.rubricVersion}
  `),
  modeSnapshot: check("interview_studio_templates_mode_snapshot_check", sql`
    ${t.supportedModes} @> (${t.blueprint}->'allowedModes')
    AND ${t.supportedModes} <@ (${t.blueprint}->'allowedModes')
  `),
  validHash: check("interview_studio_templates_hash_check", sql`${t.blueprintHash} ~ '^[0-9a-f]{64}$'`),
}));

export const interviewStudioSessions = pgTable("interview_studio_sessions", {
  id: text("id").primaryKey(),
  templateId: integer("template_id").references(() => interviewStudioTemplates.id, { onDelete: "restrict" }).notNull(),
  templateKey: text("template_key").notNull(),
  templateVersion: integer("template_version").notNull(),
  userId: integer("user_id").references(() => users.id, { onDelete: "restrict" }).notNull(),
  mode: text("mode").notNull(), // practice | verified
  status: text("status").default("ready").notNull(),
  blueprintSnapshot: jsonb("blueprint_snapshot").$type<InterviewStudioBlueprint>().notNull(),
  blueprintHash: text("blueprint_hash").notNull(),
  consentSnapshot: jsonb("consent_snapshot").$type<InterviewStudioConsentSnapshot>().notNull(),
  permissionSnapshot: jsonb("permission_snapshot").$type<InterviewStudioPermissionSnapshot>().notNull(),
  // Set once, atomically with ready -> in_progress, from the server clock.
  serverDeadlineAt: timestamp("server_deadline_at", { withTimezone: true }),
  evaluationStatus: text("evaluation_status").default("not_requested").notNull(),
  overallScore: integer("overall_score"),
  evaluation: jsonb("evaluation").$type<InterviewStudioOverallEvaluation>(),
  evaluationModel: text("evaluation_model"),
  evaluationPromptVersion: text("evaluation_prompt_version"),
  evaluationStartedAt: timestamp("evaluation_started_at", { withTimezone: true }),
  evaluationCompletedAt: timestamp("evaluation_completed_at", { withTimezone: true }),
  recruiterSharingEnabled: boolean("recruiter_sharing_enabled").default(false).notNull(),
  recruiterSharingEnabledAt: timestamp("recruiter_sharing_enabled_at", { withTimezone: true }),
  retentionUntil: timestamp("retention_until", { withTimezone: true }).default(sql`now() + interval '30 days'`).notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  byLearner: index("interview_studio_sessions_learner_idx").on(t.userId, t.status, t.createdAt),
  byDeadline: index("interview_studio_sessions_deadline_idx").on(t.status, t.serverDeadlineAt),
  byRetention: index("interview_studio_sessions_retention_idx").on(t.retentionUntil),
  validId: check("interview_studio_sessions_id_check", sql`${t.id} ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'`),
  validMode: check("interview_studio_sessions_mode_check", sql`${t.mode} IN ('practice','verified')`),
  validStatus: check("interview_studio_sessions_status_check", sql`
    ${t.status} IN ('ready','in_progress','evaluating','completed','review_required','expired','cancelled')
  `),
  validEvaluationStatus: check("interview_studio_sessions_evaluation_status_check", sql`
    ${t.evaluationStatus} IN ('not_requested','pending','in_progress','completed','failed','review_required')
  `),
  validScore: check("interview_studio_sessions_score_check", sql`${t.overallScore} IS NULL OR ${t.overallScore} BETWEEN 0 AND 100`),
  validHash: check("interview_studio_sessions_hash_check", sql`${t.blueprintHash} ~ '^[0-9a-f]{64}$'`),
  snapshots: check("interview_studio_sessions_snapshots_check", sql`
    jsonb_typeof(${t.blueprintSnapshot}) = 'object'
    AND jsonb_typeof(${t.consentSnapshot}) = 'object'
    AND jsonb_typeof(${t.permissionSnapshot}) = 'object'
    AND ${t.blueprintSnapshot}->>'templateKey' = ${t.templateKey}
    AND (${t.blueprintSnapshot}->>'version')::integer = ${t.templateVersion}
    AND ${t.consentSnapshot}->>'recruiterSharing' IN ('true','false')
    AND (
      ${t.mode} <> 'practice'
      OR (
        ${t.consentSnapshot}->>'recruiterSharing' = 'false'
        AND ${t.consentSnapshot}->>'cameraRecording' = 'false'
        AND ${t.consentSnapshot}->>'screenRecording' = 'false'
      )
    )
  `),
  deadlineAfterCreation: check("interview_studio_sessions_deadline_check", sql`
    ${t.serverDeadlineAt} IS NULL OR ${t.serverDeadlineAt} > ${t.createdAt}
  `),
  retentionAfterCreation: check("interview_studio_sessions_retention_check", sql`${t.retentionUntil} > ${t.createdAt}`),
  sharingTimestamp: check("interview_studio_sessions_sharing_check", sql`
    (${t.recruiterSharingEnabled} = false AND ${t.recruiterSharingEnabledAt} IS NULL)
    OR (
      ${t.recruiterSharingEnabled} = true
      AND ${t.recruiterSharingEnabledAt} IS NOT NULL
      AND ${t.mode} = 'verified'
      AND ${t.status} = 'completed'
      AND ${t.consentSnapshot}->>'recruiterSharing' = 'true'
    )
  `),
}));

export const interviewStudioResponses = pgTable("interview_studio_responses", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").references(() => interviewStudioSessions.id, { onDelete: "cascade" }).notNull(),
  itemKey: text("item_key").notNull(),
  itemKind: text("item_kind").notNull(), // structured_response | coding
  answerText: text("answer_text"),
  code: text("code"),
  language: text("language"),
  timeSpentSeconds: integer("time_spent_seconds").default(0).notNull(),
  answerHash: text("answer_hash"),
  sampleTestResult: jsonb("sample_test_result").$type<InterviewStudioTestRunResult>(),
  finalTestResult: jsonb("final_test_result").$type<InterviewStudioTestRunResult>(),
  evaluationStatus: text("evaluation_status").default("not_requested").notNull(),
  evaluation: jsonb("evaluation").$type<InterviewStudioItemEvaluation>(),
  evaluationModel: text("evaluation_model"),
  evaluationPromptVersion: text("evaluation_prompt_version"),
  isFinal: boolean("is_final").default(false).notNull(),
  finalizedAt: timestamp("finalized_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  sessionItemUnique: unique("interview_studio_responses_session_item_unique").on(t.sessionId, t.itemKey),
  bySession: index("interview_studio_responses_session_idx").on(t.sessionId, t.createdAt),
  validKind: check("interview_studio_responses_kind_check", sql`${t.itemKind} IN ('structured_response','coding')`),
  validLanguage: check("interview_studio_responses_language_check", sql`
    (${t.itemKind} = 'structured_response' AND ${t.language} IS NULL AND ${t.code} IS NULL)
    OR (${t.itemKind} = 'coding' AND ${t.language} = 'javascript')
  `),
  hasAnswer: check("interview_studio_responses_answer_check", sql`${t.answerText} IS NOT NULL OR ${t.code} IS NOT NULL`),
  validHash: check("interview_studio_responses_hash_check", sql`${t.answerHash} IS NULL OR ${t.answerHash} ~ '^[0-9a-f]{64}$'`),
  validTimeSpent: check("interview_studio_responses_time_spent_check", sql`${t.timeSpentSeconds} BETWEEN 0 AND 86400`),
  testResultObjects: check("interview_studio_responses_test_results_check", sql`
    (${t.sampleTestResult} IS NULL OR jsonb_typeof(${t.sampleTestResult}) = 'object')
    AND (${t.finalTestResult} IS NULL OR jsonb_typeof(${t.finalTestResult}) = 'object')
  `),
  validEvaluationStatus: check("interview_studio_responses_evaluation_status_check", sql`
    ${t.evaluationStatus} IN ('not_requested','pending','in_progress','completed','failed','review_required')
  `),
  finalTimestamp: check("interview_studio_responses_finalized_check", sql`
    (${t.isFinal} = false AND ${t.finalizedAt} IS NULL) OR (${t.isFinal} = true AND ${t.finalizedAt} IS NOT NULL)
  `),
}));

// Durable outbox/queue for asynchronous Interview Studio evaluation. A
// session has exactly one job, so retries and process crashes cannot create a
// second billable evaluation pipeline for the same immutable submission.
export const interviewStudioEvaluationJobs = pgTable("interview_studio_evaluation_jobs", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").references(() => interviewStudioSessions.id, { onDelete: "cascade" }).notNull(),
  status: text("status").default("queued").notNull(), // queued | running | completed | failed
  attempts: integer("attempts").default(0).notNull(),
  maxAttempts: integer("max_attempts").default(3).notNull(),
  aiEvaluationAllowed: boolean("ai_evaluation_allowed").default(false).notNull(),
  codeRunnerAllowed: boolean("code_runner_allowed").default(false).notNull(),
  availableAt: timestamp("available_at", { withTimezone: true }).defaultNow().notNull(),
  lockedAt: timestamp("locked_at", { withTimezone: true }),
  lockedBy: text("locked_by"),
  lastErrorCode: text("last_error_code"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  sessionUnique: unique("interview_studio_evaluation_jobs_session_unique").on(t.sessionId),
  availableJob: index("interview_studio_evaluation_jobs_available_idx").on(t.status, t.availableAt, t.id),
  staleLease: index("interview_studio_evaluation_jobs_stale_lease_idx").on(t.status, t.lockedAt),
  validId: check("interview_studio_evaluation_jobs_id_check", sql`${t.id} ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'`),
  validStatus: check("interview_studio_evaluation_jobs_status_check", sql`${t.status} IN ('queued','running','completed','failed')`),
  validAttempts: check("interview_studio_evaluation_jobs_attempts_check", sql`${t.attempts} BETWEEN 0 AND ${t.maxAttempts} AND ${t.maxAttempts} BETWEEN 1 AND 10`),
  leasePair: check("interview_studio_evaluation_jobs_lease_check", sql`
    (${t.status} = 'running' AND ${t.lockedAt} IS NOT NULL AND ${t.lockedBy} IS NOT NULL)
    OR (${t.status} <> 'running' AND ${t.lockedAt} IS NULL AND ${t.lockedBy} IS NULL)
  `),
  terminalTimestamp: check("interview_studio_evaluation_jobs_completed_check", sql`
    (${t.status} IN ('completed','failed') AND ${t.completedAt} IS NOT NULL)
    OR (${t.status} NOT IN ('completed','failed') AND ${t.completedAt} IS NULL)
  `),
}));

// Persistent per-account allowance. It deliberately does not reference a
// session, so deleting a private practice session never restores AI quota.
export const interviewStudioDailyUsage = pgTable("interview_studio_daily_usage", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  usageDate: date("usage_date", { mode: "string" }).notNull(),
  evaluationJobs: integer("evaluation_jobs").default(0).notNull(),
  aiEvaluationJobs: integer("ai_evaluation_jobs").default(0).notNull(),
  codeRunnerJobs: integer("code_runner_jobs").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  userDayUnique: unique("interview_studio_daily_usage_user_day_unique").on(t.userId, t.usageDate),
  byDate: index("interview_studio_daily_usage_date_idx").on(t.usageDate, t.userId),
  validCount: check("interview_studio_daily_usage_count_check", sql`${t.evaluationJobs} BETWEEN 0 AND 100`),
  validAiCount: check("interview_studio_daily_usage_ai_count_check", sql`${t.aiEvaluationJobs} BETWEEN 0 AND ${t.evaluationJobs}`),
  validRunnerCount: check("interview_studio_daily_usage_runner_count_check", sql`${t.codeRunnerJobs} BETWEEN 0 AND ${t.evaluationJobs}`),
}));

export const interviewStudioArtifacts = pgTable("interview_studio_artifacts", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").references(() => interviewStudioSessions.id, { onDelete: "cascade" }).notNull(),
  userId: integer("user_id").references(() => users.id, { onDelete: "restrict" }).notNull(),
  kind: text("kind").notNull(), // camera | microphone | screen | combined
  status: text("status").default("pending").notNull(),
  privateManifest: jsonb("private_manifest").$type<InterviewStudioPrivateArtifactManifest>().notNull(),
  originalFileName: text("original_file_name").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes"),
  sha256: text("sha256"),
  durationSeconds: integer("duration_seconds"),
  consentPolicyVersion: text("consent_policy_version").notNull(),
  retentionUntil: timestamp("retention_until", { withTimezone: true }).notNull(),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  bySession: index("interview_studio_artifacts_session_idx").on(t.sessionId, t.kind, t.createdAt),
  byRetention: index("interview_studio_artifacts_retention_idx").on(t.status, t.retentionUntil),
  validId: check("interview_studio_artifacts_id_check", sql`${t.id} ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'`),
  validKind: check("interview_studio_artifacts_kind_check", sql`${t.kind} IN ('camera','microphone','screen','combined')`),
  validStatus: check("interview_studio_artifacts_status_check", sql`${t.status} IN ('pending','uploaded','quarantined','deleted','failed')`),
  manifestObject: check("interview_studio_artifacts_manifest_check", sql`
    jsonb_typeof(${t.privateManifest}) = 'object'
    AND ${t.privateManifest}->>'access' = 'private'
    AND length(btrim(${t.privateManifest}->>'objectKey')) >= 3
    AND ${t.privateManifest}->>'objectKey' !~* '^[a-z][a-z0-9+.-]*://'
    AND NOT (${t.privateManifest} ? 'url')
  `),
  validSize: check("interview_studio_artifacts_size_check", sql`${t.sizeBytes} IS NULL OR ${t.sizeBytes} BETWEEN 1 AND 1073741824`),
  validDuration: check("interview_studio_artifacts_duration_check", sql`${t.durationSeconds} IS NULL OR ${t.durationSeconds} BETWEEN 0 AND 14400`),
  validHash: check("interview_studio_artifacts_hash_check", sql`${t.sha256} IS NULL OR ${t.sha256} ~ '^[0-9a-f]{64}$'`),
}));

export const interviewStudioEvents = pgTable("interview_studio_events", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").references(() => interviewStudioSessions.id, { onDelete: "cascade" }).notNull(),
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  idempotencyKey: text("idempotency_key").notNull(),
  type: text("type").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().default(sql`'{}'::jsonb`).notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  sessionIdempotencyUnique: unique("interview_studio_events_session_idempotency_unique").on(t.sessionId, t.idempotencyKey),
  bySessionTime: index("interview_studio_events_session_time_idx").on(t.sessionId, t.occurredAt, t.id),
  validType: check("interview_studio_events_type_check", sql`
    ${t.type} IN ('session_started','session_submitted','permission_changed','recording_started','recording_stopped',
      'screen_share_ended','focus_left','focus_returned','network_offline','network_online','response_saved','tests_requested')
  `),
  payloadObject: check("interview_studio_events_payload_check", sql`jsonb_typeof(${t.payload}) = 'object'`),
}));

export const interviewStudioShareGrants = pgTable("interview_studio_share_grants", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").references(() => interviewStudioSessions.id, { onDelete: "cascade" }).notNull(),
  learnerUserId: integer("learner_user_id").references(() => users.id, { onDelete: "restrict" }).notNull(),
  recruiterId: integer("recruiter_id").references(() => recruiters.id, { onDelete: "cascade" }).notNull(),
  scopes: jsonb("scopes").$type<Array<"summary" | "responses" | "code" | "artifacts">>().notNull(),
  status: text("status").default("active").notNull(), // active | revoked | expired
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  grantedAt: timestamp("granted_at", { withTimezone: true }).defaultNow().notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  revocationReason: text("revocation_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  byRecruiter: index("interview_studio_share_grants_recruiter_idx").on(t.recruiterId, t.status, t.expiresAt),
  bySession: index("interview_studio_share_grants_session_idx").on(t.sessionId, t.status, t.expiresAt),
  validId: check("interview_studio_share_grants_id_check", sql`${t.id} ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'`),
  validStatus: check("interview_studio_share_grants_status_check", sql`${t.status} IN ('active','revoked','expired')`),
  scopesArray: check("interview_studio_share_grants_scopes_check", sql`
    jsonb_typeof(${t.scopes}) = 'array'
    AND jsonb_array_length(${t.scopes}) BETWEEN 1 AND 4
    AND ${t.scopes} <@ '["summary","responses","code","artifacts"]'::jsonb
  `),
  validExpiry: check("interview_studio_share_grants_expiry_check", sql`${t.expiresAt} > ${t.grantedAt}`),
  revokedTimestamp: check("interview_studio_share_grants_revoked_check", sql`
    (${t.status} = 'revoked' AND ${t.revokedAt} IS NOT NULL) OR (${t.status} <> 'revoked' AND ${t.revokedAt} IS NULL)
  `),
}));

export type InterviewStudioTemplate = typeof interviewStudioTemplates.$inferSelect;
export type InsertInterviewStudioTemplate = typeof interviewStudioTemplates.$inferInsert;
export type InterviewStudioSession = typeof interviewStudioSessions.$inferSelect;
export type InsertInterviewStudioSession = typeof interviewStudioSessions.$inferInsert;
export type InterviewStudioResponse = typeof interviewStudioResponses.$inferSelect;
export type InsertInterviewStudioResponse = typeof interviewStudioResponses.$inferInsert;
export type InterviewStudioArtifact = typeof interviewStudioArtifacts.$inferSelect;
export type InsertInterviewStudioArtifact = typeof interviewStudioArtifacts.$inferInsert;
export type InterviewStudioEvent = typeof interviewStudioEvents.$inferSelect;
export type InsertInterviewStudioEvent = typeof interviewStudioEvents.$inferInsert;
export type InterviewStudioShareGrant = typeof interviewStudioShareGrants.$inferSelect;
export type InsertInterviewStudioShareGrant = typeof interviewStudioShareGrants.$inferInsert;
export type InterviewStudioEvaluationJob = typeof interviewStudioEvaluationJobs.$inferSelect;
export type InsertInterviewStudioEvaluationJob = typeof interviewStudioEvaluationJobs.$inferInsert;
export type InterviewStudioDailyUsage = typeof interviewStudioDailyUsage.$inferSelect;
export type InsertInterviewStudioDailyUsage = typeof interviewStudioDailyUsage.$inferInsert;

// AI Interview Tables (legacy, retained only for historical compatibility)
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
