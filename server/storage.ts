import { 
  users, 
  userAddresses,
  categories, 
  courses, 
  questions, 
  examAttempts, 
  certificates, 
  payments,
  internshipApplications,
  sellers,
  sales,
  withdrawalRequests,
  learningPaths,
  userLearningPaths,
  skillAssessments,
  sponsors,
  contactSubmissions,
  creators,
  institutes,
  instituteMembers,
  questionBanks,
  questionTopics,
  questionProvenance,
  questionVersions,
  courseQuestionBlueprint,
  courseQuestionBlueprintVersions,
  type Creator,
  type InsertCreator,
  type Institute,
  type InsertInstitute,
  type InstituteMember,
  type InsertInstituteMember,
  type QuestionBank,
  type InsertQuestionBank,
  type QuestionTopic,
  type InsertQuestionTopic,
  type QuestionVersion,
  type CourseBlueprintItem,
  type InsertCourseBlueprintItem,
  interviews,
  interviewQuestions,
  recruiters,
  creditTransactions,
  profileAccessLogs,
  savedSearches,
  type User, 
  type InsertUser,
  type UserAddress,
  type InsertUserAddress,
  type Category,
  type InsertCategory,
  type Course,
  type InsertCourse,
  type Question,
  type InsertQuestion,
  type ExamAttempt,
  type InsertExamAttempt,
  type Certificate,
  type InsertCertificate,
  type Payment,
  type InsertPayment,
  type InternshipApplication,
  type InsertInternshipApplication,
  type Seller,
  type InsertSeller,
  type Sale,
  type InsertSale,
  type WithdrawalRequest,
  type InsertWithdrawalRequest,
  type LearningPath,
  type InsertLearningPath,
  type UserLearningPath,
  type InsertUserLearningPath,
  type SkillAssessment,
  type InsertSkillAssessment,
  type Sponsor,
  type InsertSponsor,
  type ContactSubmission,
  type InsertContactSubmission,
  userPreferences,
  notifications,
  courseRecommendations,
  userActivity,
  userCourseProgress,
  achievements,
  userAchievements,
  type UserPreferences,
  type InsertUserPreferences,
  type Notification,
  type InsertNotification,
  type CourseRecommendation,
  type InsertCourseRecommendation,
  type UserActivity,
  type InsertUserActivity,
  type UserCourseProgress,
  type InsertUserCourseProgress,
  type Achievement,
  type InsertAchievement,
  type UserAchievement,
  type InsertUserAchievement,
  referralClicks,
  ratings,
  ratingAggregates,
  type Rating,
  type InsertRating,
  type RatingAggregate,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, count, sql, or, asc, ilike, gte, gt, lte, isNull, isNotNull, notInArray } from "drizzle-orm";
import {
  isPublishableAssessmentQuestion,
  isPublishedAssessment,
} from "./lib/assessment-bank-readiness";
import {
  assertAssessmentPublishReadiness,
  type AssessmentPublishCourseState,
  unpublishPublishedAssessmentsUsingBanks,
} from "./lib/assessment-publish-readiness";

export const RECRUITER_ACCESS_COSTS = {
  profile_view: 1,
  cv_download: 1,
  interview_access: 2,
} as const;

export type RecruiterAccessType = keyof typeof RECRUITER_ACCESS_COSTS;

