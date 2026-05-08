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
import { eq, and, desc, count, sql, or, asc, ilike, gte, lte } from "drizzle-orm";

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
  getUserCertificates(userId: number): Promise<Certificate[]>;
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
      .set(updates)
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
    return await db.select().from(categories);
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
        courseCount: sql<number>`count(${courses.id})::int`
      })
      .from(categories)
      .leftJoin(courses, eq(categories.id, courses.categoryId))
      .groupBy(categories.id, categories.name, categories.description, categories.slug, categories.icon)
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
        originalPrice: courses.originalPrice,
        isOnSale: courses.isOnSale,
        saleEndDate: courses.saleEndDate,
        level: courses.level,
        isActive: courses.isActive,
        isInternship: courses.isInternship,
        metaTitle: courses.metaTitle,
        metaDescription: courses.metaDescription,
        createdAt: courses.createdAt,
        category: {
          id: categories.id,
          name: categories.name,
          description: categories.description,
          icon: categories.icon,
          slug: categories.slug,
        }
      })
      .from(courses)
      .innerJoin(categories, eq(courses.categoryId, categories.id))
      .where(categoryId ? eq(courses.categoryId, categoryId) : undefined);

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
        originalPrice: courses.originalPrice,
        isOnSale: courses.isOnSale,
        saleEndDate: courses.saleEndDate,
        level: courses.level,
        isActive: courses.isActive,
        isInternship: courses.isInternship,
        metaTitle: courses.metaTitle,
        metaDescription: courses.metaDescription,
        createdAt: courses.createdAt,
        category: {
          id: categories.id,
          name: categories.name,
          description: categories.description,
          icon: categories.icon,
          slug: categories.slug,
        }
      })
      .from(courses)
      .innerJoin(categories, eq(courses.categoryId, categories.id))
      .where(eq(courses.slug, slug));

    const [result] = await query;
    return result || undefined;
  }



  // Question operations
  async getQuestionsByCourse(courseId: number): Promise<Question[]> {
    return await db
      .select()
      .from(questions)
      .where(and(eq(questions.courseId, courseId), eq(questions.isActive, true)));
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

  async getUserCertificates(userId: number): Promise<Certificate[]> {
    return await db
      .select()
      .from(certificates)
      .where(eq(certificates.userId, userId))
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
        userName: certificates.userName,
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
      name: cert.userName,
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
    let query = db.select().from(contactSubmissions);
    
    if (search) {
      query = query.where(
        or(
          ilike(contactSubmissions.name, `%${search}%`),
          ilike(contactSubmissions.email, `%${search}%`),
          ilike(contactSubmissions.subject, `%${search}%`),
          ilike(contactSubmissions.message, `%${search}%`)
        )
      );
    }
    
    return await query.orderBy(desc(contactSubmissions.submittedAt));
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
  async getQuestionsForAdmin(courseId?: number, search?: string): Promise<any[]> {
    try {
      console.log('getQuestionsForAdmin called with:', { courseId, search });
      
      // Build SQL query dynamically - this approach works for filtered queries
      let baseQuery = `
        SELECT 
          q.id, 
          q.question, 
          q.course_id as "courseId", 
          q.options, 
          q.correct_answer as "correctAnswer",
          q.difficulty,
          q.is_active as "isActive",
          json_build_object('title', c.title) as course
        FROM questions q 
        LEFT JOIN courses c ON q.course_id = c.id
      `;
      
      const whereConditions = [];
      const queryParams = [];
      
      if (courseId) {
        whereConditions.push(`q.course_id = $${queryParams.length + 1}`);
        queryParams.push(courseId);
      }
      
      if (search) {
        whereConditions.push(`q.question ILIKE $${queryParams.length + 1}`);
        queryParams.push(`%${search}%`);
      }
      
      if (whereConditions.length > 0) {
        baseQuery += ` WHERE ${whereConditions.join(' AND ')}`;
      }
      
      baseQuery += ` ORDER BY q.id DESC LIMIT 50`;
      
      console.log('Executing SQL:', baseQuery);
      console.log('With parameters:', queryParams);
      
      const result = await db.execute(sql.raw(baseQuery, queryParams));
      console.log('SQL result rows:', result.rows.length);
      
      return result.rows;
    } catch (error) {
      console.error('Error in getQuestionsForAdmin:', error);
      throw error;
    }
  }

  async updateQuestion(id: number, updates: Partial<InsertQuestion>): Promise<Question | undefined> {
    try {
      const [question] = await db
        .update(questions)
        .set(updates)
        .where(eq(questions.id, id))
        .returning();
      return question || undefined;
    } catch (error) {
      console.error('Error updating question:', error);
      throw error;
    }
  }

  async deleteQuestion(id: number): Promise<boolean> {
    const result = await db
      .delete(questions)
      .where(eq(questions.id, id));
    return result.rowCount > 0;
  }

  // Interview question management for admin
  async getInterviewQuestionsForAdmin(technology?: string, search?: string): Promise<any[]> {
    let query = db.select().from(interviewQuestions);

    if (technology) {
      query = query.where(eq(interviewQuestions.technology, technology));
    }

    if (search) {
      query = query.where(
        or(
          ilike(interviewQuestions.title, `%${search}%`),
          ilike(interviewQuestions.question, `%${search}%`),
          ilike(interviewQuestions.technology, `%${search}%`)
        )
      );
    }

    return await query.orderBy(desc(interviewQuestions.createdAt));
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
    return result.rowCount > 0;
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
        paymentResponse: JSON.stringify(paymentResponse),
        updatedAt: new Date()
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
      isPaid: data.isPaid || false,
      amount: data.amount || 0,
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

  // Interview methods
  async createInterview(data: any): Promise<any> {
    const [interview] = await db.insert(interviews).values({
      userId: data.userId,
      technology: data.technology,
      status: data.status || 'available',
      paymentId: data.paymentId,
      title: data.title,
      isPaid: data.isPaid || false,
      amount: data.amount || 0,
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
      .values(preferences)
      .returning();
    return prefs;
  }

  async updateUserPreferences(userId: number, preferences: Partial<InsertUserPreferences>): Promise<UserPreferences> {
    const [prefs] = await db
      .update(userPreferences)
      .set({ ...preferences, updatedAt: new Date() })
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
      .values(notification)
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
      .values(recommendation)
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
      .values(activity)
      .returning();
    return act;
  }

  async getUserActivity(userId: number, activityType?: string): Promise<UserActivity[]> {
    const query = db
      .select()
      .from(userActivity)
      .where(eq(userActivity.userId, userId))
      .orderBy(desc(userActivity.createdAt));

    if (activityType) {
      return await query.where(and(
        eq(userActivity.userId, userId),
        eq(userActivity.activityType, activityType)
      ));
    }

    return await query;
  }

  // Course progress operations
  async getUserCourseProgress(userId: number, courseId?: number): Promise<UserCourseProgress[]> {
    let query = db.select().from(userCourseProgress).where(eq(userCourseProgress.userId, userId));
    
    if (courseId) {
      query = query.where(and(
        eq(userCourseProgress.userId, userId),
        eq(userCourseProgress.courseId, courseId)
      ));
    }
    
    return await query.orderBy(desc(userCourseProgress.updatedAt));
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
    let query = db.select().from(achievements).where(eq(achievements.isActive, true));
    
    if (category) {
      query = query.where(and(
        eq(achievements.isActive, true),
        eq(achievements.category, category)
      ));
    }
    
    return await query.orderBy(achievements.tier, achievements.points);
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
        .leftJoin(achievements, eq(userAchievements.achievementId, achievements.id))
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
    let query = db
      .select()
      .from(learningPaths)
      .leftJoin(categories, eq(learningPaths.categoryId, categories.id))
      .where(eq(learningPaths.isActive, true));

    if (filters?.categoryId) {
      query = query.where(eq(learningPaths.categoryId, filters.categoryId));
    }
    
    if (filters?.difficulty) {
      query = query.where(eq(learningPaths.difficulty, filters.difficulty));
    }

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
      throw new Error('User is already enrolled in this learning path');
    }

    const [result] = await db
      .insert(userLearningPaths)
      .values(enrollment)
      .returning();
    return result;
  }

  async updateLearningPathProgress(userId: number, learningPathId: number, updates: Partial<InsertUserLearningPath>): Promise<UserLearningPath> {
    const [result] = await db
      .update(userLearningPaths)
      .set({ ...updates, updatedAt: new Date() })
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
      .values(assessment)
      .returning();
    return result;
  }

  async getUserSkillAssessments(userId: number, categoryId?: number): Promise<SkillAssessment[]> {
    let query = db
      .select()
      .from(skillAssessments)
      .where(eq(skillAssessments.userId, userId));

    if (categoryId) {
      query = query.where(eq(skillAssessments.categoryId, categoryId));
    }

    return await query.orderBy(desc(skillAssessments.createdAt));
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
      originalPrice: courses.originalPrice,
      isOnSale: courses.isOnSale,
      level: courses.level,
      isActive: courses.isActive,
      isInternship: courses.isInternship,
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
      conversionRate: seller.clickCount > 0 ? ((Number(seller.conversionCount) / Number(seller.clickCount)) * 100).toFixed(2) : '0.00'
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
    .orderBy(desc(withdrawalRequests.requestedAt));
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

  async deleteCourse(courseId: number) {
    // First delete related data
    await db.delete(questions).where(eq(questions.courseId, courseId));
    await db.delete(examAttempts).where(eq(examAttempts.courseId, courseId));
    
    // Then delete the course
    const [course] = await db.delete(courses)
      .where(eq(courses.id, courseId))
      .returning();
    return course;
  }

  async getCourseQuestions(courseId: number) {
    return await db.select().from(questions).where(eq(questions.courseId, courseId));
  }

  async createQuestion(questionData: any) {
    try {
      console.log('Creating question with data:', questionData);
      const [question] = await db.insert(questions).values(questionData).returning();
      console.log('Question created:', question);
      return question;
    } catch (error) {
      console.error('Error creating question:', error);
      throw error;
    }
  }

  async updateQuestion(questionId: number, questionData: any) {
    const [question] = await db.update(questions)
      .set(questionData)
      .where(eq(questions.id, questionId))
      .returning();
    return question;
  }

  async deleteQuestion(questionId: number) {
    const [question] = await db.delete(questions)
      .where(eq(questions.id, questionId))
      .returning();
    return question;
  }

  // Get all exam attempts for admin with search and limit
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
      courseTitle: courses.title,
      passed: sql`CASE WHEN ${examAttempts.score} >= ${courses.passingScore} THEN true ELSE false END`.as('passed')
    })
    .from(examAttempts)
    .leftJoin(courses, eq(examAttempts.courseId, courses.id));

    if (search) {
      query = query.where(
        or(
          ilike(examAttempts.userName, `%${search}%`),
          ilike(examAttempts.userEmail, `%${search}%`),
          ilike(courses.title, `%${search}%`),
          eq(examAttempts.id, isNaN(parseInt(search)) ? -1 : parseInt(search)),
          eq(examAttempts.userId, isNaN(parseInt(search)) ? -1 : parseInt(search))
        )
      );
    }

    return await query
      .orderBy(desc(examAttempts.createdAt))
      .limit(limit);
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
    .leftJoin(categories, eq(courses.categoryId, categories.id));

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
    .from(payments);

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
      gatewayTransactionId: transaction.payumoney_txnid || transaction.razorpayPaymentId,
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
    .from(sellers);

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
    .from(examAttempts);

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

  // Get questions for a course (admin)
  async getQuestionsForAdmin(courseId: number) {
    return await db.select()
      .from(questions)
      .where(eq(questions.courseId, courseId))
      .orderBy(asc(questions.id));
  }

  // Create course (admin)
  async createCourseAdmin(courseData: InsertCourse) {
    const [course] = await db.insert(courses).values(courseData).returning();
    return course;
  }

  // Update course (admin)
  async updateCourseAdmin(id: number, updates: Partial<InsertCourse>) {
    const [course] = await db.update(courses)
      .set(updates)
      .where(eq(courses.id, id))
      .returning();
    return course;
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
    const [question] = await db.insert(questions).values(questionData).returning();
    return question;
  }

  // Update question (admin)
  async updateQuestionAdmin(id: number, updates: Partial<InsertQuestion>) {
    const [question] = await db.update(questions)
      .set(updates)
      .where(eq(questions.id, id))
      .returning();
    return question;
  }

  // Delete question (admin)
  async deleteQuestionAdmin(id: number) {
    await db.delete(questions).where(eq(questions.id, id));
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
    const [recruiter] = await db.insert(recruiters).values(data).returning();
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
        credits: newCredits,
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

  async searchCandidates(filters: any = {}, page: number = 1, limit: number = 10) {
    try {
      console.log('Search filters received:', filters);
      
      // Simple approach: get all users first 
      const offset = (page - 1) * limit;
      
      // Get all users with basic pagination, no complex filtering for now
      const allCandidates = await db.select().from(users)
        .limit(limit)
        .offset(offset);

      // Get additional details for each candidate
      const candidatesWithDetails = await Promise.all(
        allCandidates.map(async (candidate) => {
          // Get certificates
          const certs = await db.select({
            id: certificates.id,
            courseTitle: certificates.courseTitle,
            score: certificates.score,
            badge: certificates.badge
          })
          .from(certificates)
          .where(eq(certificates.userId, candidate.id))
          .limit(3);

          // Get interviews
          const userInterviews = await db.select({
            id: interviews.id,
            technology: interviews.technology,
            score: interviews.score,
            grade: interviews.grade
          })
          .from(interviews)
          .where(eq(interviews.userId, candidate.id))
          .limit(3);

          return {
            ...candidate,
            certificates: certs,
            interviews: userInterviews,
            profileViews: 0
          };
        })
      );

      // Get total count
      const totalResult = await db.select({ count: sql`count(*)` }).from(users);
      const total = Number(totalResult[0]?.count) || 0;

      console.log('Search completed, returning:', candidatesWithDetails.length, 'candidates');
      console.log('Candidate IDs found:', candidatesWithDetails.map(c => c.id));

      return {
        candidates: candidatesWithDetails,
        total,
        page,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      console.error('Search error:', error);
      return {
        candidates: [],
        total: 0,
        page,
        totalPages: 0
      };
    }
  }

  async getCandidateProfile(candidateId: number) {
    try {
      console.log('Getting candidate profile for ID:', candidateId);
      
      // Get basic user information with simple select
      const candidate = await db.select().from(users).where(eq(users.id, candidateId));

      if (!candidate || candidate.length === 0) {
        console.log('Candidate not found');
        return null;
      }

      const candidateData = candidate[0];
      console.log('Found candidate:', candidateData.name);

      // Get certificates with simple select
      const certs = await db.select().from(certificates)
        .where(eq(certificates.userId, candidateId));

      console.log('Found certificates:', certs.length);

      // Get interviews with simple select
      const userInterviews = await db.select().from(interviews)
        .where(eq(interviews.userId, candidateId));

      console.log('Found interviews:', userInterviews.length);

      return {
        ...candidateData,
        certificates: certs,
        interviews: userInterviews,
        profileViews: 0
      };
    } catch (error) {
      console.error('Candidate profile error:', error);
      return null;
    }
  }

  async processProfileAccess(recruiterId: number, candidateId: number, accessType: string, creditsRequired: number) {
    const recruiter = await this.getRecruiterById(recruiterId);
    if (!recruiter) throw new Error('Recruiter not found');

    const currentBalance = parseFloat(recruiter.creditsBalance);
    const newBalance = currentBalance - creditsRequired;

    await db.update(recruiters)
      .set({ 
        creditsBalance: newBalance.toFixed(2),
        updatedAt: new Date()
      })
      .where(eq(recruiters.id, recruiterId));

    await db.insert(creditTransactions).values({
      recruiterId,
      type: 'spend',
      amount: creditsRequired.toString(),
      description: `${accessType} access for candidate`,
      relatedUserId: candidateId,
      relatedAction: accessType,
      balanceAfter: newBalance.toFixed(2)
    });

    await db.insert(profileAccessLogs).values({
      recruiterId,
      userId: candidateId,
      accessType,
      creditsUsed: creditsRequired.toString()
    });

    let responseData: any = {
      creditsUsed: creditsRequired,
      remainingCredits: newBalance.toFixed(2)
    };

    if (accessType === 'cv_download') {
      responseData.cvUrl = `/api/recruiter/download-cv/${candidateId}`;
    } else if (accessType === 'interview_access') {
      const interviewData = await db.select()
        .from(interviews)
        .where(eq(interviews.userId, candidateId));
      responseData.interviewData = interviewData;
    }

    return responseData;
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
      transactions
    };
  }

  async purchaseCredits(recruiterId: number, amount: number, paymentId: string) {
    const recruiter = await this.getRecruiterById(recruiterId);
    if (!recruiter) throw new Error('Recruiter not found');

    const currentBalance = parseFloat(recruiter.creditsBalance);
    const newBalance = currentBalance + amount;

    await db.update(recruiters)
      .set({ 
        creditsBalance: newBalance.toFixed(2),
        updatedAt: new Date()
      })
      .where(eq(recruiters.id, recruiterId));

    await db.insert(creditTransactions).values({
      recruiterId,
      type: 'purchase',
      amount: amount.toString(),
      description: `Credit purchase - Payment ID: ${paymentId}`,
      balanceAfter: newBalance.toFixed(2)
    });

    return {
      success: true,
      newBalance: newBalance.toFixed(2),
      creditsAdded: amount
    };
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
}

export const storage = new DatabaseStorage();