export class RecruiterAccessError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'RecruiterAccessError';
  }
}

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, updates: Partial<InsertUser>): Promise<User | undefined>;
  updateUserProfile(id: number, updates: Partial<InsertUser>): Promise<User | undefined>;

  // User address operations
  getUserAddresses(userId: number): Promise<UserAddress[]>;
  createUserAddress(address: InsertUserAddress): Promise<UserAddress>;
  updateUserAddress(id: number, updates: Partial<InsertUserAddress>): Promise<UserAddress>;
  deleteUserAddress(id: number): Promise<void>;
  setDefaultAddress(userId: number, addressId: number): Promise<void>;

  // Category operations
  getCategories(): Promise<Category[]>;
  getAllCategoriesWithCounts(): Promise<(Category & { courseCount: number })[]>;
  createCategory(category: InsertCategory): Promise<Category>;
  updateCategory(id: number, updates: Partial<InsertCategory>): Promise<Category | undefined>;
  deleteCategory(id: number): Promise<boolean>;

  // Course operations
  getCourses(categoryId?: number): Promise<(Course & { category: Category })[]>;
  getAllCourses(): Promise<(Course & { category: Category })[]>;
  getCourse(id: number): Promise<Course | undefined>;
  getCourseBySlug(slug: string): Promise<(Course & { category: Category }) | undefined>;
  getCoursesByCategory(categoryId: number): Promise<(Course & { category: Category })[]>;
  createCourse(course: InsertCourse): Promise<Course>;
  updateCourse(id: number, course: Partial<InsertCourse>): Promise<Course>;
  deleteCourse(id: number): Promise<void>;

  // Question operations
  getQuestionsByCourse(courseId: number): Promise<Question[]>;
  createQuestion(question: InsertQuestion): Promise<Question>;
  updateQuestion(id: number, question: Partial<InsertQuestion>): Promise<Question>;
  deleteQuestion(id: number): Promise<void>;

  // Exam attempt operations
  createExamAttempt(attempt: InsertExamAttempt): Promise<ExamAttempt>;
  getExamAttempt(id: number): Promise<ExamAttempt | undefined>;
  getUserExamAttempts(userId: number, courseId?: number): Promise<ExamAttempt[]>;
  getExamAttemptByCertificateId(certificateId: number): Promise<ExamAttempt | undefined>;
  
  // Get all exam attempts for a specific user and course - used for retake logic
  // This method is essential for determining if user is retaking and what their previous best score was
  getExamAttemptsByUserAndCourse(userId: number, courseId: number): Promise<ExamAttempt[]>;

  // Certificate operations
  createCertificate(certificate: InsertCertificate): Promise<Certificate>;
  getCertificate(id: number): Promise<Certificate | undefined>;
  getCertificateByCertificateId(certificateId: string): Promise<Certificate | undefined>;
  getUserCertificates(userId: number, userEmail?: string): Promise<Certificate[]>;
  updateCertificatePayment(id: number, updates: { isPaid: boolean; paymentId: string }): Promise<void>;

  // Payment operations
  createPayment(payment: InsertPayment): Promise<Payment>;
  getPayment(id: number): Promise<Payment | undefined>;
  updatePayment(id: number, updates: Partial<InsertPayment>): Promise<Payment>;

  // Internship application operations
  createInternshipApplication(application: InsertInternshipApplication): Promise<InternshipApplication>;
  getInternshipApplication(certificateId: number): Promise<InternshipApplication | undefined>;

  // Seller operations
  getSeller(id: number): Promise<Seller | undefined>;
  getSellerByEmail(email: string): Promise<Seller | undefined>;
  createSeller(seller: InsertSeller): Promise<Seller>;
  updateSeller(id: number, updates: Partial<InsertSeller>): Promise<Seller>;
  
  // Sales operations
  createSale(sale: InsertSale): Promise<Sale>;
  getSellerSales(sellerId: number): Promise<Sale[]>;
  updateSaleCommission(id: number, status: string): Promise<void>;
  
  // Withdrawal operations
  createWithdrawalRequest(request: InsertWithdrawalRequest): Promise<WithdrawalRequest>;
  getSellerWithdrawals(sellerId: number): Promise<WithdrawalRequest[]>;
  getAllWithdrawals(): Promise<WithdrawalRequest[]>;
  updateWithdrawalStatus(id: number, status: string, adminNotes?: string): Promise<void>;
  
  // Sponsor operations
  createSponsor(sponsorData: InsertSponsor): Promise<Sponsor>;
  getAllSponsors(): Promise<Sponsor[]>;
  updateSponsorPaymentStatus(id: number, status: string, transactionId?: string): Promise<Sponsor>;
  
  // Additional payment operations for PayUMoney
  getAllPayments(): Promise<Payment[]>;
  updatePaymentStatus(transactionId: string, status: string, paymentResponse: any): Promise<void>;
  getPaymentByTransactionId(transactionId: string): Promise<Payment | undefined>;
  processSale(saleData: any): Promise<void>;
  deliverCertificate(certificateId: string, deliveryData: any): Promise<void>;
  
  // Smart Notifications operations
  getUserPreferences(userId: number): Promise<UserPreferences | undefined>;
  createUserPreferences(preferences: InsertUserPreferences): Promise<UserPreferences>;
  updateUserPreferences(userId: number, preferences: Partial<InsertUserPreferences>): Promise<UserPreferences>;
  
  // Notifications operations
  getUserNotifications(userId: number, limit?: number): Promise<Notification[]>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationAsRead(notificationId: number): Promise<void>;
  markAllNotificationsAsRead(userId: number): Promise<void>;
  
  // Course recommendations operations
  getUserRecommendations(userId: number, limit?: number): Promise<(CourseRecommendation & { course: Course & { category: Category } })[]>;
  createCourseRecommendation(recommendation: InsertCourseRecommendation): Promise<CourseRecommendation>;
  markRecommendationAsShown(recommendationId: number): Promise<void>;
  markRecommendationAsClicked(recommendationId: number): Promise<void>;
  
  // User activity tracking operations
  recordUserActivity(activity: InsertUserActivity): Promise<UserActivity>;
  getUserActivity(userId: number, activityType?: string): Promise<UserActivity[]>;
  
  // Course progress operations
  getUserCourseProgress(userId: number, courseId?: number): Promise<UserCourseProgress[]>;
  upsertUserCourseProgress(progress: InsertUserCourseProgress): Promise<UserCourseProgress>;
  updateCourseProgress(userId: number, courseId: number, updates: Partial<InsertUserCourseProgress>): Promise<UserCourseProgress>;
  
  // Achievement operations
  getAchievements(category?: string): Promise<Achievement[]>;
  createAchievement(achievement: InsertAchievement): Promise<Achievement>;
  getUserAchievements(userId: number, includeDetails?: boolean): Promise<(UserAchievement & { achievement?: Achievement })[]>;
  unlockAchievement(userId: number, achievementId: number, metadata?: any): Promise<UserAchievement>;

  // Recent certificates and contact form operations
  getRecentCertificates(limit?: number): Promise<any[]>;
  createContactSubmission(submission: InsertContactSubmission): Promise<ContactSubmission>;
  getAllContactSubmissions(): Promise<ContactSubmission[]>;
  updateContactSubmissionStatus(id: number, status: string, adminNotes?: string): Promise<ContactSubmission>;
  checkAndUnlockAchievements(userId: number, courseId?: number): Promise<UserAchievement[]>;

  // Learning Path operations
  getLearningPaths(filters?: { categoryId?: number; difficulty?: string }): Promise<(LearningPath & { category: Category })[]>;
  createLearningPath(learningPath: InsertLearningPath): Promise<LearningPath>;
  getUserLearningPaths(userId: number): Promise<(UserLearningPath & { learningPath: LearningPath & { category: Category } })[]>;
  enrollInLearningPath(enrollment: InsertUserLearningPath): Promise<UserLearningPath>;
  updateLearningPathProgress(userId: number, learningPathId: number, updates: Partial<InsertUserLearningPath>): Promise<UserLearningPath>;
  
  // Skill Assessment operations
  createSkillAssessment(assessment: InsertSkillAssessment): Promise<SkillAssessment>;

  // Sponsor operations
  createSponsor(sponsor: InsertSponsor): Promise<Sponsor>;
  updateSponsorPaymentStatus(id: number, status: string, transactionId?: string): Promise<Sponsor>;
  getAllSponsors(): Promise<Sponsor[]>;
  
  // Skill Assessment operations
  getUserSkillAssessments(userId: number, categoryId?: number): Promise<SkillAssessment[]>;
  getValidSkillAssessment(userId: number, categoryId: number): Promise<SkillAssessment | undefined>;

  // Creator operations
  createCreator(data: InsertCreator): Promise<Creator>;
  getCreatorByUserId(userId: number): Promise<Creator | undefined>;
  getCreatorBySlug(slug: string): Promise<Creator | undefined>;
  updateCreator(id: number, data: Partial<InsertCreator>): Promise<Creator | undefined>;

  // Institute operations
  createInstitute(data: InsertInstitute): Promise<Institute>;
  getInstituteBySlug(slug: string): Promise<Institute | undefined>;
  updateInstitute(id: number, data: Partial<InsertInstitute>): Promise<Institute | undefined>;
  addInstituteMember(instituteId: number, userId: number, role?: string, status?: string): Promise<InstituteMember>;
  getInstituteMembersByUserId(userId: number): Promise<(InstituteMember & { institute: Institute })[]>;
  getInstituteByUserId(userId: number): Promise<(Institute & { memberRole: string }) | undefined>;

  // Aggregate roles
  getUserRoles(userId: number): Promise<{
    isLearner: boolean;
    isCreator: boolean;
    isInstituteMember: boolean;
    isRecruiter: boolean;
    isSeller: boolean;
    isAdmin: boolean;
    instituteRole: "owner" | "admin" | "teacher" | "staff" | null;
  }>;

  // ===== P1 Question Bank Pro =====
  createQuestionBank(data: InsertQuestionBank): Promise<QuestionBank>;
  getQuestionBank(id: number): Promise<QuestionBank | undefined>;
  getQuestionBankBySlug(ownerType: string, ownerId: number | null, slug: string): Promise<QuestionBank | undefined>;
  listQuestionBanks(filter: { ownerType?: string; ownerId?: number | null; visibility?: string; userId?: number; search?: string }): Promise<QuestionBank[]>;
  updateQuestionBank(id: number, data: Partial<InsertQuestionBank>): Promise<QuestionBank | undefined>;
  deleteQuestionBank(id: number): Promise<void>;

  createQuestionTopic(data: InsertQuestionTopic): Promise<QuestionTopic>;
  listQuestionTopics(bankId: number): Promise<QuestionTopic[]>;
  updateQuestionTopic(id: number, data: Partial<InsertQuestionTopic>): Promise<QuestionTopic | undefined>;
  deleteQuestionTopic(id: number): Promise<void>;

  createQuestionInBank(data: { bankId: number; topicId?: number | null; createdBy?: number | null } & Partial<InsertQuestion> & {
    questionFormat?: string;
    expectedAnswer?: string | null;
    negativeMarks?: number;
    timeLimitSec?: number | null;
    tags?: string[];
    explanation?: string | null;
    imageUrl?: string | null;
    codeLanguage?: string | null;
  }): Promise<Question>;
  updateQuestionWithVersioning(id: number, data: Record<string, unknown>, changedBy?: number, changeNote?: string, expectedVersion?: number): Promise<Question | undefined>;
  deleteBankQuestion(id: number, retiredBy?: number): Promise<void>;
  bulkCreateQuestions(bankId: number, rows: Array<Record<string, unknown>>, createdBy?: number): Promise<{ created: number; errors: Array<{ row: number; message: string }> }>;
  listQuestionsByBank(bankId: number, opts: { topicId?: number; format?: string; difficulty?: string; reviewStatus?: string; search?: string; page?: number; perPage?: number }): Promise<{ items: Question[]; total: number; page: number; perPage: number }>;
  getQuestionVersions(questionId: number): Promise<QuestionVersion[]>;

  getCourseBlueprint(courseId: number): Promise<CourseBlueprintItem[]>;
  setCourseBlueprint(courseId: number, items: Array<Omit<InsertCourseBlueprintItem, "courseId">>, changedBy?: number, changeNote?: string): Promise<CourseBlueprintItem[]>;
  materializeBlueprintForAttempt(courseId: number): Promise<Question[]>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async updateUser(id: number, updates: Partial<InsertUser>): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, id))
      .returning();
    return user || undefined;
  }

  async updateUserProfile(id: number, updates: Partial<InsertUser>): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user || undefined;
  }

  // User address operations
  async getUserAddresses(userId: number): Promise<UserAddress[]> {
    return await db.select().from(userAddresses).where(eq(userAddresses.userId, userId));
  }

  async createUserAddress(insertAddress: InsertUserAddress): Promise<UserAddress> {
    // If this is set as default, unset other defaults for this user
    if (insertAddress.isDefault) {
      await db.update(userAddresses)
        .set({ isDefault: false })
        .where(eq(userAddresses.userId, insertAddress.userId));
    }

    const [address] = await db
      .insert(userAddresses)
      .values(insertAddress)
      .returning();
    return address;
  }

  async updateUserAddress(id: number, updates: Partial<InsertUserAddress>): Promise<UserAddress> {
    // If setting as default, unset other defaults for this user
    if (updates.isDefault) {
      const [currentAddress] = await db.select().from(userAddresses).where(eq(userAddresses.id, id));
      if (currentAddress) {
        await db.update(userAddresses)
          .set({ isDefault: false })
          .where(eq(userAddresses.userId, currentAddress.userId));
      }
    }

    const [address] = await db
      .update(userAddresses)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(userAddresses.id, id))
      .returning();
    return address;
  }

  async deleteUserAddress(id: number): Promise<void> {
    await db.delete(userAddresses).where(eq(userAddresses.id, id));
  }

  async setDefaultAddress(userId: number, addressId: number): Promise<void> {
    // Unset all defaults for this user
    await db.update(userAddresses)
      .set({ isDefault: false })
      .where(eq(userAddresses.userId, userId));
    
    // Set the new default
    await db.update(userAddresses)
      .set({ isDefault: true, updatedAt: new Date() })
      .where(and(eq(userAddresses.id, addressId), eq(userAddresses.userId, userId)));
  }

  // Category operations
  async getCategories(): Promise<Category[]> {
    return await db.select().from(categories)
      .where(eq(categories.isActive, true))
      .orderBy(asc(categories.sortOrder), asc(categories.name));
  }

  async createCategory(insertCategory: InsertCategory): Promise<Category> {
    const [category] = await db
      .insert(categories)
      .values(insertCategory)
      .returning();
    return category;
  }

  async getAllCategoriesWithCounts(): Promise<(Category & { courseCount: number })[]> {
    const categoriesWithCounts = await db
      .select({
        id: categories.id,
        name: categories.name,
        description: categories.description,
        slug: categories.slug,
        icon: categories.icon,
        parentId: categories.parentId,
        kind: categories.kind,
        isActive: categories.isActive,
        sortOrder: categories.sortOrder,
        metaTitle: categories.metaTitle,
        metaDescription: categories.metaDescription,
        createdAt: categories.createdAt,
        updatedAt: categories.updatedAt,
        courseCount: sql<number>`count(${courses.id})::int`
      })
      .from(categories)
      .leftJoin(courses, eq(categories.id, courses.categoryId))
      .groupBy(categories.id)
      .orderBy(categories.name);
    
    return categoriesWithCounts;
  }

  async updateCategory(id: number, updates: Partial<InsertCategory>): Promise<Category | undefined> {
    const [category] = await db
      .update(categories)
      .set(updates)
      .where(eq(categories.id, id))
      .returning();
    return category;
  }

  async deleteCategory(id: number): Promise<boolean> {
    const result = await db
      .delete(categories)
      .where(eq(categories.id, id));
    return (result.rowCount || 0) > 0;
  }

  // Course operations
  async getCourses(categoryId?: number): Promise<(Course & { category: Category })[]> {
    const query = db
      .select({
        id: courses.id,
        title: courses.title,
        description: courses.description,
        slug: courses.slug,
        categoryId: courses.categoryId,
        duration: courses.duration,
        passingScore: courses.passingScore,
        price: courses.price,
        productType: courses.productType,
        contentPrice: courses.contentPrice,
        originalPrice: courses.originalPrice,
        isOnSale: courses.isOnSale,
        saleEndDate: courses.saleEndDate,
        level: courses.level,
        isActive: courses.isActive,
        isInternship: courses.isInternship,
        metaTitle: courses.metaTitle,
        metaDescription: courses.metaDescription,
        thumbnailUrl: courses.thumbnailUrl,
        ownerType: courses.ownerType,
        ownerId: courses.ownerId,
        visibility: courses.visibility,
        language: courses.language,
        certificationMode: courses.certificationMode,
        assessmentPurpose: courses.assessmentPurpose,
        reviewStatus: courses.reviewStatus,
        defaultReviewPolicy: courses.defaultReviewPolicy,
        subscriptionEligible: courses.subscriptionEligible,
        resellerEligible: courses.resellerEligible,
        featuredAt: courses.featuredAt,
        useBlueprintEngine: courses.useBlueprintEngine,
        createdAt: courses.createdAt,
        category: {
          id: categories.id,
          name: categories.name,
          description: categories.description,
          icon: categories.icon,
          slug: categories.slug,
          parentId: categories.parentId,
          kind: categories.kind,
          isActive: categories.isActive,
          sortOrder: categories.sortOrder,
          metaTitle: categories.metaTitle,
          metaDescription: categories.metaDescription,
          createdAt: categories.createdAt,
          updatedAt: categories.updatedAt,
        }
      })
      .from(courses)
      .innerJoin(categories, eq(courses.categoryId, categories.id))
      .where(and(
        eq(courses.isActive, true),
        eq(courses.visibility, "public"),
        eq(courses.reviewStatus, "approved"),
        sql`${courses.ownerType} <> 'institute'`,
        eq(categories.isActive, true),
        categoryId ? eq(courses.categoryId, categoryId) : undefined,
      ));

    return await query;
  }

  async getAllCourses(): Promise<(Course & { category: Category })[]> {
    return this.getCourses();
  }

  async getCoursesByCategory(categoryId: number): Promise<(Course & { category: Category })[]> {
    return this.getCourses(categoryId);
  }

  async getCourse(id: number): Promise<Course | undefined> {
    const [course] = await db.select().from(courses).where(eq(courses.id, id));
    return course || undefined;
  }

  async getCourseBySlug(slug: string): Promise<(Course & { category: Category }) | undefined> {
    const query = db
      .select({
        id: courses.id,
        title: courses.title,
        description: courses.description,
        slug: courses.slug,
        categoryId: courses.categoryId,
        duration: courses.duration,
        passingScore: courses.passingScore,
        price: courses.price,
        productType: courses.productType,
        contentPrice: courses.contentPrice,
        originalPrice: courses.originalPrice,
        isOnSale: courses.isOnSale,
        saleEndDate: courses.saleEndDate,
        level: courses.level,
        isActive: courses.isActive,
        isInternship: courses.isInternship,
        metaTitle: courses.metaTitle,
        metaDescription: courses.metaDescription,
        thumbnailUrl: courses.thumbnailUrl,
        ownerType: courses.ownerType,
        ownerId: courses.ownerId,
        visibility: courses.visibility,
        language: courses.language,
        certificationMode: courses.certificationMode,
        assessmentPurpose: courses.assessmentPurpose,
        reviewStatus: courses.reviewStatus,
        defaultReviewPolicy: courses.defaultReviewPolicy,
        subscriptionEligible: courses.subscriptionEligible,
        resellerEligible: courses.resellerEligible,
        featuredAt: courses.featuredAt,
        useBlueprintEngine: courses.useBlueprintEngine,
        createdAt: courses.createdAt,
        category: {
          id: categories.id,
          name: categories.name,
          description: categories.description,
          icon: categories.icon,
          slug: categories.slug,
          parentId: categories.parentId,
          kind: categories.kind,
          isActive: categories.isActive,
          sortOrder: categories.sortOrder,
          metaTitle: categories.metaTitle,
          metaDescription: categories.metaDescription,
          createdAt: categories.createdAt,
          updatedAt: categories.updatedAt,
        }
      })
      .from(courses)
      .innerJoin(categories, eq(courses.categoryId, categories.id))
      .where(and(
        eq(courses.slug, slug),
        eq(courses.isActive, true),
        eq(courses.visibility, "public"),
        eq(courses.reviewStatus, "approved"),
        sql`${courses.ownerType} <> 'institute'`,
        eq(categories.isActive, true),
      ));

    const [result] = await query;
    return result || undefined;
  }



  // Question operations
  async getQuestionsByCourse(courseId: number): Promise<Question[]> {
    return await db
      .select()
      .from(questions)
      .where(and(
        eq(questions.courseId, courseId),
        eq(questions.isActive, true),
        eq(questions.reviewStatus, "approved"),
        // The public assessment renderer currently supports option-based
        // questions only. Code/free-text authoring metadata must never leak
        // into a live attempt until a dedicated runner/scorer is available.
        sql`${questions.questionFormat} IN ('mcq_single', 'true_false')`,
        sql`json_typeof(${questions.options}) = 'array'`,
        sql`${questions.correctAnswer} >= 0`,
        sql`${questions.correctAnswer} < json_array_length(${questions.options})`,
      ));
  }



  // Exam attempt operations
  async createExamAttempt(insertAttempt: InsertExamAttempt): Promise<ExamAttempt> {
    const [attempt] = await db
      .insert(examAttempts)
      .values(insertAttempt)
      .returning();
    return attempt;
  }

  async getExamAttempt(id: number): Promise<ExamAttempt | undefined> {
    const [attempt] = await db.select().from(examAttempts).where(eq(examAttempts.id, id));
    return attempt || undefined;
  }

  async getExamAttemptsByUserAndCourse(userId: number, courseId: number): Promise<ExamAttempt[]> {
    const results = await db
      .select()
      .from(examAttempts)
      .where(and(
        eq(examAttempts.userId, userId),
        eq(examAttempts.courseId, courseId)
      ))
      .orderBy(desc(examAttempts.createdAt));
    return results;
  }

  async getUserExamAttempts(userId: number, courseId?: number): Promise<ExamAttempt[]> {
    const query = db
      .select()
      .from(examAttempts)
      .where(
        courseId 
          ? and(eq(examAttempts.userId, userId), eq(examAttempts.courseId, courseId))
          : eq(examAttempts.userId, userId)
      )
      .orderBy(desc(examAttempts.createdAt));
    
    return await query;
  }

  async getExamAttemptByCertificateId(certificateId: number): Promise<ExamAttempt | undefined> {
    // Get the certificate first to find the associated exam attempt
    const certificate = await this.getCertificate(certificateId);
    if (!certificate) return undefined;

    // Find the exam attempt for this user and course
    const [attempt] = await db
      .select()
      .from(examAttempts)
      .where(
        and(
          eq(examAttempts.userId, certificate.userId || 0),
          eq(examAttempts.courseId, certificate.courseId),
          eq(examAttempts.passed, true)
        )
      )
      .orderBy(desc(examAttempts.createdAt))
      .limit(1);
    
    return attempt || undefined;
  }

  async getExamAttemptsByEmail(userEmail: string, courseId: number): Promise<ExamAttempt[]> {
    const attempts = await db
      .select()
      .from(examAttempts)
      .where(
        and(
          eq(examAttempts.userEmail, userEmail),
          eq(examAttempts.courseId, courseId)
        )
      )
      .orderBy(desc(examAttempts.createdAt));
    
    return attempts;
  }

  // Certificate operations
  async createCertificate(insertCertificate: InsertCertificate): Promise<Certificate> {
    const [certificate] = await db
      .insert(certificates)
      .values(insertCertificate)
      .returning();
    return certificate;
  }

  async getCertificate(id: number): Promise<Certificate | undefined> {
    const [certificate] = await db.select().from(certificates).where(eq(certificates.id, id));
    return certificate || undefined;
  }

  async getCertificateByCertificateId(certificateId: string): Promise<Certificate | undefined> {
    const [certificate] = await db
      .select()
      .from(certificates)
      .where(eq(certificates.certificateId, certificateId));
    return certificate || undefined;
  }

  async getUserCertificates(userId: number, userEmail?: string): Promise<Certificate[]> {
    return await db
      .select()
      .from(certificates)
      .where(
        userEmail
          ? or(
              eq(certificates.userId, userId),
              and(
                isNull(certificates.userId),
                sql`lower(${certificates.userEmail}) = lower(${userEmail})`,
              ),
            )
          : eq(certificates.userId, userId),
      )
      .orderBy(desc(certificates.issuedAt));
  }

  async updateCertificatePayment(id: number, updates: { isPaid: boolean; paymentId: string }): Promise<void> {
    await db
      .update(certificates)
      .set(updates)
      .where(eq(certificates.id, id));
  }



  async getUserCertificateForCourse(userId: number | null, courseId: number, userEmail: string): Promise<Certificate | undefined> {
    const [certificate] = await db
      .select()
      .from(certificates)
      .where(
        and(
          eq(certificates.courseId, courseId),
          userId ? eq(certificates.userId, userId) : eq(certificates.userEmail, userEmail)
        )
      );
    return certificate || undefined;
  }

  async updateCertificate(id: number, updates: Partial<InsertCertificate>): Promise<Certificate> {
    const [certificate] = await db
      .update(certificates)
      .set(updates)
      .where(eq(certificates.id, id))
      .returning();
    return certificate;
  }

  async getUserCertificatesCount(userId: number | null, userEmail?: string): Promise<number> {
    const whereCondition = userId 
      ? eq(certificates.userId, userId)
      : eq(certificates.userEmail, userEmail || '');
    
    const result = await db
      .select()
      .from(certificates)
      .where(whereCondition);
    
    return result.length;
  }

  // Payment operations
  async createPayment(insertPayment: InsertPayment): Promise<Payment> {
    const [payment] = await db
      .insert(payments)
      .values(insertPayment)
      .returning();
    return payment;
  }

  async getPayment(id: number): Promise<Payment | undefined> {
    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.id, id));
    return payment;
  }

  async updatePayment(id: number, updates: Partial<InsertPayment>): Promise<Payment> {
    const [payment] = await db
      .update(payments)
      .set(updates)
      .where(eq(payments.id, id))
      .returning();
    return payment;
  }

  // Internship application operations
  async createInternshipApplication(insertApplication: InsertInternshipApplication): Promise<InternshipApplication> {
    const [application] = await db
      .insert(internshipApplications)
      .values(insertApplication)
      .returning();
    return application;
  }

  async getInternshipApplication(certificateId: number): Promise<InternshipApplication | undefined> {
    const [application] = await db
      .select()
      .from(internshipApplications)
      .where(eq(internshipApplications.certificateId, certificateId));
    return application || undefined;
  }

  // Seller operations
  async getSeller(id: number): Promise<Seller | undefined> {
    const [seller] = await db.select().from(sellers).where(eq(sellers.id, id));
    return seller || undefined;
  }

  async getSellerConversions(sellerId: number): Promise<any[]> {
    const seller = await this.getSeller(sellerId);
    if (!seller) return [];

    // Get all successful payments made through this seller's referral code
    const conversions = await db
      .select({
        id: payments.id,
        amount: payments.amount,
        commissionAmount: sql`CAST(${payments.amount} AS DECIMAL) * CAST(${seller.commissionRate} AS DECIMAL) / 100`.as('commissionAmount'),
        courseTitle: courses.title,
        createdAt: payments.createdAt
      })
      .from(payments)
      .leftJoin(courses, eq(payments.courseId, courses.id))
      .where(eq(payments.status, 'success'))
      .orderBy(desc(payments.createdAt));

    return conversions;
  }

  async getSellerByEmail(email: string): Promise<Seller | undefined> {
    const [seller] = await db.select().from(sellers).where(eq(sellers.email, email));
    return seller || undefined;
  }

  async getSellerByReferralCode(referralCode: string): Promise<Seller | undefined> {
    const [seller] = await db.select().from(sellers).where(eq(sellers.referralCode, referralCode));
    return seller || undefined;
  }

  async createSeller(insertSeller: InsertSeller): Promise<Seller> {
    const [seller] = await db
      .insert(sellers)
      .values(insertSeller)
      .returning();
    return seller;
  }

  async updateSeller(id: number, updates: any): Promise<Seller> {
    const [seller] = await db
      .update(sellers)
      .set(updates)
      .where(eq(sellers.id, id))
      .returning();
    return seller;
  }

  // Atomic earnings increment — avoids read-modify-write race when multiple
  // payments for the same seller commit concurrently.
  async incrementSellerEarnings(id: number, delta: number): Promise<Seller> {
    const [seller] = await db
      .update(sellers)
      .set({
        totalEarnings: sql`coalesce(${sellers.totalEarnings}::numeric, 0) + ${delta}`,
      })
      .where(eq(sellers.id, id))
      .returning();
    return seller;
  }

  // Sales operations
  async createSale(insertSale: InsertSale): Promise<Sale> {
    const [sale] = await db
      .insert(sales)
      .values(insertSale)
      .returning();
    return sale;
  }

  // Referral click tracking
  async trackReferralClick(clickData: {
    referralCode: string;
    courseId: number;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    // Find seller by referral code directly
    const seller = await this.getSellerByReferralCode(clickData.referralCode);
    if (!seller) {
      console.error('Seller not found for referral code:', clickData.referralCode);
      return;
    }

    // Check for rapid duplicate clicks (within 30 seconds) to prevent spam
    const existingClick = await db.select()
      .from(referralClicks)
      .where(
        and(
          eq(referralClicks.referralCode, clickData.referralCode),
          eq(referralClicks.courseId, clickData.courseId),
          eq(referralClicks.ipAddress, clickData.ipAddress || ''),
          sql`${referralClicks.clickedAt} > NOW() - INTERVAL '30 seconds'`
        )
      )
      .limit(1);

    if (existingClick.length > 0) {
      console.log('Duplicate click detected (within 30 seconds), skipping tracking');
      return;
    }

    await db.insert(referralClicks).values({
      sellerId: seller.id,
      courseId: clickData.courseId,
      referralCode: clickData.referralCode,
      ipAddress: clickData.ipAddress,
      userAgent: clickData.userAgent,
    });

    console.log(`Tracked referral click for seller ${seller.id}, course ${clickData.courseId}`);
  }

  async updateReferralConversion(referralCode: string, courseId: number, userId: number): Promise<void> {
    const result = await db
      .update(referralClicks)
      .set({
        converted: true,
        conversionDate: new Date(),
        userId: userId,
      })
      .where(
        and(
          eq(referralClicks.referralCode, referralCode),
          eq(referralClicks.courseId, courseId),
          eq(referralClicks.converted, false)
        )
      );

    console.log(`Updated referral conversion for code ${referralCode}, course ${courseId}, user ${userId}`);
  }

  async getSellerClickAnalytics(sellerId: number): Promise<{
    totalClicks: number;
    totalConversions: number;
    conversionRate: number;
    courseWiseAnalytics: Array<{
      courseId: number;
      courseTitle: string;
      clicks: number;
      conversions: number;
      conversionRate: number;
      latestClick: Date | null;
    }>;
  }> {
    // Get total clicks and conversions
    const clickStats = await db
      .select({
        totalClicks: count(),
        totalConversions: sql<number>`COUNT(CASE WHEN is_converted = true THEN 1 END)`,
      })
      .from(referralClicks)
      .where(eq(referralClicks.sellerId, sellerId));

    const totalClicks = clickStats[0]?.totalClicks || 0;
    const totalConversions = clickStats[0]?.totalConversions || 0;
    const conversionRate = totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0;

    // Get course-wise analytics
    const courseAnalytics = await db
      .select({
        courseId: referralClicks.courseId,
        courseTitle: courses.title,
        clicks: count(),
        conversions: sql<number>`COUNT(CASE WHEN is_converted = true THEN 1 END)`,
        latestClick: sql<Date>`MAX(${referralClicks.clickedAt})`,
      })
      .from(referralClicks)
      .leftJoin(courses, eq(referralClicks.courseId, courses.id))
      .where(eq(referralClicks.sellerId, sellerId))
      .groupBy(referralClicks.courseId, courses.title);

    const courseWiseAnalytics = courseAnalytics.map(row => ({
      courseId: row.courseId,
      courseTitle: row.courseTitle || 'Unknown Course',
      clicks: row.clicks,
      conversions: row.conversions,
      conversionRate: row.clicks > 0 ? (row.conversions / row.clicks) * 100 : 0,
      latestClick: row.latestClick,
    }));

    return {
      totalClicks,
      totalConversions,
      conversionRate,
      courseWiseAnalytics,
    };
  }

  async getSalesBySeller(sellerId: number): Promise<Sale[]> {
    return await db
      .select({
        id: sales.id,
        sellerId: sales.sellerId,
        courseId: sales.courseId,
        certificateId: sales.certificateId,
        amount: sales.amount,
        commission: sales.commission,
        referralCode: sales.referralCode,
        status: sales.status,
        createdAt: sales.createdAt,
        courseTitle: courses.title
      })
      .from(sales)
      .leftJoin(courses, eq(sales.courseId, courses.id))
      .where(eq(sales.sellerId, sellerId))
      .orderBy(desc(sales.createdAt));
  }

  async getSellerSales(sellerId: number): Promise<Sale[]> {
    return this.getSalesBySeller(sellerId);
  }

  async updateSaleCommission(id: number, status: string): Promise<void> {
    await db
      .update(sales)
      .set({ status })
      .where(eq(sales.id, id));
  }

  // Withdrawal operations
  async createWithdrawalRequest(insertRequest: InsertWithdrawalRequest): Promise<WithdrawalRequest> {
    const [request] = await db
      .insert(withdrawalRequests)
      .values(insertRequest)
      .returning();
    return request;
  }

  async getWithdrawalsBySeller(sellerId: number): Promise<WithdrawalRequest[]> {
    return await db
      .select()
      .from(withdrawalRequests)
      .where(eq(withdrawalRequests.sellerId, sellerId))
      .orderBy(desc(withdrawalRequests.createdAt));
  }

  async getSellerWithdrawals(sellerId: number): Promise<WithdrawalRequest[]> {
    return this.getWithdrawalsBySeller(sellerId);
  }

  async getAllWithdrawals(): Promise<WithdrawalRequest[]> {
    return await db
      .select()
      .from(withdrawalRequests)
      .orderBy(desc(withdrawalRequests.createdAt));
  }

  // Sponsor operations
  async createSponsor(sponsorData: InsertSponsor): Promise<Sponsor> {
    const [sponsor] = await db
      .insert(sponsors)
      .values(sponsorData)
      .returning();
    return sponsor;
  }

  async getAllSponsors(): Promise<Sponsor[]> {
    return await db.select().from(sponsors).orderBy(desc(sponsors.createdAt));
  }

  async updateSponsorPaymentStatus(id: number, status: string, transactionId?: string): Promise<Sponsor> {
    const [result] = await db
      .update(sponsors)
      .set({
        paymentStatus: status,
        ...(transactionId && { transactionId }),
        updatedAt: new Date()
      })
      .where(eq(sponsors.id, id))
      .returning();
    return result;
  }

  async updateWithdrawalStatus(id: number, status: string, adminNotes?: string): Promise<void> {
    const updates: any = { status };
    if (adminNotes) updates.adminNotes = adminNotes;
    if (status === 'processed') updates.processedAt = new Date();
    
    await db
      .update(withdrawalRequests)
      .set(updates)
      .where(eq(withdrawalRequests.id, id));
  }

  // Admin analytics operations
  async getSellerCount(): Promise<number> {
    const result = await db.select({ count: count() }).from(sellers);
    return result[0]?.count || 0;
  }

  async getApprovedSellerCount(): Promise<number> {
    const result = await db.select({ count: count() })
      .from(sellers)
      .where(eq(sellers.isApproved, true));
    return result[0]?.count || 0;
  }

  async getTotalReferralClicks(): Promise<number> {
    const result = await db.select({ count: count() }).from(referralClicks);
    return result[0]?.count || 0;
  }

  async getTotalConversions(): Promise<number> {
    const result = await db.select({ count: count() }).from(sales);
    return result[0]?.count || 0;
  }

  async getTotalRevenue(): Promise<number> {
    const result = await db
      .select({ total: sql<number>`sum(${sales.amount})` })
      .from(sales);
    return Number(result[0]?.total || 0);
  }

  async getTopPerformingPartners(limit: number): Promise<any[]> {
    const partners = await db
      .select({
        id: sellers.id,
        name: sellers.name,
        email: sellers.email,
        referralCode: sellers.referralCode,
        totalEarnings: sql<number>`coalesce(sum(${sales.commission}), 0)`,
        clickCount: sql<number>`coalesce(count(distinct ${referralClicks.id}), 0)`,
        conversionCount: sql<number>`coalesce(count(distinct ${sales.id}), 0)`,
      })
      .from(sellers)
      .leftJoin(referralClicks, eq(sellers.referralCode, referralClicks.referralCode))
      .leftJoin(sales, eq(sellers.id, sales.sellerId))
      .groupBy(sellers.id, sellers.name, sellers.email, sellers.referralCode)
      .orderBy(sql`coalesce(sum(${sales.commission}), 0) desc`)
      .limit(limit);

    return partners.map(partner => ({
      ...partner,
      conversionRate: partner.clickCount > 0 ? (partner.conversionCount / partner.clickCount) * 100 : 0
    }));
  }

  async getAllSellersWithStats(): Promise<any[]> {
    const sellersWithStats = await db
      .select({
        id: sellers.id,
        name: sellers.name,
        email: sellers.email,
        isApproved: sellers.isApproved,
        referralCode: sellers.referralCode,
        createdAt: sellers.createdAt,
        totalEarnings: sql<number>`coalesce(sum(${sales.commission}), 0)`,
        pendingEarnings: sql<number>`coalesce(sum(case when ${sales.status} = 'completed' then ${sales.commission} else 0 end), 0)`,
        clickCount: sql<number>`coalesce(count(distinct ${referralClicks.id}), 0)`,
        conversionCount: sql<number>`coalesce(count(distinct ${sales.id}), 0)`,
      })
      .from(sellers)
      .leftJoin(referralClicks, eq(sellers.referralCode, referralClicks.referralCode))
      .leftJoin(sales, eq(sellers.id, sales.sellerId))
      .groupBy(sellers.id, sellers.name, sellers.email, sellers.isApproved, sellers.referralCode, sellers.createdAt)
      .orderBy(desc(sellers.createdAt));

    return sellersWithStats.map(seller => ({
      ...seller,
      conversionRate: seller.clickCount > 0 ? (seller.conversionCount / seller.clickCount) * 100 : 0
    }));
  }

  // Recent certificates for landing page
  async getRecentCertificates(limit: number = 10): Promise<any[]> {
    const recentCerts = await db
      .select({
        courseTitle: certificates.courseTitle,
        badge: certificates.badge,
        issuedAt: certificates.issuedAt,
        score: certificates.score
      })
      .from(certificates)
      .where(and(eq(certificates.isPaid, true), eq(certificates.isActive, true)))
      .orderBy(desc(certificates.issuedAt))
      .limit(limit);

    return recentCerts.map(cert => ({
      name: "Octamy learner",
      course: cert.courseTitle,
      badge: cert.badge,
      company: "Professional", // Generic company name for privacy
      issuedAt: cert.issuedAt,
      score: cert.score
    }));
  }

  // Contact form operations
  async createContactSubmission(submission: InsertContactSubmission): Promise<ContactSubmission> {
    const [result] = await db
      .insert(contactSubmissions)
      .values(submission)
      .returning();
    return result;
  }

  async getAllContactSubmissions(): Promise<ContactSubmission[]> {
    return await db
      .select()
      .from(contactSubmissions)
      .orderBy(desc(contactSubmissions.submittedAt));
  }

  async getContactSubmissions(search?: string): Promise<ContactSubmission[]> {
    return await db
      .select()
      .from(contactSubmissions)
      .where(search
        ? or(
            ilike(contactSubmissions.name, `%${search}%`),
            ilike(contactSubmissions.email, `%${search}%`),
            ilike(contactSubmissions.subject, `%${search}%`),
            ilike(contactSubmissions.message, `%${search}%`)
          )
        : undefined)
      .orderBy(desc(contactSubmissions.submittedAt));
  }

  async updateContactSubmissionStatus(id: number, status: string, adminNotes?: string): Promise<ContactSubmission> {
    const [result] = await db
      .update(contactSubmissions)
      .set({
        status,
        ...(adminNotes && { adminNotes }),
        ...(status === 'responded' && { respondedAt: new Date() })
      })
      .where(eq(contactSubmissions.id, id))
      .returning();
    return result;
  }

  // Question management for admin
  async getQuestionsForAdmin(courseId?: number, search?: string, page = 1, pageSize = 50): Promise<{ items: any[]; pagination: { page: number; pageSize: number; total: number; totalPages: number } }> {
    try {
      console.log('getQuestionsForAdmin called with:', { courseId, search });

      const conditions = and(
          isNull(questions.bankId),
          courseId ? eq(questions.courseId, courseId) : undefined,
          search ? ilike(questions.question, `%${search}%`) : undefined,
        );
      const [{ total }] = await db.select({ total: count() }).from(questions).where(conditions);
      const safePage = Math.max(1, page);
      const safePageSize = Math.min(100, Math.max(1, pageSize));
      const result = await db
        .select({
          id: questions.id,
          question: questions.question,
          courseId: questions.courseId,
          options: questions.options,
          correctAnswer: questions.correctAnswer,
          difficulty: questions.difficulty,
          isActive: questions.isActive,
          course: sql<{ title: string | null }>`json_build_object('title', ${courses.title})`,
        })
        .from(questions)
        .leftJoin(courses, eq(questions.courseId, courses.id))
        .where(conditions)
        .orderBy(desc(questions.id))
        .limit(safePageSize)
        .offset((safePage - 1) * safePageSize);

      console.log('SQL result rows:', result.length);
      return { items: result, pagination: { page: safePage, pageSize: safePageSize, total: Number(total), totalPages: Math.max(1, Math.ceil(Number(total) / safePageSize)) } };
    } catch (error) {
      console.error('Error in getQuestionsForAdmin:', error);
      throw error;
    }
  }

  // Interview question management for admin
  async getInterviewQuestionsForAdmin(technology?: string, search?: string): Promise<any[]> {
    return await db
      .select()
      .from(interviewQuestions)
      .where(and(
        technology ? eq(interviewQuestions.technology, technology) : undefined,
        search
          ? or(
              ilike(interviewQuestions.title, `%${search}%`),
              ilike(interviewQuestions.question, `%${search}%`),
              ilike(interviewQuestions.technology, `%${search}%`)
            )
          : undefined,
      ))
      .orderBy(desc(interviewQuestions.createdAt));
  }

  async createInterviewQuestion(questionData: any): Promise<any> {
    const [question] = await db
      .insert(interviewQuestions)
      .values({
        ...questionData,
        createdAt: new Date()
      })
      .returning();
    return question;
  }

  async updateInterviewQuestion(id: number, updates: any): Promise<any | undefined> {
    try {
      const [question] = await db
        .update(interviewQuestions)
        .set(updates)
        .where(eq(interviewQuestions.id, id))
        .returning();
      return question || undefined;
    } catch (error) {
      console.error('Error updating interview question:', error);
      throw error;
    }
  }

  async deleteInterviewQuestion(id: number): Promise<boolean> {
    const result = await db
      .delete(interviewQuestions)
      .where(eq(interviewQuestions.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async updateSellerApproval(sellerId: number, approved: boolean): Promise<void> {
    await db
      .update(sellers)
      .set({ isApproved: approved })
      .where(eq(sellers.id, sellerId));
  }

  async getAllPayments(): Promise<Payment[]> {
    return await db.select().from(payments);
  }

  async updatePaymentStatus(transactionId: string, status: string, paymentResponse: any): Promise<void> {
    await db
      .update(payments)
      .set({
        status,
        gatewayStatusRaw: paymentResponse,
      })
      .where(eq(payments.transactionId, transactionId));
  }

  // Interview methods
  async createInterview(data: any): Promise<any> {
    const [interview] = await db.insert(interviews).values({
      userId: data.userId,
      technology: data.technology,
      status: data.status || 'available',
      paymentId: data.paymentId,
      title: data.title,
      totalQuestions: data.totalQuestions ?? 0,
      completedQuestions: data.completedQuestions ?? 0,
      paymentStatus: data.paymentStatus ?? (data.isPaid ? 'paid' : 'pending'),
      paymentAmount: String(data.paymentAmount ?? data.amount ?? 0),
      createdAt: new Date(),
    }).returning();
    
    return interview;
  }

  async getInterviewById(id: number): Promise<any> {
    const [interview] = await db
      .select()
      .from(interviews)
      .where(eq(interviews.id, id));
    
    return interview;
  }

  async updateInterview(id: number, data: any): Promise<any> {
    const [interview] = await db
      .update(interviews)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(interviews.id, id))
      .returning();
    
    return interview;
  }

  async getPaymentByTransactionId(transactionId: string): Promise<Payment | undefined> {
    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.transactionId, transactionId));
    return payment || undefined;
  }

  async processSale(saleData: any): Promise<void> {
    // Process seller commission logic
    console.log('Processing sale:', saleData);
  }

  async deliverCertificate(certificateId: string, deliveryData: any): Promise<void> {
    // Handle certificate delivery logic
    console.log('Delivering certificate:', certificateId, deliveryData);
  }

  // Smart Notifications implementation
  async getUserPreferences(userId: number): Promise<UserPreferences | undefined> {
    const [prefs] = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId));
    return prefs || undefined;
  }

  async createUserPreferences(preferences: InsertUserPreferences): Promise<UserPreferences> {
    const [prefs] = await db
      .insert(userPreferences)
      .values(preferences as typeof userPreferences.$inferInsert)
      .returning();
    return prefs;
  }

  async updateUserPreferences(userId: number, preferences: Partial<InsertUserPreferences>): Promise<UserPreferences> {
    const [prefs] = await db
      .update(userPreferences)
      .set({
        ...(preferences as Partial<typeof userPreferences.$inferInsert>),
        updatedAt: new Date(),
      })
      .where(eq(userPreferences.userId, userId))
      .returning();
    return prefs;
  }

  // Notifications operations
  async getUserNotifications(userId: number, limit = 20): Promise<Notification[]> {
    return await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(limit);
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    const [notif] = await db
      .insert(notifications)
      .values(notification as typeof notifications.$inferInsert)
      .returning();
    return notif;
  }

  async markNotificationAsRead(notificationId: number): Promise<void> {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.id, notificationId));
  }

  async markAllNotificationsAsRead(userId: number): Promise<void> {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.userId, userId));
  }

  // Course recommendations operations
  async getUserRecommendations(userId: number, limit = 10): Promise<(CourseRecommendation & { course: Course & { category: Category } })[]> {
    return await db
      .select()
      .from(courseRecommendations)
      .leftJoin(courses, eq(courseRecommendations.courseId, courses.id))
      .leftJoin(categories, eq(courses.categoryId, categories.id))
      .where(and(
        eq(courseRecommendations.userId, userId),
        eq(courseRecommendations.isShown, false)
      ))
      .orderBy(desc(courseRecommendations.score))
      .limit(limit) as any;
  }

  async createCourseRecommendation(recommendation: InsertCourseRecommendation): Promise<CourseRecommendation> {
    const [rec] = await db
      .insert(courseRecommendations)
      .values(recommendation as typeof courseRecommendations.$inferInsert)
      .returning();
    return rec;
  }

  async markRecommendationAsShown(recommendationId: number): Promise<void> {
    await db
      .update(courseRecommendations)
      .set({ isShown: true })
      .where(eq(courseRecommendations.id, recommendationId));
  }

  async markRecommendationAsClicked(recommendationId: number): Promise<void> {
    await db
      .update(courseRecommendations)
      .set({ isClicked: true })
      .where(eq(courseRecommendations.id, recommendationId));
  }

  // User activity tracking operations
  async recordUserActivity(activity: InsertUserActivity): Promise<UserActivity> {
    const [act] = await db
      .insert(userActivity)
      .values(activity as typeof userActivity.$inferInsert)
      .returning();
    return act;
  }

  async getUserActivity(userId: number, activityType?: string): Promise<UserActivity[]> {
    return await db
      .select()
      .from(userActivity)
      .where(and(
        eq(userActivity.userId, userId),
        activityType ? eq(userActivity.activityType, activityType) : undefined,
      ))
      .orderBy(desc(userActivity.createdAt));
  }

  // Course progress operations
  async getUserCourseProgress(userId: number, courseId?: number): Promise<UserCourseProgress[]> {
    return await db
      .select()
      .from(userCourseProgress)
      .where(and(
        eq(userCourseProgress.userId, userId),
        courseId ? eq(userCourseProgress.courseId, courseId) : undefined,
      ))
      .orderBy(desc(userCourseProgress.updatedAt));
  }

  async upsertUserCourseProgress(progress: InsertUserCourseProgress): Promise<UserCourseProgress> {
    const [result] = await db
      .insert(userCourseProgress)
      .values({
        ...progress,
        updatedAt: new Date()
      })
      .onConflictDoUpdate({
        target: [userCourseProgress.userId, userCourseProgress.courseId],
        set: {
          ...progress,
          updatedAt: new Date()
        }
      })
      .returning();
    return result;
  }

  async updateCourseProgress(userId: number, courseId: number, updates: Partial<InsertUserCourseProgress>): Promise<UserCourseProgress> {
    const [result] = await db
      .update(userCourseProgress)
      .set({
        ...updates,
        updatedAt: new Date()
      })
      .where(and(
        eq(userCourseProgress.userId, userId),
        eq(userCourseProgress.courseId, courseId)
      ))
      .returning();
    return result;
  }

  // Achievement operations
  async getAchievements(category?: string): Promise<Achievement[]> {
    return await db
      .select()
      .from(achievements)
      .where(and(
        eq(achievements.isActive, true),
        category ? eq(achievements.category, category) : undefined,
      ))
      .orderBy(achievements.tier, achievements.points);
  }

  async createAchievement(achievement: InsertAchievement): Promise<Achievement> {
    const [result] = await db
      .insert(achievements)
      .values(achievement)
      .returning();
    return result;
  }

  async getUserAchievements(userId: number, includeDetails = false): Promise<(UserAchievement & { achievement?: Achievement })[]> {
    if (includeDetails) {
      return await db
        .select({
          id: userAchievements.id,
          userId: userAchievements.userId,
          achievementId: userAchievements.achievementId,
          unlockedAt: userAchievements.unlockedAt,
          progress: userAchievements.progress,
          metadata: userAchievements.metadata,
          isViewed: userAchievements.isViewed,
          achievement: achievements
        })
        .from(userAchievements)
        .innerJoin(achievements, eq(userAchievements.achievementId, achievements.id))
        .where(eq(userAchievements.userId, userId))
        .orderBy(desc(userAchievements.unlockedAt));
    }
    
    return await db
      .select()
      .from(userAchievements)
      .where(eq(userAchievements.userId, userId))
      .orderBy(desc(userAchievements.unlockedAt));
  }

  async unlockAchievement(userId: number, achievementId: number, metadata?: any): Promise<UserAchievement> {
    const [result] = await db
      .insert(userAchievements)
      .values({
        userId,
        achievementId,
        metadata,
        progress: 100
      })
      .onConflictDoNothing()
      .returning();
    return result;
  }

  async checkAndUnlockAchievements(userId: number, courseId?: number): Promise<UserAchievement[]> {
    // Get user's current achievements
    const existingAchievements = await this.getUserAchievements(userId);
    const existingAchievementIds = existingAchievements.map(ua => ua.achievementId);
    
    // Get all available achievements
    const allAchievements = await this.getAchievements();
    const newAchievements: UserAchievement[] = [];
    
    for (const achievement of allAchievements) {
      if (existingAchievementIds.includes(achievement.id)) continue;
      
      const criteria = achievement.criteria as any;
      let shouldUnlock = false;
      
      switch (criteria.type) {
        case 'score':
          if (courseId) {
            const attempts = await db
              .select()
              .from(examAttempts)
              .where(and(
                eq(examAttempts.userId, userId),
                eq(examAttempts.courseId, courseId)
              ))
              .orderBy(desc(examAttempts.score))
              .limit(1);
            
            if (attempts.length > 0 && attempts[0].score >= criteria.threshold) {
              shouldUnlock = true;
            }
          }
          break;
          
        case 'completion_count':
          const completedCourses = await db
            .select()
            .from(certificates)
            .where(eq(certificates.userId, userId));
            
          if (completedCourses.length >= criteria.threshold) {
            shouldUnlock = true;
          }
          break;
          
        case 'perfect_score':
          if (courseId) {
            const perfectAttempts = await db
              .select()
              .from(examAttempts)
              .where(and(
                eq(examAttempts.userId, userId),
                eq(examAttempts.courseId, courseId),
                eq(examAttempts.score, 100)
              ));
            
            if (perfectAttempts.length >= criteria.threshold) {
              shouldUnlock = true;
            }
          }
          break;
      }
      
      if (shouldUnlock) {
        const newAchievement = await this.unlockAchievement(userId, achievement.id, {
          courseId,
          unlockedAt: new Date()
        });
        if (newAchievement) {
          newAchievements.push(newAchievement);
        }
      }
    }
    
    return newAchievements;
  }

  // Learning Path operations
  async getLearningPaths(filters?: { categoryId?: number; difficulty?: string }): Promise<(LearningPath & { category: Category })[]> {
    const conditions = [eq(learningPaths.isActive, true)];
    if (filters?.categoryId) conditions.push(eq(learningPaths.categoryId, filters.categoryId));
    if (filters?.difficulty) conditions.push(eq(learningPaths.difficulty, filters.difficulty));

    const query = db
      .select()
      .from(learningPaths)
      .leftJoin(categories, eq(learningPaths.categoryId, categories.id))
      .where(and(...conditions));

    const results = await query.orderBy(desc(learningPaths.createdAt));
    return results.map(row => ({
      ...row.learning_paths,
      category: row.categories!
    })) as (LearningPath & { category: Category })[];
  }

  async createLearningPath(learningPath: InsertLearningPath): Promise<LearningPath> {
    const [result] = await db
      .insert(learningPaths)
      .values(learningPath)
      .returning();
    return result;
  }

  async getUserLearningPaths(userId: number): Promise<any[]> {
    const results = await db
      .select()
      .from(userLearningPaths)
      .leftJoin(learningPaths, eq(userLearningPaths.learningPathId, learningPaths.id))
      .leftJoin(categories, eq(learningPaths.categoryId, categories.id))
      .where(eq(userLearningPaths.userId, userId))
      .orderBy(desc(userLearningPaths.enrolledAt));

    return results.map(row => ({
      ...row.user_learning_paths,
      learningPath: {
        ...row.learning_paths!,
        category: row.categories!
      }
    }));
  }

  async enrollInLearningPath(enrollment: any): Promise<any> {
    // Check if user is already enrolled
    const existing = await db
      .select()
      .from(userLearningPaths)
      .where(and(
        eq(userLearningPaths.userId, enrollment.userId),
        eq(userLearningPaths.learningPathId, enrollment.learningPathId)
      ));

    if (existing.length > 0) {
      return existing[0];
    }

    const [result] = await db
      .insert(userLearningPaths)
      .values(enrollment)
      .onConflictDoNothing({
        target: [userLearningPaths.userId, userLearningPaths.learningPathId],
      })
      .returning();
    if (result) return result;
    const [concurrentEnrollment] = await db
      .select()
      .from(userLearningPaths)
      .where(and(
        eq(userLearningPaths.userId, enrollment.userId),
        eq(userLearningPaths.learningPathId, enrollment.learningPathId),
      ));
    return concurrentEnrollment;
  }

  async updateLearningPathProgress(userId: number, learningPathId: number, updates: Partial<InsertUserLearningPath>): Promise<UserLearningPath> {
    const [result] = await db
      .update(userLearningPaths)
      .set(updates)
      .where(and(
        eq(userLearningPaths.userId, userId),
        eq(userLearningPaths.learningPathId, learningPathId)
      ))
      .returning();

    if (!result) {
      throw new Error('Learning path enrollment not found');
    }
    return result;
  }

  // Skill Assessment operations
  async createSkillAssessment(assessment: InsertSkillAssessment): Promise<SkillAssessment> {
    const [result] = await db
      .insert(skillAssessments)
      .values(assessment as typeof skillAssessments.$inferInsert)
      .returning();
    return result;
  }

  async getUserSkillAssessments(userId: number, categoryId?: number): Promise<SkillAssessment[]> {
    return await db
      .select()
      .from(skillAssessments)
      .where(and(
        eq(skillAssessments.userId, userId),
        categoryId ? eq(skillAssessments.categoryId, categoryId) : undefined,
      ))
      .orderBy(desc(skillAssessments.createdAt));
  }

  async getValidSkillAssessment(userId: number, categoryId: number): Promise<SkillAssessment | undefined> {
    const [assessment] = await db
      .select()
      .from(skillAssessments)
      .where(and(
        eq(skillAssessments.userId, userId),
        eq(skillAssessments.categoryId, categoryId)
      ))
      .orderBy(desc(skillAssessments.createdAt));

    // Check if assessment is still valid
    if (assessment && assessment.validUntil && new Date() < assessment.validUntil) {
      return assessment;
    }
    return undefined;
  }

  // Admin analytics with comprehensive data
  async getAdminAnalytics() {
    const totalUsers = await db.select({ count: sql`count(*)::int` }).from(users);
    const totalCourses = await db.select({ count: sql`count(*)::int` }).from(courses);
    const totalCertificates = await db.select({ count: sql`count(*)::int` }).from(certificates);
    const totalSellers = await db.select({ count: sql`count(*)::int` }).from(sellers);
    const approvedSellers = await db.select({ count: sql`count(*)::int` }).from(sellers).where(eq(sellers.isApproved, true));
    const pendingSellers = await db.select({ count: sql`count(*)::int` }).from(sellers).where(eq(sellers.isApproved, false));
    
    // Calculate total revenue from completed certificates (actual revenue)
    const totalRevenue = await db.select({ 
      total: sql`COALESCE(SUM(CAST(certificate_amount AS DECIMAL)), 0)::int` 
    }).from(payments).where(eq(payments.status, 'completed'));
    
    // Get total clicks and conversions
    const totalClicks = await db.select({ count: sql`count(*)::int` }).from(referralClicks);
    const totalConversions = await db.select({ count: sql`count(*)::int` }).from(payments);
    
    return {
      totalUsers: Number(totalUsers[0]?.count) || 0,
      totalCourses: Number(totalCourses[0]?.count) || 0,
      totalCertificates: Number(totalCertificates[0]?.count) || 0,
      totalSellers: Number(totalSellers[0]?.count) || 0,
      approvedSellers: Number(approvedSellers[0]?.count) || 0,
      pendingSellers: Number(pendingSellers[0]?.count) || 0,
      totalRevenue: Number(totalRevenue[0]?.total) || 0,
      totalClicks: Number(totalClicks[0]?.count) || 0,
      totalConversions: Number(totalConversions[0]?.count) || 0
    };
  }

  // Get customers for admin dashboard
  async getCustomersForAdmin(opts?: { limit?: number; offset?: number; search?: string }) {
    const limit = Math.min(Math.max(opts?.limit ?? 1000, 1), 5000);
    const offset = Math.max(opts?.offset ?? 0, 0);
    const search = opts?.search?.trim();
    let query: any = db.select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      isAdmin: users.isAdmin,
      createdAt: users.createdAt,
      certificateCount: sql`(SELECT COUNT(*) FROM certificates WHERE user_email = ${users.email} AND is_paid = true)::int`.as('certificateCount'),
      totalSpent: sql`COALESCE((SELECT SUM(CAST(certificate_amount AS DECIMAL)) FROM payments WHERE user_id = ${users.id} AND status = 'completed'), 0)::int`.as('totalSpent'),
      examAttempts: sql`(SELECT COUNT(*) FROM exam_attempts WHERE user_id = ${users.id})::int`.as('examAttempts')
    }).from(users);

    if (search) {
      query = query.where(
        or(
          ilike(users.name, `%${search}%`),
          ilike(users.email, `%${search}%`),
          eq(users.id, isNaN(parseInt(search)) ? -1 : parseInt(search))
        )
      );
    }

    return await query.orderBy(desc(users.createdAt)).limit(limit).offset(offset);
  }

  async countCustomersForAdmin(search?: string): Promise<number> {
    let query: any = db.select({ c: sql<number>`COUNT(*)::int` }).from(users);
    if (search?.trim()) {
      query = query.where(
        or(
          ilike(users.name, `%${search}%`),
          ilike(users.email, `%${search}%`),
          eq(users.id, isNaN(parseInt(search)) ? -1 : parseInt(search))
        )
      );
    }
    const [r] = await query;
    return Number(r?.c ?? 0);
  }

  // Get courses for admin dashboard
  async getCoursesForAdmin(opts?: { limit?: number; offset?: number }) {
    const limit = Math.min(Math.max(opts?.limit ?? 1000, 1), 5000);
    const offset = Math.max(opts?.offset ?? 0, 0);
    return await db.select({
      id: courses.id,
      title: courses.title,
      description: courses.description,
      slug: courses.slug,
      categoryId: courses.categoryId,
      duration: courses.duration,
      passingScore: courses.passingScore,
      price: courses.price,
      productType: courses.productType,
      contentPrice: courses.contentPrice,
      originalPrice: courses.originalPrice,
      isOnSale: courses.isOnSale,
      level: courses.level,
      isActive: courses.isActive,
      isInternship: courses.isInternship,
      ownerType: courses.ownerType,
      ownerId: courses.ownerId,
      visibility: courses.visibility,
      language: courses.language,
      certificationMode: courses.certificationMode,
      assessmentPurpose: courses.assessmentPurpose,
      reviewStatus: courses.reviewStatus,
      defaultReviewPolicy: courses.defaultReviewPolicy,
      subscriptionEligible: courses.subscriptionEligible,
      resellerEligible: courses.resellerEligible,
      featuredAt: courses.featuredAt,
      thumbnailUrl: courses.thumbnailUrl,
      useBlueprintEngine: courses.useBlueprintEngine,
      createdAt: courses.createdAt,
      enrollmentCount: sql`(SELECT COUNT(*) FROM exam_attempts WHERE course_id = ${courses.id})::int`.as('enrollmentCount'),
      revenue: sql`COALESCE((SELECT SUM(CAST(certificate_amount AS DECIMAL)) FROM payments p JOIN certificates c ON p.certificate_id = c.id WHERE c.course_id = ${courses.id} AND p.status = 'completed'), 0)::int`.as('revenue'),
      categoryName: categories.name
    })
    .from(courses)
    .leftJoin(categories, eq(courses.categoryId, categories.id))
    .orderBy(desc(courses.createdAt))
    .limit(limit)
    .offset(offset);
  }

  async countCoursesForAdmin(): Promise<number> {
    const [r] = await db.select({ c: sql<number>`COUNT(*)::int` }).from(courses);
    return Number(r?.c ?? 0);
  }

  // Get transactions for admin dashboard
  async getTransactionsForAdmin(opts?: { limit?: number; offset?: number }) {
    const limit = Math.min(Math.max(opts?.limit ?? 1000, 1), 5000);
    const offset = Math.max(opts?.offset ?? 0, 0);
    return await db.select({
      id: payments.id,
      certificateId: certificates.certificateId,
      amount: payments.certificateAmount,
      status: payments.status,
      createdAt: payments.createdAt,
      userName: users.name,
      userEmail: users.email,
      courseTitle: courses.title,
      transactionId: payments.transactionId,
      paymentMethod: payments.paymentMethod
    })
    .from(payments)
    .leftJoin(certificates, eq(payments.certificateId, certificates.id))
    .leftJoin(users, eq(payments.userId, users.id))
    .leftJoin(courses, eq(certificates.courseId, courses.id))
    .orderBy(desc(payments.createdAt))
    .limit(limit)
    .offset(offset);
  }

  async countTransactionsForAdmin(): Promise<number> {
    const [r] = await db.select({ c: sql<number>`COUNT(*)::int` }).from(payments);
    return Number(r?.c ?? 0);
  }

  // Get partners for admin dashboard
  async getPartnersForAdmin(opts?: { limit?: number; offset?: number }) {
    const limit = Math.min(Math.max(opts?.limit ?? 1000, 1), 5000);
    const offset = Math.max(opts?.offset ?? 0, 0);
    return await db.select({
      id: sellers.id,
      name: sellers.name,
      email: sellers.email,
      isApproved: sellers.isApproved,
      isActive: sellers.isActive,
      createdAt: sellers.createdAt,
      totalEarnings: sellers.totalEarnings,
      pendingEarnings: sellers.pendingEarnings,
      referralCode: sellers.referralCode,
      clickCount: sql`(SELECT COUNT(*) FROM referral_clicks WHERE referral_code = ${sellers.referralCode})::int`.as('clickCount'),
      salesCount: sql`(SELECT COUNT(*) FROM sales WHERE seller_id = ${sellers.id})::int`.as('salesCount')
    })
    .from(sellers)
    .orderBy(desc(sellers.createdAt))
    .limit(limit)
    .offset(offset);
  }

  async countPartnersForAdmin(): Promise<number> {
    const [r] = await db.select({ c: sql<number>`COUNT(*)::int` }).from(sellers);
    return Number(r?.c ?? 0);
  }

  // Get all sellers with detailed analytics
  async getAllSellers() {
    const sellersWithStats = await db.select({
      id: sellers.id,
      name: sellers.name,
      email: sellers.email,
      phone: sellers.phone,
      isApproved: sellers.isApproved,
      isActive: sellers.isActive,
      referralCode: sellers.referralCode,
      commissionRate: sellers.commissionRate,
      upiId: sellers.upiId,
      accountHolderName: sellers.accountHolderName,
      createdAt: sellers.createdAt,
      clickCount: sql`(
        SELECT COUNT(*) FROM referral_clicks 
        WHERE referral_code = ${sellers.referralCode}
      )`.as('clickCount'),
      conversionCount: sql`(
        SELECT COUNT(*) FROM payments 
        WHERE referral_code = ${sellers.referralCode} 
        AND status = 'success'
      )`.as('conversionCount'),
      totalEarnings: sql`(
        SELECT COALESCE(SUM(CAST(amount AS DECIMAL) * CAST(${sellers.commissionRate} AS DECIMAL) / 100), 0)
        FROM payments 
        WHERE referral_code = ${sellers.referralCode} 
        AND status = 'success'
      )`.as('totalEarnings')
    }).from(sellers).orderBy(desc(sellers.createdAt));

    return sellersWithStats.map(seller => ({
      ...seller,
      clickCount: Number(seller.clickCount) || 0,
      conversionCount: Number(seller.conversionCount) || 0,
      totalEarnings: Number(seller.totalEarnings) || 0,
      conversionRate: Number(seller.clickCount) > 0
        ? ((Number(seller.conversionCount) / Number(seller.clickCount)) * 100).toFixed(2)
        : '0.00'
    }));
  }

  // Get withdrawal requests for admin
  async getWithdrawalRequests() {
    return await db.select({
      id: withdrawalRequests.id,
      sellerId: withdrawalRequests.sellerId,
      amount: withdrawalRequests.amount,
      status: withdrawalRequests.status,
      requestedAt: withdrawalRequests.createdAt,
      processedAt: withdrawalRequests.processedAt,
      sellerName: sellers.name,
      sellerEmail: sellers.email,
      upiId: sellers.upiId
    })
    .from(withdrawalRequests)
    .leftJoin(sellers, eq(withdrawalRequests.sellerId, sellers.id))
    .orderBy(desc(withdrawalRequests.createdAt));
  }

  // Get recent transactions
  async getRecentTransactions() {
    return await db.select({
      id: payments.id,
      transactionId: payments.transactionId,
      amount: payments.amount,
      status: payments.status,
      createdAt: payments.createdAt,
      certificateId: payments.certificateId
    })
    .from(payments)
    .orderBy(desc(payments.createdAt))
    .limit(20);
  }

  // Admin customer management
  async getAllCustomers() {
    return await db.select({
      id: users.id,
      name: users.name,
      email: users.email,
      createdAt: users.createdAt,
      isAdmin: users.isAdmin,
      certificateCount: sql`(
        SELECT COUNT(*) FROM certificates 
        WHERE user_email = ${users.email} AND is_paid = true
      )`.as('certificateCount'),
      totalSpent: sql`(
        SELECT COALESCE(SUM(CAST(certificate_amount AS DECIMAL)), 0)
        FROM payments 
        WHERE user_id = ${users.id} AND status = 'completed'
      )`.as('totalSpent')
    })
    .from(users)
    .orderBy(desc(users.createdAt));
  }

  // Admin course management
  async getAdminCourses() {
    return await db.select({
      id: courses.id,
      title: courses.title,
      description: courses.description,
      slug: courses.slug,
      categoryId: courses.categoryId,
      categoryName: sql`(SELECT name FROM categories WHERE id = ${courses.categoryId})`.as('categoryName'),
      duration: courses.duration,
      passingScore: courses.passingScore,
      price: courses.price,
      originalPrice: courses.originalPrice,
      isOnSale: courses.isOnSale,
      saleEndDate: courses.saleEndDate,
      level: courses.level,
      isActive: courses.isActive,
      isInternship: courses.isInternship,
      createdAt: courses.createdAt,
      enrollmentCount: sql`(
        SELECT COUNT(*) FROM exam_attempts 
        WHERE course_id = ${courses.id}
      )`.as('enrollmentCount'),
      certificateCount: sql`(
        SELECT COUNT(*) FROM certificates 
        WHERE course_id = ${courses.id} AND is_paid = true
      )`.as('certificateCount'),
      revenue: sql`(
        SELECT COALESCE(SUM(CAST(certificate_amount AS DECIMAL)), 0)
        FROM payments 
        WHERE course_id = ${courses.id} AND status = 'completed'
      )`.as('revenue')
    })
    .from(courses)
    .orderBy(desc(courses.createdAt));
  }

  async createCourse(courseData: any) {
    const [course] = await db.insert(courses).values(courseData).returning();
    return course;
  }

  async updateCourse(courseId: number, courseData: any) {
    const [course] = await db.update(courses)
      .set(courseData)
      .where(eq(courses.id, courseId))
      .returning();
    return course;
  }

  async deleteCourse(courseId: number): Promise<void> {
    // First delete related data
    await db.delete(questions).where(eq(questions.courseId, courseId));
    await db.delete(examAttempts).where(eq(examAttempts.courseId, courseId));
    
    // Then delete the course
    await db.delete(courses).where(eq(courses.id, courseId));
  }

  async getCourseQuestions(courseId: number) {
    return await db.select().from(questions).where(eq(questions.courseId, courseId));
  }

  async createQuestion(questionData: any) {
    try {
      const [question] = await db.insert(questions).values(questionData).returning();
      return question;
    } catch (error) {
      console.error('Error creating question:', error);
      throw error;
    }
  }

  async updateQuestion(id: number, questionData: Partial<InsertQuestion>): Promise<Question> {
    const [question] = await db
      .update(questions)
      .set(questionData as Partial<typeof questions.$inferInsert>)
      .where(eq(questions.id, id))
      .returning();

    if (!question) {
      throw new Error('Question not found');
    }

    return question;
  }

  async deleteQuestion(id: number): Promise<void> {
    await this.deleteBankQuestion(id);
  }

  // Admin course management with comprehensive data
  async getAllCoursesForAdmin(limit = 1000, search?: string) {
    let query = db.select({
      id: courses.id,
      title: courses.title,
      description: courses.description,
      slug: courses.slug,
      categoryId: courses.categoryId,
      categoryName: categories.name,
      duration: courses.duration,
      passingScore: courses.passingScore,
      price: courses.price,
      originalPrice: courses.originalPrice,
      isOnSale: courses.isOnSale,
      level: courses.level,
      isActive: courses.isActive,
      isInternship: courses.isInternship,
      createdAt: courses.createdAt,
      enrollmentCount: sql`(
        SELECT COUNT(DISTINCT user_email) FROM exam_attempts 
        WHERE course_id = ${courses.id}
      )`.as('enrollmentCount'),
      certificateCount: sql`(
        SELECT COUNT(*) FROM certificates 
        WHERE course_id = ${courses.id} AND is_paid = true
      )`.as('certificateCount'),
      revenue: sql`(
        SELECT COALESCE(SUM(CAST(certificate_amount AS DECIMAL)), 0)
        FROM payments 
        WHERE course_id = ${courses.id} AND status = 'completed'
      )`.as('revenue')
    })
    .from(courses)
    .leftJoin(categories, eq(courses.categoryId, categories.id))
    .$dynamic();

    if (search) {
      query = query.where(
        or(
          ilike(courses.title, `%${search}%`),
          ilike(courses.description, `%${search}%`),
          ilike(categories.name, `%${search}%`),
          eq(courses.id, isNaN(parseInt(search)) ? -1 : parseInt(search))
        )
      );
    }

    return await query
      .orderBy(desc(courses.createdAt))
      .limit(limit);
  }

  // Add categories with course count method
  async getCategoriesWithCourseCount() {
    return await db.select({
      id: categories.id,
      name: categories.name,
      description: categories.description,
      slug: categories.slug,
      icon: categories.icon,
      courseCount: sql`(
        SELECT COUNT(*) FROM courses WHERE category_id = ${categories.id}
      )`.as('courseCount')
    })
    .from(categories)
    .orderBy(categories.name);
  }

  // Get all payments for admin with detailed information
  async getAllPaymentsForAdmin(limit = 1000, search?: string) {
    let query = db.select({
      id: payments.id,
      transactionId: payments.transactionId,
      amount: payments.amount,
      certificateAmount: payments.certificateAmount,
      status: payments.status,
      paymentMethod: payments.paymentMethod,
      createdAt: payments.createdAt,
      courseTitle: sql`(SELECT title FROM courses WHERE id = ${payments.courseId})`.as('courseTitle'),
      userName: sql`COALESCE((SELECT name FROM users WHERE id = ${payments.userId}), 'Guest User')`.as('userName'),
      userEmail: sql`COALESCE((SELECT email FROM users WHERE id = ${payments.userId}), 'No Email')`.as('userEmail'),
      certificateId: payments.certificateId
    })
    .from(payments)
    .$dynamic();

    if (search) {
      query = query.where(
        or(
          ilike(payments.transactionId, `%${search}%`),
          eq(payments.id, isNaN(parseInt(search)) ? -1 : parseInt(search))
        )
      );
    }

    return await query
      .orderBy(desc(payments.createdAt))
      .limit(limit);
  }

  // Get detailed transaction information with nested data
  async getTransactionDetails(transactionId: number) {
    // Get basic transaction info
    const [transaction] = await db
      .select()
      .from(payments)
      .where(eq(payments.id, transactionId));

    if (!transaction) {
      throw new Error('Transaction not found');
    }

    // Get certificate details if available
    let certificate = null;
    if (transaction.certificateId) {
      const [cert] = await db
        .select()
        .from(certificates)
        .where(eq(certificates.id, transaction.certificateId));
      certificate = cert;
    }

    // Get course details if certificate has courseId
    let course = null;
    if (certificate?.courseId) {
      const [courseData] = await db
        .select({
          id: courses.id,
          title: courses.title,
          description: courses.description,
          duration: courses.duration,
          price: courses.price,
          level: courses.level,
          categoryName: sql`(SELECT name FROM categories WHERE id = ${courses.categoryId})`.as('categoryName')
        })
        .from(courses)
        .where(eq(courses.id, certificate.courseId));
      course = courseData;
    }

    // Get customer details if transaction has userId
    let customer = null;
    if (transaction.userId) {
      const [userData] = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          phone: users.phone,
          createdAt: users.createdAt
        })
        .from(users)
        .where(eq(users.id, transaction.userId));
      customer = userData;
    }

    // Get delivery address if transaction includes physical copy
    let address = null;
    if (transaction.shippingAmount && parseInt(transaction.shippingAmount) > 0) {
      const [addressData] = await db
        .select()
        .from(userAddresses)
        .where(eq(userAddresses.userId, transaction.userId || 0))
        .orderBy(desc(userAddresses.createdAt))
        .limit(1);
      address = addressData;
    }

    return {
      transaction,
      certificate,
      course,
      customer,
      address,
      paymentGateway: 'PayUMoney',
      paymentMethod: transaction.paymentMethod,
      gatewayTransactionId: transaction.transactionId,
      completedAt: transaction.createdAt
    };
  }

  // Get all sellers for admin with detailed information
  async getAllSellersForAdmin(limit = 1000, search?: string) {
    let query = db.select({
      id: sellers.id,
      name: sellers.name,
      email: sellers.email,
      phone: sellers.phone,
      referralCode: sellers.referralCode,
      isApproved: sellers.isApproved,
      isActive: sellers.isActive,
      commissionRate: sellers.commissionRate,
      totalEarnings: sellers.totalEarnings,
      pendingEarnings: sellers.pendingEarnings,
      createdAt: sellers.createdAt,
      clickCount: sql`(
        SELECT COUNT(*) FROM referral_clicks WHERE seller_id = ${sellers.id}
      )`.as('clickCount'),
      conversionCount: sql`(
        SELECT COUNT(*) FROM sales WHERE seller_id = ${sellers.id}
      )`.as('conversionCount')
    })
    .from(sellers)
    .$dynamic();

    if (search) {
      query = query.where(
        or(
          ilike(sellers.name, `%${search}%`),
          ilike(sellers.email, `%${search}%`),
          ilike(sellers.referralCode, `%${search}%`),
          eq(sellers.id, isNaN(parseInt(search)) ? -1 : parseInt(search))
        )
      );
    }

    return await query
      .orderBy(desc(sellers.createdAt))
      .limit(limit);
  }

  // Fix exam attempts method name and add proper search
  async getAllExamAttempts(limit = 1000, search?: string) {
    let query = db.select({
      id: examAttempts.id,
      userId: examAttempts.userId,
      courseId: examAttempts.courseId,
      userEmail: examAttempts.userEmail,
      userName: examAttempts.userName,
      score: examAttempts.score,
      totalQuestions: examAttempts.totalQuestions,
      timeTaken: examAttempts.timeTaken,
      createdAt: examAttempts.createdAt,
      courseTitle: sql`(SELECT title FROM courses WHERE id = ${examAttempts.courseId})`.as('courseTitle'),
      passed: sql`CASE WHEN ${examAttempts.score} >= (SELECT passing_score FROM courses WHERE id = ${examAttempts.courseId}) THEN true ELSE false END`.as('passed')
    })
    .from(examAttempts)
    .$dynamic();

    if (search) {
      query = query.where(
        or(
          ilike(examAttempts.userEmail, `%${search}%`),
          ilike(examAttempts.userName, `%${search}%`),
          eq(examAttempts.id, isNaN(parseInt(search)) ? -1 : parseInt(search))
        )
      );
    }

    return await query
      .orderBy(desc(examAttempts.createdAt))
      .limit(limit);
  }

  // Create course (admin)
  async createCourseAdmin(courseData: InsertCourse) {
    const [course] = await db.insert(courses).values(courseData).returning();
    return course;
  }

  // Update course (admin)
  async updateCourseAdmin(id: number, updates: Partial<InsertCourse>) {
    return db.transaction(async (tx) => {
      // Serialize publication with question mutations. Question retirement
      // unpublishes linked courses through this same locked row, so a
      // concurrent publish cannot commit using a stale readiness snapshot.
      const [existing] = await tx.select().from(courses)
        .where(eq(courses.id, id))
        .for("update");
      if (!existing) return undefined;
      await assertAssessmentPublishReadiness({
        courseId: id,
        previous: existing as AssessmentPublishCourseState,
        next: { ...existing, ...updates } as AssessmentPublishCourseState,
        executor: tx,
      });
      const [course] = await tx.update(courses)
        .set(updates)
        .where(eq(courses.id, id))
        .returning();
      return course;
    });
  }

  // Delete course (admin)
  async deleteCourseAdmin(id: number) {
    // First delete related data
    await db.delete(questions).where(eq(questions.courseId, id));
    await db.delete(examAttempts).where(eq(examAttempts.courseId, id));
    await db.delete(certificates).where(eq(certificates.courseId, id));
    
    // Then delete the course
    await db.delete(courses).where(eq(courses.id, id));
  }

  // Create question (admin)
  async createQuestionAdmin(questionData: InsertQuestion) {
    const [question] = await db
      .insert(questions)
      .values(questionData as typeof questions.$inferInsert)
      .returning();
    return question;
  }

  // Update question (admin)
  async updateQuestionAdmin(id: number, updates: Partial<InsertQuestion>) {
    const [question] = await db.update(questions)
      .set(updates as Partial<typeof questions.$inferInsert>)
      .where(and(eq(questions.id, id), isNull(questions.bankId)))
      .returning();
    return question;
  }

  // Delete question (admin)
  async deleteQuestionAdmin(id: number, retiredBy?: number) {
    return db.transaction(async (tx) => {
      const [existing] = await tx.select().from(questions)
        .where(and(eq(questions.id, id), isNull(questions.bankId)))
        .for("update");
      if (!existing) return undefined;
      const [lineage] = await tx.select({ id: questionProvenance.id })
        .from(questionProvenance)
        .where(eq(questionProvenance.questionId, id))
        .limit(1);

      let result: Question;
      if (lineage) {
        if (existing.reviewStatus === "retired") return existing;
        await tx.insert(questionVersions).values({
          questionId: id,
          version: existing.version ?? 1,
          snapshot: existing as unknown as Record<string, unknown>,
          changeNote: "Retired by admin; imported provenance retained",
          changedBy: retiredBy ?? null,
        });
        [result] = await tx.update(questions).set({
          reviewStatus: "retired",
          isActive: false,
          version: (existing.version ?? 1) + 1,
          updatedAt: new Date(),
        }).where(eq(questions.id, id)).returning();
      } else {
        [result] = await tx.delete(questions).where(eq(questions.id, id)).returning();
      }
      if (existing.bankId && existing.reviewStatus !== "retired") {
        await tx.update(questionBanks)
          .set({ questionCount: sql`GREATEST(${questionBanks.questionCount} - 1, 0)`, updatedAt: new Date() })
          .where(eq(questionBanks.id, existing.bankId));
      }
      return result;
    });
  }

  // Get exam attempts for admin
  async getExamAttemptsForAdmin() {
    return await db.select({
      id: examAttempts.id,
      userId: examAttempts.userId,
      courseId: examAttempts.courseId,
      userEmail: examAttempts.userEmail,
      userName: examAttempts.userName,
      score: examAttempts.score,
      totalQuestions: examAttempts.totalQuestions,
      timeTaken: examAttempts.timeTaken,
      createdAt: examAttempts.createdAt,
      courseTitle: courses.title,
      passed: sql`CASE WHEN ${examAttempts.score} >= ${courses.passingScore} THEN true ELSE false END`.as('passed')
    })
    .from(examAttempts)
    .leftJoin(courses, eq(examAttempts.courseId, courses.id))
    .orderBy(desc(examAttempts.createdAt))
    .limit(100);
  }

  // Get detailed analytics for admin
  async getDetailedAnalytics() {
    const [todayStats] = await db.select({
      todayUsers: sql`COUNT(CASE WHEN DATE(created_at) = CURRENT_DATE THEN 1 END)`,
      todayRevenue: sql`COALESCE(SUM(CASE WHEN DATE(p.created_at) = CURRENT_DATE AND p.status = 'success' THEN CAST(p.amount AS DECIMAL) ELSE 0 END), 0)`,
      todayExams: sql`COUNT(CASE WHEN DATE(ea.created_at) = CURRENT_DATE THEN 1 END)`
    })
    .from(users)
    .leftJoin(payments, eq(users.id, payments.userId))
    .leftJoin(examAttempts, eq(users.id, examAttempts.userId));

    const [monthlyStats] = await db.select({
      monthlyUsers: sql`COUNT(CASE WHEN DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE) THEN 1 END)`,
      monthlyRevenue: sql`COALESCE(SUM(CASE WHEN DATE_TRUNC('month', p.created_at) = DATE_TRUNC('month', CURRENT_DATE) AND p.status = 'success' THEN CAST(p.amount AS DECIMAL) ELSE 0 END), 0)`,
      monthlyExams: sql`COUNT(CASE WHEN DATE_TRUNC('month', ea.created_at) = DATE_TRUNC('month', CURRENT_DATE) THEN 1 END)`
    })
    .from(users)
    .leftJoin(payments, eq(users.id, payments.userId))
    .leftJoin(examAttempts, eq(users.id, examAttempts.userId));

    return {
      today: {
        users: Number(todayStats.todayUsers) || 0,
        revenue: Number(todayStats.todayRevenue) || 0,
        exams: Number(todayStats.todayExams) || 0
      },
      monthly: {
        users: Number(monthlyStats.monthlyUsers) || 0,
        revenue: Number(monthlyStats.monthlyRevenue) || 0,
        exams: Number(monthlyStats.monthlyExams) || 0
      }
    };
  }

  // Recruiter Management Methods
  async getRecruiterByEmail(email: string) {
    const [recruiter] = await db.select().from(recruiters).where(eq(recruiters.email, email));
    return recruiter || undefined;
  }

  async getRecruiterById(id: number) {
    const [recruiter] = await db.select().from(recruiters).where(eq(recruiters.id, id));
    return recruiter || undefined;
  }

  async createRecruiter(data: any) {
    const auto = process.env.AUTO_APPROVE_PROFILES !== 'false';
    const [recruiter] = await db.insert(recruiters).values({
      ...data,
      kycStatus: data.kycStatus ?? (auto ? 'approved' : 'pending'),
    }).returning();
    return recruiter;
  }

  async updateRecruiterLastLogin(id: number) {
    await db.update(recruiters)
      .set({ lastLoginAt: new Date() })
      .where(eq(recruiters.id, id));
  }

  async updateRecruiterStep1(data: any) {
    await db.update(recruiters)
      .set({
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        designation: data.designation,
        linkedinProfile: data.linkedinProfile,
        registrationStep: data.registrationStep,
        updatedAt: new Date()
      })
      .where(eq(recruiters.id, data.id));
  }

  async updateRecruiterStep2(data: any) {
    await db.update(recruiters)
      .set({
        companyName: data.companyName,
        companyWebsite: data.companyWebsite,
        companySize: data.companySize,
        industry: data.industry,
        companyAddress: data.companyAddress,
        companyCity: data.companyCity,
        companyState: data.companyState,
        companyCountry: data.companyCountry,
        registrationStep: data.registrationStep,
        updatedAt: new Date()
      })
      .where(eq(recruiters.id, data.id));
  }

  async updateRecruiterStep3(data: any) {
    await db.update(recruiters)
      .set({
        gstNumber: data.gstNumber,
        panNumber: data.panNumber,
        companyRegistrationNumber: data.companyRegistrationNumber,
        gstCertificate: data.gstCertificate,
        panCard: data.panCard,
        companyRegistrationCertificate: data.companyRegistrationCertificate,
        registrationStep: data.registrationStep,
        kycStatus: data.kycStatus,
        updatedAt: new Date()
      })
      .where(eq(recruiters.id, data.id));
  }

  async updateRecruiterPassword(recruiterId: number, hashedPassword: string) {
    await db.update(recruiters)
      .set({
        password: hashedPassword,
        updatedAt: new Date()
      })
      .where(eq(recruiters.id, recruiterId));
  }

  async updateRecruiterCredits(recruiterId: number, newCredits: number) {
    await db.update(recruiters)
      .set({
        creditsBalance: newCredits.toFixed(2),
        updatedAt: new Date()
      })
      .where(eq(recruiters.id, recruiterId));
  }

  async getRecruiterDashboardData(recruiterId: number) {
    const profileViews = await db.select({ count: sql`count(*)` })
      .from(profileAccessLogs)
      .where(and(
        eq(profileAccessLogs.recruiterId, recruiterId),
        eq(profileAccessLogs.accessType, 'profile_view')
      ));

    const cvDownloads = await db.select({ count: sql`count(*)` })
      .from(profileAccessLogs)
      .where(and(
        eq(profileAccessLogs.recruiterId, recruiterId),
        eq(profileAccessLogs.accessType, 'cv_download')
      ));

    const interviewAccess = await db.select({ count: sql`count(*)` })
      .from(profileAccessLogs)
      .where(and(
        eq(profileAccessLogs.recruiterId, recruiterId),
        eq(profileAccessLogs.accessType, 'interview_access')
      ));

    const recentActivity = await db.select({
      id: profileAccessLogs.id,
      type: profileAccessLogs.accessType,
      userName: users.name,
      creditsUsed: profileAccessLogs.creditsUsed,
      createdAt: profileAccessLogs.createdAt
    })
    .from(profileAccessLogs)
    .leftJoin(users, eq(profileAccessLogs.userId, users.id))
    .where(eq(profileAccessLogs.recruiterId, recruiterId))
    .orderBy(desc(profileAccessLogs.createdAt))
    .limit(10);

    return {
      profileViews: profileViews[0]?.count || 0,
      cvDownloads: cvDownloads[0]?.count || 0,
      interviewAccess: interviewAccess[0]?.count || 0,
      recentActivity
    };
  }

  async searchCandidates(recruiterId: number, filters: any = {}, page: number = 1, limit: number = 10) {
    const safeFilters = filters && typeof filters === 'object' ? filters : {};
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(50, Math.max(1, Number(limit) || 10));
    const offset = (safePage - 1) * safeLimit;

    // Discovery is always learner-controlled and evidence-backed. An active
    // institute affiliation adds a second gate: at least one affiliated,
    // verified institute must explicitly enable recruiter discovery.
    const hasCurrentEvidence = sql`EXISTS (
      SELECT 1 FROM certificates c
      WHERE c.user_id = ${users.id}
        AND c.is_active = true
        AND c.is_paid = true
        AND c.expires_at > NOW()
    )`;
    const institutePolicyAllowsDiscovery = sql`(
      NOT EXISTS (
        SELECT 1 FROM cohort_students cs
        WHERE cs.status = 'active'
          AND (cs.user_id = ${users.id} OR lower(cs.email) = lower(${users.email}))
      )
      OR EXISTS (
        SELECT 1
        FROM cohort_students cs
        JOIN institutes i ON i.id = cs.institute_id
        WHERE cs.status = 'active'
          AND (cs.user_id = ${users.id} OR lower(cs.email) = lower(${users.email}))
          AND i.status = 'verified'
          AND i.recruiter_discovery_enabled = true
      )
    )`;
    const conditions: any[] = [
      eq(users.profileVisibility, true),
      eq(users.isAdmin, false),
      hasCurrentEvidence,
      institutePolicyAllowsDiscovery,
    ];

    if (typeof safeFilters.location === 'string' && safeFilters.location.trim()) {
      conditions.push(ilike(users.location, `%${safeFilters.location.trim()}%`));
    }
    const rawMinExperience = safeFilters.experience?.min;
    const rawMaxExperience = safeFilters.experience?.max;
    const minExperience = rawMinExperience === '' || rawMinExperience == null ? Number.NaN : Number(rawMinExperience);
    const maxExperience = rawMaxExperience === '' || rawMaxExperience == null ? Number.NaN : Number(rawMaxExperience);
    if (Number.isFinite(minExperience)) conditions.push(gte(users.experience, Math.max(0, minExperience)));
    if (Number.isFinite(maxExperience)) conditions.push(lte(users.experience, Math.max(0, maxExperience)));
    if (typeof safeFilters.availability === 'string' && safeFilters.availability) conditions.push(eq(users.availability, safeFilters.availability));
    if (typeof safeFilters.noticePeriod === 'string' && safeFilters.noticePeriod) conditions.push(eq(users.noticePeriod, safeFilters.noticePeriod));

    const requestedSkills = [
      ...(Array.isArray(safeFilters.skills) ? safeFilters.skills : []),
      ...(Array.isArray(safeFilters.technology) ? safeFilters.technology : []),
    ].map((value: unknown) => String(value).trim()).filter(Boolean);
    if (requestedSkills.length) conditions.push(sql`${users.skills} && ${requestedSkills}::text[]`);
    if (Array.isArray(safeFilters.workType) && safeFilters.workType.length) conditions.push(sql`${users.workType} && ${safeFilters.workType}::text[]`);
    if (Array.isArray(safeFilters.category) && safeFilters.category.length) conditions.push(sql`${users.category} && ${safeFilters.category}::text[]`);
    if (safeFilters.hasInterviews) {
      // Legacy interview rows are not governed recruiter evidence. Verified
      // Interview Studio grants are intentionally unreleased, so this filter
      // must fail closed instead of surfacing old prototype data.
      conditions.push(sql`false`);
    }
    const minScore = Number(safeFilters.minScore);
    if (Number.isFinite(minScore) && minScore > 0) {
      conditions.push(sql`EXISTS (
        SELECT 1 FROM certificates c
        WHERE c.user_id = ${users.id}
          AND c.is_active = true AND c.is_paid = true AND c.expires_at > NOW()
          AND c.score >= ${Math.min(100, minScore)}
      )`);
    }

    const whereClause = and(...conditions);
    const allCandidates = await db.select({
      id: users.id,
      name: users.name,
      location: users.location,
      experience: users.experience,
      currentRole: users.currentRole,
      skills: users.skills,
      availability: users.availability,
      noticePeriod: users.noticePeriod,
      workType: users.workType,
      category: users.category,
      profileCompleteness: users.profileCompleteness,
      lastActive: users.lastActive,
      hasResume: sql<boolean>`${users.resume} IS NOT NULL AND btrim(${users.resume}) <> ''`.as('has_resume'),
      interviewCount: sql<number>`0::int`.as('interview_count'),
      profileUnlocked: sql<boolean>`EXISTS (
        SELECT 1 FROM profile_access_logs pal
        WHERE pal.recruiter_id = ${recruiterId}
          AND pal.user_id = ${users.id}
          AND pal.access_type = 'profile_view'
      )`.as('profile_unlocked'),
      cvUnlocked: sql<boolean>`EXISTS (
        SELECT 1 FROM profile_access_logs pal
        WHERE pal.recruiter_id = ${recruiterId}
          AND pal.user_id = ${users.id}
          AND pal.access_type = 'cv_download'
      )`.as('cv_unlocked'),
      interviewUnlocked: sql<boolean>`false`.as('interview_unlocked'),
    }).from(users)
      .where(whereClause)
      .orderBy(desc(users.lastActive))
      .limit(safeLimit)
      .offset(offset);

    const candidatesWithDetails = await Promise.all(allCandidates.map(async (candidate) => {
      const certs = await db.select({
        id: certificates.id,
        certificateId: certificates.certificateId,
        courseTitle: certificates.courseTitle,
        score: certificates.score,
        badge: certificates.badge,
        expiresAt: certificates.expiresAt,
      }).from(certificates)
        .where(and(
          eq(certificates.userId, candidate.id),
          eq(certificates.isActive, true),
          eq(certificates.isPaid, true),
          gt(certificates.expiresAt, new Date()),
        ))
        .orderBy(desc(certificates.issuedAt))
        .limit(3);

      return {
        ...candidate,
        certificates: certs,
        access: {
          profile: candidate.profileUnlocked,
          cv: candidate.cvUnlocked,
          interview: candidate.interviewUnlocked,
        },
      };
    }));

    const totalResult = await db.select({ count: sql`count(*)` }).from(users).where(whereClause);
    const total = Number(totalResult[0]?.count) || 0;

    return {
      candidates: candidatesWithDetails,
      total,
      page: safePage,
      totalPages: Math.ceil(total / safeLimit),
      creditCosts: RECRUITER_ACCESS_COSTS,
      eligibility: {
        learnerConsentRequired: true,
        activePaidEvidenceRequired: true,
        institutePolicyRequiredForActiveAffiliations: true,
      },
    };
  }

  async getCandidateProfile(candidateId: number, recruiterId: number) {
    const candidate = await db.select({
      id: users.id,
      email: users.email,
      name: users.name,
      location: users.location,
      experience: users.experience,
      currentRole: users.currentRole,
      skills: users.skills,
      availability: users.availability,
      noticePeriod: users.noticePeriod,
      expectedSalary: users.expectedSalary,
      workType: users.workType,
      category: users.category,
      linkedinProfile: users.linkedinProfile,
      portfolioUrl: users.portfolioUrl,
      bio: users.bio,
      careerGoals: users.careerGoals,
      lastActive: users.lastActive,
      profileCompleteness: users.profileCompleteness,
      hasResume: sql<boolean>`${users.resume} IS NOT NULL AND btrim(${users.resume}) <> ''`.as('has_resume'),
    }).from(users).where(and(
      eq(users.id, candidateId),
      eq(users.profileVisibility, true),
      eq(users.isAdmin, false),
      sql`EXISTS (
        SELECT 1 FROM certificates c
        WHERE c.user_id = ${users.id}
          AND c.is_active = true AND c.is_paid = true AND c.expires_at > NOW()
      )`,
      sql`(
        NOT EXISTS (
          SELECT 1 FROM cohort_students cs
          WHERE cs.status = 'active'
            AND (cs.user_id = ${users.id} OR lower(cs.email) = lower(${users.email}))
        )
        OR EXISTS (
          SELECT 1 FROM cohort_students cs
          JOIN institutes i ON i.id = cs.institute_id
          WHERE cs.status = 'active'
            AND (cs.user_id = ${users.id} OR lower(cs.email) = lower(${users.email}))
            AND i.status = 'verified'
            AND i.recruiter_discovery_enabled = true
        )
      )`,
    ));

    if (candidate.length === 0) return null;

    const certs = await db.select({
      id: certificates.id,
      courseTitle: certificates.courseTitle,
      score: certificates.score,
      badge: certificates.badge,
      issuedAt: certificates.issuedAt,
      expiresAt: certificates.expiresAt,
      certificateId: certificates.certificateId,
    }).from(certificates)
      .where(and(
        eq(certificates.userId, candidateId),
        eq(certificates.isActive, true),
        eq(certificates.isPaid, true),
        gt(certificates.expiresAt, new Date()),
      ))
      .orderBy(desc(certificates.issuedAt));

    const [cvAccess] = await db.select({ id: profileAccessLogs.id })
      .from(profileAccessLogs)
      .where(and(
        eq(profileAccessLogs.recruiterId, recruiterId),
        eq(profileAccessLogs.userId, candidateId),
        eq(profileAccessLogs.accessType, 'cv_download'),
      ))
      .limit(1);

    return {
      ...candidate[0],
      certificates: certs,
      interviews: [],
      cvAccessUnlocked: Boolean(cvAccess),
      interviewAccessUnlocked: false,
      creditCosts: RECRUITER_ACCESS_COSTS,
      profileViews: 0,
    };
  }

  async processProfileAccess(recruiterId: number, candidateId: number, accessType: RecruiterAccessType) {
    const creditsRequired = RECRUITER_ACCESS_COSTS[accessType];
    if (!creditsRequired) {
      throw new RecruiterAccessError('Unknown recruiter access action', 400, 'INVALID_ACCESS_TYPE');
    }

    return db.transaction(async (tx) => {
      // Serialise all unlock actions for this recruiter/candidate pair. This
      // prevents duplicate charges across retries and horizontally scaled app
      // instances, while the unique idempotency key is a final DB safeguard.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${recruiterId}, ${candidateId})`);

      const recruiterResult: any = await tx.execute(sql`
        SELECT id, is_active, kyc_status, credits_balance
        FROM recruiters
        WHERE id = ${recruiterId}
        FOR UPDATE
      `);
      const recruiter = (recruiterResult?.rows ?? recruiterResult ?? [])[0];
      if (!recruiter || recruiter.is_active !== true) {
        throw new RecruiterAccessError('Recruiter account is not active', 403, 'RECRUITER_INACTIVE');
      }
      if (recruiter.kyc_status !== 'approved') {
        throw new RecruiterAccessError('Company verification is required before unlocking candidate data', 403, 'KYC_REQUIRED');
      }

      const candidateResult: any = await tx.execute(sql`
        SELECT
          u.id,
          u.resume_url,
          EXISTS (
            SELECT 1 FROM interviews iv
            WHERE iv.user_id = u.id AND iv.status = 'completed'
          ) AS has_completed_interview
        FROM users u
        WHERE u.id = ${candidateId}
          AND u.is_admin = false
          AND u.profile_visibility = true
          AND EXISTS (
            SELECT 1 FROM certificates c
            WHERE c.user_id = u.id
              AND c.is_active = true
              AND c.is_paid = true
              AND c.expires_at > NOW()
          )
          AND (
            NOT EXISTS (
              SELECT 1 FROM cohort_students cs
              WHERE cs.status = 'active'
                AND (cs.user_id = u.id OR lower(cs.email) = lower(u.email))
            )
            OR EXISTS (
              SELECT 1 FROM cohort_students cs
              JOIN institutes i ON i.id = cs.institute_id
              WHERE cs.status = 'active'
                AND (cs.user_id = u.id OR lower(cs.email) = lower(u.email))
                AND i.status = 'verified'
                AND i.recruiter_discovery_enabled = true
            )
          )
      `);
      const candidate = (candidateResult?.rows ?? candidateResult ?? [])[0];
      if (!candidate) {
        throw new RecruiterAccessError(
          'This candidate is no longer available for recruiter discovery',
          404,
          'CANDIDATE_NOT_DISCOVERABLE',
        );
      }
      if (accessType === 'cv_download' && !String(candidate.resume_url || '').trim()) {
        throw new RecruiterAccessError('This candidate has not shared a CV', 404, 'CV_NOT_AVAILABLE');
      }
      if (accessType === 'interview_access' && candidate.has_completed_interview !== true) {
        throw new RecruiterAccessError('This candidate has no completed interview evidence', 404, 'INTERVIEW_NOT_AVAILABLE');
      }

      const idempotencyKey = `${recruiterId}:${candidateId}:${accessType}`;
      const existingResult: any = await tx.execute(sql`
        SELECT id FROM profile_access_logs
        WHERE recruiter_id = ${recruiterId}
          AND user_id = ${candidateId}
          AND access_type = ${accessType}
        LIMIT 1
      `);
      const alreadyUnlocked = (existingResult?.rows ?? existingResult ?? []).length > 0;
      if (alreadyUnlocked) {
        const responseData: any = {
          creditsUsed: 0,
          remainingCredits: Number(recruiter.credits_balance || 0).toFixed(2),
          alreadyUnlocked: true,
          message: 'Already unlocked while candidate consent remains active — no credits were charged.',
        };
        if (accessType === 'cv_download') responseData.cvUrl = `/api/recruiter/download-cv/${candidateId}`;
        return responseData;
      }

      const balanceResult: any = await tx.execute(sql`
        UPDATE recruiters
        SET credits_balance = credits_balance - ${creditsRequired}, updated_at = NOW()
        WHERE id = ${recruiterId}
          AND is_active = true
          AND credits_balance >= ${creditsRequired}
        RETURNING credits_balance
      `);
      const balanceRow = (balanceResult?.rows ?? balanceResult ?? [])[0];
      if (!balanceRow) {
        throw new RecruiterAccessError(
          `You need ${creditsRequired} ${creditsRequired === 1 ? 'credit' : 'credits'} for this unlock`,
          402,
          'INSUFFICIENT_CREDITS',
          { required: creditsRequired, available: Number(recruiter.credits_balance || 0) },
        );
      }
      const remainingCredits = Number(balanceRow.credits_balance).toFixed(2);

      await tx.insert(creditTransactions).values({
        recruiterId,
        type: 'spend',
        amount: creditsRequired.toFixed(2),
        description: `${accessType} unlock for candidate ${candidateId}`,
        relatedUserId: candidateId,
        relatedAction: accessType,
        balanceAfter: remainingCredits,
      });

      await tx.insert(profileAccessLogs).values({
        recruiterId,
        userId: candidateId,
        accessType,
        creditsUsed: creditsRequired.toFixed(2),
        idempotencyKey,
      });

      const responseData: any = {
        creditsUsed: creditsRequired,
        remainingCredits,
        alreadyUnlocked: false,
        message: `${creditsRequired} ${creditsRequired === 1 ? 'credit' : 'credits'} charged once for this workspace unlock while candidate consent remains active.`,
      };
      if (accessType === 'cv_download') responseData.cvUrl = `/api/recruiter/download-cv/${candidateId}`;
      return responseData;
    });
  }

  async getRecruiterWallet(recruiterId: number) {
    const recruiter = await this.getRecruiterById(recruiterId);
    if (!recruiter) throw new Error('Recruiter not found');

    const transactions = await db.select()
      .from(creditTransactions)
      .where(eq(creditTransactions.recruiterId, recruiterId))
      .orderBy(desc(creditTransactions.createdAt))
      .limit(20);

    return {
      balance: recruiter.creditsBalance,
      transactions,
      costs: RECRUITER_ACCESS_COSTS,
      chargingModel: 'one_time_unlock',
      rules: [
        'Search is free and only shows learner-consented profiles with current paid evidence.',
        'Each profile, CV, or interview-evidence unlock is charged once per candidate workspace while consent remains active.',
        'Opening an already unlocked item again costs 0 credits.',
      ],
    };
  }

  async purchaseCredits(recruiterId: number, amount: number, paymentId: string) {
    if (!Number.isInteger(amount) || amount <= 0 || !paymentId.trim()) {
      throw new Error('Invalid credit purchase');
    }

    return db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${recruiterId}, 0)`);

      const existingResult: any = await tx.execute(sql`
        SELECT balance_after
        FROM credit_transactions
        WHERE external_reference = ${paymentId}
           OR description = ${`Credit purchase - Payment ID: ${paymentId}`}
        LIMIT 1
      `);
      const existing = (existingResult?.rows ?? existingResult ?? [])[0];
      if (existing) {
        return {
          success: true,
          alreadyCredited: true,
          newBalance: Number(existing.balance_after).toFixed(2),
          creditsAdded: 0,
        };
      }

      const balanceResult: any = await tx.execute(sql`
        UPDATE recruiters
        SET credits_balance = credits_balance + ${amount}, updated_at = NOW()
        WHERE id = ${recruiterId} AND is_active = true
        RETURNING credits_balance
      `);
      const balance = (balanceResult?.rows ?? balanceResult ?? [])[0];
      if (!balance) throw new Error('Recruiter account is not active');
      const newBalance = Number(balance.credits_balance).toFixed(2);

      await tx.insert(creditTransactions).values({
        recruiterId,
        type: 'purchase',
        amount: amount.toFixed(2),
        description: `Credit purchase - Payment ID: ${paymentId}`,
        externalReference: paymentId,
        balanceAfter: newBalance,
      });

      return {
        success: true,
        alreadyCredited: false,
        newBalance,
        creditsAdded: amount,
      };
    });
  }

  // Rating operations
  async createRating(insertRating: InsertRating): Promise<Rating> {
    const [rating] = await db
      .insert(ratings)
      .values(insertRating)
      .returning();
    
    // Update aggregate after creating rating
    await this.updateRatingAggregate(rating.courseId);
    return rating;
  }

  async updateRating(userId: number, courseId: number, newRating: number, reviewText?: string): Promise<Rating> {
    const [rating] = await db
      .update(ratings)
      .set({ 
        rating: newRating, 
        reviewText,
        updatedAt: new Date() 
      })
      .where(and(eq(ratings.userId, userId), eq(ratings.courseId, courseId)))
      .returning();
    
    // Update aggregate after updating rating
    await this.updateRatingAggregate(courseId);
    return rating;
  }

  async getUserRating(userId: number, courseId: number): Promise<Rating | undefined> {
    const [rating] = await db
      .select()
      .from(ratings)
      .where(and(eq(ratings.userId, userId), eq(ratings.courseId, courseId)));
    return rating || undefined;
  }

  async getCourseRatings(courseId: number, limit = 10, offset = 0): Promise<any[]> {
    return await db
      .select({
        id: ratings.id,
        userId: ratings.userId,
        courseId: ratings.courseId,
        rating: ratings.rating,
        reviewText: ratings.reviewText,
        createdAt: ratings.createdAt,
        updatedAt: ratings.updatedAt,
        userName: users.name,
      })
      .from(ratings)
      .leftJoin(users, eq(ratings.userId, users.id))
      .where(eq(ratings.courseId, courseId))
      .orderBy(desc(ratings.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async getRatingAggregate(courseId: number): Promise<RatingAggregate | undefined> {
    const [aggregate] = await db
      .select()
      .from(ratingAggregates)
      .where(eq(ratingAggregates.courseId, courseId));
    return aggregate || undefined;
  }

  async updateRatingAggregate(courseId: number): Promise<void> {
    // Get all ratings for the course
    const courseRatings = await db
      .select()
      .from(ratings)
      .where(eq(ratings.courseId, courseId));

    if (courseRatings.length === 0) {
      // No ratings yet, set defaults
      await db
        .insert(ratingAggregates)
        .values({
          courseId,
          averageRating: '0.00',
          totalReviews: 0,
          rating1Count: 0,
          rating2Count: 0,
          rating3Count: 0,
          rating4Count: 0,
          rating5Count: 0,
        })
        .onConflictDoUpdate({
          target: ratingAggregates.courseId,
          set: {
            averageRating: '0.00',
            totalReviews: 0,
            rating1Count: 0,
            rating2Count: 0,
            rating3Count: 0,
            rating4Count: 0,
            rating5Count: 0,
            updatedAt: new Date(),
          },
        });
      return;
    }

    // Calculate aggregates
    const totalReviews = courseRatings.length;
    const totalScore = courseRatings.reduce((sum, r) => sum + r.rating, 0);
    const averageRating = (totalScore / totalReviews).toFixed(2);

    const ratingCounts = [0, 0, 0, 0, 0];
    courseRatings.forEach(r => {
      if (r.rating >= 1 && r.rating <= 5) {
        ratingCounts[r.rating - 1]++;
      }
    });

    // Update aggregate
    await db
      .insert(ratingAggregates)
      .values({
        courseId,
        averageRating,
        totalReviews,
        rating1Count: ratingCounts[0],
        rating2Count: ratingCounts[1],
        rating3Count: ratingCounts[2],
        rating4Count: ratingCounts[3],
        rating5Count: ratingCounts[4],
      })
      .onConflictDoUpdate({
        target: ratingAggregates.courseId,
        set: {
          averageRating,
          totalReviews,
          rating1Count: ratingCounts[0],
          rating2Count: ratingCounts[1],
          rating3Count: ratingCounts[2],
          rating4Count: ratingCounts[3],
          rating5Count: ratingCounts[4],
          updatedAt: new Date(),
        },
      });
  }

  // ===== Creator operations =====
  async createCreator(data: InsertCreator): Promise<Creator> {
    const auto = process.env.AUTO_APPROVE_PROFILES !== 'false';
    const [row] = await db.insert(creators).values({
      ...data,
      status: (data as any).status ?? (auto ? 'approved' : 'pending'),
      approvedAt: (data as any).approvedAt ?? (auto ? new Date() : null),
    } as any).returning();
    return row;
  }

  async getCreatorByUserId(userId: number): Promise<Creator | undefined> {
    const [row] = await db.select().from(creators).where(eq(creators.userId, userId));
    return row || undefined;
  }

  async getCreatorBySlug(slug: string): Promise<Creator | undefined> {
    const [row] = await db.select().from(creators).where(eq(creators.slug, slug));
    return row || undefined;
  }

  async updateCreator(id: number, data: Partial<InsertCreator>): Promise<Creator | undefined> {
    const [row] = await db
      .update(creators)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(creators.id, id))
      .returning();
    return row || undefined;
  }

  // ===== Institute operations =====
  async createInstitute(data: InsertInstitute): Promise<Institute> {
    const auto = process.env.AUTO_APPROVE_PROFILES !== 'false';
    const [row] = await db.insert(institutes).values({
      ...data,
      status: (data as any).status ?? (auto ? 'verified' : 'pending'),
    } as any).returning();
    return row;
  }

  async getInstituteBySlug(slug: string): Promise<Institute | undefined> {
    const [row] = await db.select().from(institutes).where(eq(institutes.slug, slug));
    return row || undefined;
  }

  async updateInstitute(id: number, data: Partial<InsertInstitute>): Promise<Institute | undefined> {
    const [row] = await db
      .update(institutes)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(institutes.id, id))
      .returning();
    return row || undefined;
  }

  async addInstituteMember(
    instituteId: number,
    userId: number,
    role: string = "teacher",
    status: string = "active",
  ): Promise<InstituteMember> {
    const [row] = await db
      .insert(instituteMembers)
      .values({ instituteId, userId, role, status, joinedAt: new Date() })
      .returning();
    return row;
  }

  async getInstituteMembersByUserId(
    userId: number,
  ): Promise<(InstituteMember & { institute: Institute })[]> {
    const rows = await db
      .select()
      .from(instituteMembers)
      .innerJoin(institutes, eq(instituteMembers.instituteId, institutes.id))
      .where(and(
        eq(instituteMembers.userId, userId),
        eq(instituteMembers.status, "active"),
      ));
    return rows.map((r: any) => ({ ...r.institute_members, institute: r.institutes }));
  }

  async getInstituteByUserId(
    userId: number,
  ): Promise<(Institute & { memberRole: string }) | undefined> {
    const memberships = await this.getInstituteMembersByUserId(userId);
    if (memberships.length === 0) return undefined;
    // Prefer owner > admin > teacher > staff
    const priority: Record<string, number> = { owner: 0, admin: 1, teacher: 2, staff: 3 };
    memberships.sort((a, b) => (priority[a.role] ?? 9) - (priority[b.role] ?? 9));
    const m = memberships[0];
    return { ...m.institute, memberRole: m.role };
  }

  // ===== Aggregate roles =====
  async getUserRoles(userId: number) {
    const user = await this.getUser(userId);
    const isAdmin = !!user?.isAdmin;
    const email = user?.email?.toLowerCase() || "";

    const [creatorRow] = await db.select().from(creators).where(eq(creators.userId, userId));
    const memberships = await db
      .select()
      .from(instituteMembers)
      .where(and(
        eq(instituteMembers.userId, userId),
        eq(instituteMembers.status, "active"),
      ));

    const instituteRole = memberships
      .map((membership) => membership.role)
      .filter((role): role is "owner" | "admin" | "teacher" | "staff" =>
        ["owner", "admin", "teacher", "staff"].includes(role),
      )
      .sort((a, b) => ({ owner: 0, admin: 1, teacher: 2, staff: 3 }[a] - { owner: 0, admin: 1, teacher: 2, staff: 3 }[b]))[0] ?? null;

    let isRecruiter = false;
    let isSeller = false;
    if (email) {
      const [rec] = await db.select().from(recruiters).where(eq(recruiters.email, email));
      isRecruiter = !!rec;
      const [sell] = await db.select().from(sellers).where(eq(sellers.email, email));
      isSeller = !!sell;
    }

    return {
      isLearner: true,
      isCreator: !!creatorRow,
      isInstituteMember: memberships.length > 0,
      isRecruiter,
      isSeller,
      isAdmin,
      instituteRole,
    };
  }

  // ===== P1 Question Bank Pro =====
  async createQuestionBank(data: InsertQuestionBank): Promise<QuestionBank> {
    const [row] = await db
      .insert(questionBanks)
      .values(data as typeof questionBanks.$inferInsert)
      .returning();
    return row;
  }

  async getQuestionBank(id: number): Promise<QuestionBank | undefined> {
    const [row] = await db.select().from(questionBanks).where(eq(questionBanks.id, id));
    return row || undefined;
  }

  async getQuestionBankBySlug(ownerType: string, ownerId: number | null, slug: string): Promise<QuestionBank | undefined> {
    const conds = [eq(questionBanks.ownerType, ownerType), eq(questionBanks.slug, slug)];
    const ownerIdCond = ownerId === null
      ? sql`${questionBanks.ownerId} is null`
      : eq(questionBanks.ownerId, ownerId);
    const [row] = await db.select().from(questionBanks).where(and(...conds, ownerIdCond));
    return row || undefined;
  }

  async listQuestionBanks(filter: { ownerType?: string; ownerId?: number | null; visibility?: string; userId?: number; search?: string }): Promise<QuestionBank[]> {
    const where: any[] = [];
    if (filter.ownerType) where.push(eq(questionBanks.ownerType, filter.ownerType));
    if (filter.ownerId !== undefined) {
      where.push(filter.ownerId === null
        ? sql`${questionBanks.ownerId} is null`
        : eq(questionBanks.ownerId, filter.ownerId));
    }
    if (filter.visibility) where.push(eq(questionBanks.visibility, filter.visibility));
    if (filter.search) where.push(ilike(questionBanks.name, `%${filter.search}%`));
    const q = db.select().from(questionBanks);
    const rows = where.length ? await q.where(and(...where)).orderBy(desc(questionBanks.updatedAt)) : await q.orderBy(desc(questionBanks.updatedAt));
    return rows;
  }

  async updateQuestionBank(id: number, data: Partial<InsertQuestionBank>): Promise<QuestionBank | undefined> {
    return db.transaction(async (tx) => {
      const [existing] = await tx.select().from(questionBanks)
        .where(eq(questionBanks.id, id))
        .for("update");
      if (!existing) return undefined;

      if (data.bankPurpose && data.bankPurpose !== existing.bankPurpose) {
        const [{ blueprintUses }] = await tx.select({ blueprintUses: count() })
          .from(courseQuestionBlueprint)
          .where(eq(courseQuestionBlueprint.bankId, id));
        if (Number(blueprintUses) > 0) {
          throw Object.assign(
            new Error("Remove this bank from every assessment blueprint before changing its purpose."),
            { code: "QUESTION_BANK_PURPOSE_IN_USE" },
          );
        }
      }

      const [row] = await tx
        .update(questionBanks)
        .set({
          ...(data as Partial<typeof questionBanks.$inferInsert>),
          updatedAt: new Date(),
        })
        .where(eq(questionBanks.id, id))
        .returning();
      if (data.status && data.status !== "active") {
        await unpublishPublishedAssessmentsUsingBanks(tx, [id]);
      }
      return row || undefined;
    });
  }

  async deleteQuestionBank(id: number): Promise<void> {
    await db.transaction(async (tx) => {
      // Detach questions before deleting topics/bank to avoid FK deadlocks/failures.
      await tx
        .update(questions)
        .set({ bankId: null, topicId: null, updatedAt: new Date() })
        .where(eq(questions.bankId, id));

      await tx.delete(questionTopics).where(eq(questionTopics.bankId, id));
      await tx.delete(questionBanks).where(eq(questionBanks.id, id));
    });
  }

  async createQuestionTopic(data: InsertQuestionTopic): Promise<QuestionTopic> {
    const [row] = await db.insert(questionTopics).values(data).returning();
    return row;
  }

  async listQuestionTopics(bankId: number): Promise<QuestionTopic[]> {
    return db.select().from(questionTopics).where(eq(questionTopics.bankId, bankId)).orderBy(asc(questionTopics.sortOrder), asc(questionTopics.id));
  }

  async updateQuestionTopic(id: number, data: Partial<InsertQuestionTopic>): Promise<QuestionTopic | undefined> {
    const [row] = await db.update(questionTopics).set({ ...data, updatedAt: new Date() }).where(eq(questionTopics.id, id)).returning();
    return row || undefined;
  }

  async deleteQuestionTopic(id: number): Promise<void> {
    await db.transaction(async (tx) => {
      await tx
        .update(questions)
        .set({ topicId: null, updatedAt: new Date() })
        .where(eq(questions.topicId, id));
      await tx.delete(questionTopics).where(eq(questionTopics.id, id));
    });
  }

  async createQuestionInBank(data: any): Promise<Question> {
    const insertVals: any = {
      courseId: data.courseId ?? null,
      bankId: data.bankId,
      topicId: data.topicId ?? null,
      question: data.question,
      options: data.options ?? [],
      correctAnswer: typeof data.correctAnswer === "number" ? data.correctAnswer : 0,
      questionType: data.questionType ?? "multiple_choice",
      questionFormat: data.questionFormat ?? "mcq_single",
      difficulty: data.difficulty ?? "medium",
      maxPoints: data.maxPoints ?? 1,
      negativeMarks: data.negativeMarks ?? 0,
      timeLimitSec: data.timeLimitSec ?? null,
      imageUrl: data.imageUrl ?? null,
      codeLanguage: data.codeLanguage ?? null,
      expectedAnswer: data.expectedAnswer ?? null,
      tags: data.tags ?? [],
      explanation: data.explanation ?? null,
      reviewStatus: data.reviewStatus ?? "draft",
      generationSource: data.generationSource ?? "human",
      reviewedBy: data.reviewedBy ?? null,
      reviewedAt: data.reviewedAt ?? null,
      version: 1,
      createdBy: data.createdBy ?? null,
      isActive: data.isActive ?? false,
    };
    const [row] = await db.insert(questions).values(insertVals).returning();
    await db.update(questionBanks)
      .set({ questionCount: sql`${questionBanks.questionCount} + 1`, updatedAt: new Date() })
      .where(eq(questionBanks.id, data.bankId));
    return row;
  }

  async updateQuestionWithVersioning(id: number, data: Record<string, unknown>, changedBy?: number, changeNote?: string, expectedVersion?: number): Promise<Question | undefined> {
    return db.transaction(async (tx) => {
      const [existing] = await tx.select().from(questions)
        .where(eq(questions.id, id))
        .for("update");
      if (!existing) return undefined;
      if (expectedVersion !== undefined && existing.version !== expectedVersion) return undefined;

      await tx.insert(questionVersions).values({
        questionId: id,
        version: existing.version ?? 1,
        snapshot: existing as unknown as Record<string, unknown>,
        changeNote: changeNote ?? null,
        changedBy: changedBy ?? null,
      });
      const nextVersion = (existing.version ?? 1) + 1;
      const [row] = await tx.update(questions)
        .set({ ...data, version: nextVersion, updatedAt: new Date() } as any)
        .where(eq(questions.id, id))
        .returning();
      if (
        existing.bankId
        && isPublishableAssessmentQuestion(existing)
        && row
        && !isPublishableAssessmentQuestion(row)
      ) {
        await unpublishPublishedAssessmentsUsingBanks(tx, [existing.bankId]);
      }
      return row || undefined;
    });
  }

  async deleteBankQuestion(id: number, retiredBy?: number): Promise<void> {
    await db.transaction(async (tx) => {
      const [existing] = await tx.select().from(questions)
        .where(eq(questions.id, id))
        .for("update");
      if (!existing) return;

      const [lineage] = await tx.select({ id: questionProvenance.id })
        .from(questionProvenance)
        .where(eq(questionProvenance.questionId, id))
        .limit(1);

      if (lineage) {
        // Imported lineage is an audit record. A UI "delete" therefore retires
        // the question instead of violating (or bypassing) the provenance FK.
        if (existing.reviewStatus !== "retired") {
          await tx.insert(questionVersions).values({
            questionId: id,
            version: existing.version ?? 1,
            snapshot: existing as unknown as Record<string, unknown>,
            changeNote: "Retired; imported provenance retained",
            changedBy: retiredBy ?? null,
          });
          await tx.update(questions).set({
            reviewStatus: "retired",
            isActive: false,
            version: (existing.version ?? 1) + 1,
            updatedAt: new Date(),
          }).where(eq(questions.id, id));
        }
      } else {
        await tx.delete(questions).where(eq(questions.id, id));
      }

      if (existing.bankId && existing.reviewStatus !== "retired") {
        await tx.update(questionBanks)
          .set({ questionCount: sql`GREATEST(${questionBanks.questionCount} - 1, 0)`, updatedAt: new Date() })
          .where(eq(questionBanks.id, existing.bankId));
      }
      if (existing.bankId && isPublishableAssessmentQuestion(existing)) {
        await unpublishPublishedAssessmentsUsingBanks(tx, [existing.bankId]);
      }
    });
  }

  async bulkCreateQuestions(bankId: number, rows: Array<Record<string, any>>, createdBy?: number): Promise<{ created: number; errors: Array<{ row: number; message: string }> }> {
    const errors: Array<{ row: number; message: string }> = [];
    let created = 0;
    // cache topics by name
    const topicCache = new Map<string, number>();
    const existing = await this.listQuestionTopics(bankId);
    for (const t of existing) topicCache.set(t.name.toLowerCase(), t.id);

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      try {
        let topicId: number | null = null;
        const topicName = (r.topic ?? "").toString().trim();
        if (topicName) {
          const key = topicName.toLowerCase();
          if (!topicCache.has(key)) {
            const slug = topicName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `topic-${Date.now()}`;
            const t = await this.createQuestionTopic({ bankId, name: topicName, slug, sortOrder: 0, parentId: null } as any);
            topicCache.set(key, t.id);
          }
          topicId = topicCache.get(key)!;
        }
        await this.createQuestionInBank({
          ...r,
          bankId,
          topicId,
          createdBy: createdBy ?? null,
        });
        created++;
      } catch (e: any) {
        errors.push({ row: i + 1, message: e?.message || "Insert failed" });
      }
    }
    return { created, errors };
  }

  async listQuestionsByBank(bankId: number, opts: { topicId?: number; format?: string; difficulty?: string; reviewStatus?: string; search?: string; page?: number; perPage?: number }): Promise<{ items: Question[]; total: number; page: number; perPage: number }> {
    const page = Math.max(1, opts.page ?? 1);
    const perPage = Math.min(200, Math.max(1, opts.perPage ?? 25));
    const where: any[] = [
      eq(questions.bankId, bankId),
    ];
    if (opts.topicId) where.push(eq(questions.topicId, opts.topicId));
    if (opts.format) where.push(eq(questions.questionFormat, opts.format));
    if (opts.difficulty) where.push(eq(questions.difficulty, opts.difficulty));
    if (opts.reviewStatus) where.push(eq(questions.reviewStatus, opts.reviewStatus));
    if (opts.search) where.push(ilike(questions.question, `%${opts.search}%`));
    const condition = and(...where);
    const items = await db.select().from(questions).where(condition).orderBy(desc(questions.id)).limit(perPage).offset((page - 1) * perPage);
    const [{ c }] = await db.select({ c: count() }).from(questions).where(condition);
    return { items, total: Number(c), page, perPage };
  }

  async getQuestionVersions(questionId: number): Promise<QuestionVersion[]> {
    return db.select().from(questionVersions).where(eq(questionVersions.questionId, questionId)).orderBy(desc(questionVersions.version));
  }

  async getCourseBlueprint(courseId: number): Promise<CourseBlueprintItem[]> {
    return db.select().from(courseQuestionBlueprint).where(eq(courseQuestionBlueprint.courseId, courseId)).orderBy(asc(courseQuestionBlueprint.sortOrder), asc(courseQuestionBlueprint.id));
  }

  async setCourseBlueprint(
    courseId: number,
    items: Array<Omit<InsertCourseBlueprintItem, "courseId">>,
    changedBy?: number,
    changeNote?: string,
  ): Promise<CourseBlueprintItem[]> {
    return db.transaction(async (tx) => {
      const lockedBanks = new Map<number, {
        id: number;
        status: string;
        bankPurpose: string;
      }>();
      for (const bankId of Array.from(new Set(items.map((item) => item.bankId))).sort((left, right) => left - right)) {
        const [bank] = await tx.select({
          id: questionBanks.id,
          status: questionBanks.status,
          bankPurpose: questionBanks.bankPurpose,
        }).from(questionBanks)
          .where(eq(questionBanks.id, bankId))
          .for("share");
        if (!bank) throw new Error(`Question bank ${bankId} does not exist`);
        lockedBanks.set(bankId, bank);
      }
      await tx.execute(sql`SELECT pg_advisory_xact_lock(7310, ${courseId})`);
      const [lockedCourse] = await tx.select({
        id: courses.id,
        ownerType: courses.ownerType,
        productType: courses.productType,
        assessmentPurpose: courses.assessmentPurpose,
        visibility: courses.visibility,
        reviewStatus: courses.reviewStatus,
        isActive: courses.isActive,
      }).from(courses)
        .where(eq(courses.id, courseId))
        .for("update");
      if (!lockedCourse) throw new Error("Course does not exist");
      if (lockedCourse.productType !== "assessment") {
        throw new Error("Question-bank blueprints can only be assigned to assessments");
      }
      if (isPublishedAssessment(lockedCourse)) {
        throw new Error(
          "Unpublish this assessment before changing its question blueprint, then publish it again after readiness is rechecked",
        );
      }

      const normalized = items.map((item, index) => ({
        ...item,
        topicId: item.topicId ?? null,
        difficulty: item.difficulty ?? "mixed",
        marksPerQuestion: item.marksPerQuestion ?? 1,
        negativeMarks: item.negativeMarks ?? 0,
        sortOrder: item.sortOrder ?? index,
      }));
      const ruleKeys = new Set<string>();
      const scopes = new Map<string, Set<string>>();

      for (const item of normalized) {
        const bank = lockedBanks.get(item.bankId);
        if (!bank) throw new Error(`Question bank ${item.bankId} does not exist`);
        if (bank.status === "archived") throw new Error(`Question bank ${item.bankId} is archived and cannot be assigned`);
        if (bank.bankPurpose !== lockedCourse.assessmentPurpose) {
          throw new Error(
            `${bank.bankPurpose === "practice" ? "Practice" : "Certification"} bank ${item.bankId} cannot be assigned to a ${lockedCourse.assessmentPurpose} assessment`,
          );
        }

        if (item.topicId) {
          const [topic] = await tx.select({ id: questionTopics.id })
            .from(questionTopics)
            .where(and(eq(questionTopics.id, item.topicId), eq(questionTopics.bankId, item.bankId)));
          if (!topic) throw new Error(`Topic ${item.topicId} does not belong to question bank ${item.bankId}`);
        }

        const scope = `${item.bankId}:${item.topicId ?? "all"}`;
        const ruleKey = `${scope}:${item.difficulty}`;
        if (ruleKeys.has(ruleKey)) throw new Error("Combine duplicate bank, topic and difficulty rules into one row");
        ruleKeys.add(ruleKey);
        const difficulties = scopes.get(scope) ?? new Set<string>();
        difficulties.add(item.difficulty);
        scopes.set(scope, difficulties);
        if (difficulties.has("mixed") && difficulties.size > 1) {
          throw new Error("A mixed rule cannot overlap difficulty-specific rules for the same bank and topic");
        }

        const inventoryFilters = [
          eq(questions.bankId, item.bankId),
          eq(questions.isActive, true),
          eq(questions.reviewStatus, "approved"),
          isNotNull(questions.reviewedBy),
          isNotNull(questions.reviewedAt),
          sql`${questions.questionFormat} IN ('mcq_single', 'true_false')`,
          sql`json_typeof(${questions.options}) = 'array'`,
          sql`${questions.correctAnswer} >= 0`,
          sql`${questions.correctAnswer} < json_array_length(${questions.options})`,
        ];
        if (item.topicId) inventoryFilters.push(eq(questions.topicId, item.topicId));
        if (item.difficulty !== "mixed") inventoryFilters.push(eq(questions.difficulty, item.difficulty));
        const [{ available }] = await tx.select({ available: count() })
          .from(questions)
          .where(and(...inventoryFilters));
        if (Number(available) < item.questionCount) {
          throw new Error(
            `Pool ${item.bankId}${item.topicId ? ` / topic ${item.topicId}` : ""} has ${Number(available)} approved ${item.difficulty} questions; ${item.questionCount} requested`,
          );
        }
      }

      await tx.delete(courseQuestionBlueprint).where(eq(courseQuestionBlueprint.courseId, courseId));
      const inserted = normalized.length
        ? await tx.insert(courseQuestionBlueprint)
          .values(normalized.map((item) => ({ ...item, courseId })) as any)
          .returning()
        : [];
      const [revisionRow] = await tx.select({
        revision: sql<number>`COALESCE(MAX(${courseQuestionBlueprintVersions.revision}), 0) + 1`,
      }).from(courseQuestionBlueprintVersions).where(eq(courseQuestionBlueprintVersions.courseId, courseId));
      await tx.insert(courseQuestionBlueprintVersions).values({
        courseId,
        revision: Number(revisionRow?.revision || 1),
        items: inserted.map((item) => ({
          bankId: item.bankId,
          topicId: item.topicId,
          questionCount: item.questionCount,
          difficulty: item.difficulty,
          marksPerQuestion: item.marksPerQuestion,
          negativeMarks: item.negativeMarks,
          sortOrder: item.sortOrder,
        })),
        changeNote: changeNote?.trim() || null,
        changedBy: changedBy ?? null,
      });
      // Every blueprint revision changes the exact pool being approved,
      // including first-party assessments. Invalidate the course decision in
      // the same transaction as the immutable revision so an earlier approval
      // can never be reused for a different blueprint.
      await tx.update(courses).set({
        isActive: false,
        reviewStatus: "pending",
        subscriptionEligible: false,
        resellerEligible: false,
      }).where(eq(courses.id, courseId));
      return inserted;
    });
  }

  async materializeBlueprintForAttempt(courseId: number): Promise<Question[]> {
    const items = await this.getCourseBlueprint(courseId);
    if (!items.length) throw new Error("Course has no blueprint configured");
    const result: Question[] = [];
    const selectedIds: number[] = [];
    for (const item of items) {
      const where: any[] = [
        eq(questions.bankId, item.bankId),
        eq(questions.isActive, true),
        eq(questions.reviewStatus, "approved"),
        isNotNull(questions.reviewedBy),
        isNotNull(questions.reviewedAt),
        sql`${questions.questionFormat} IN ('mcq_single', 'true_false')`,
        sql`json_typeof(${questions.options}) = 'array'`,
        sql`${questions.correctAnswer} >= 0`,
        sql`${questions.correctAnswer} < json_array_length(${questions.options})`,
      ];
      if (item.topicId) where.push(eq(questions.topicId, item.topicId));
      if (item.difficulty && item.difficulty !== "mixed") {
        where.push(eq(questions.difficulty, item.difficulty));
      }
      if (selectedIds.length) where.push(notInArray(questions.id, selectedIds));
      const pool = await db.select().from(questions)
        .where(and(...where))
        .orderBy(sql`random()`)
        .limit(item.questionCount);
      if (pool.length < item.questionCount) {
        throw new Error(`Question pool ${item.bankId}${item.topicId ? ` / topic ${item.topicId}` : ""} has only ${pool.length} unused ${item.difficulty} questions; blueprint requires ${item.questionCount}`);
      }
      result.push(...pool);
      selectedIds.push(...pool.map((question) => question.id));
    }
    return result;
  }
}

export const storage = new DatabaseStorage();
