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
  referralClicks
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, count, sql } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // User address operations
  getUserAddresses(userId: number): Promise<UserAddress[]>;
  createUserAddress(address: InsertUserAddress): Promise<UserAddress>;
  updateUserAddress(id: number, updates: Partial<InsertUserAddress>): Promise<UserAddress>;
  deleteUserAddress(id: number): Promise<void>;
  setDefaultAddress(userId: number, addressId: number): Promise<void>;

  // Category operations
  getCategories(): Promise<Category[]>;
  createCategory(category: InsertCategory): Promise<Category>;

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

  async createCourse(insertCourse: InsertCourse): Promise<Course> {
    const [course] = await db
      .insert(courses)
      .values(insertCourse)
      .returning();
    return course;
  }

  async updateCourse(id: number, updates: Partial<InsertCourse>): Promise<Course> {
    const [course] = await db
      .update(courses)
      .set(updates)
      .where(eq(courses.id, id))
      .returning();
    return course;
  }

  async deleteCourse(id: number): Promise<void> {
    await db.delete(courses).where(eq(courses.id, id));
  }

  // Question operations
  async getQuestionsByCourse(courseId: number): Promise<Question[]> {
    return await db
      .select()
      .from(questions)
      .where(and(eq(questions.courseId, courseId), eq(questions.isActive, true)));
  }

  async createQuestion(insertQuestion: InsertQuestion): Promise<Question> {
    const [question] = await db
      .insert(questions)
      .values(insertQuestion as any)
      .returning();
    return question;
  }

  async updateQuestion(id: number, updates: Partial<InsertQuestion>): Promise<Question> {
    const [question] = await db
      .update(questions)
      .set(updates as any)
      .where(eq(questions.id, id))
      .returning();
    return question;
  }

  async deleteQuestion(id: number): Promise<void> {
    await db.update(questions).set({ isActive: false }).where(eq(questions.id, id));
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

  // Get all exam attempts for a specific user and course
  // Used to determine if user is retaking and what their previous best score was
  async getExamAttemptsByUserAndCourse(userId: number, courseId: number): Promise<ExamAttempt[]> {
    return await db
      .select()
      .from(examAttempts)
      .where(
        and(
          eq(examAttempts.userId, userId),
          eq(examAttempts.courseId, courseId)
        )
      )
      .orderBy(desc(examAttempts.createdAt)); // Most recent first
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
    } catch (error) {
      console.error("Error getting user certificate for course:", error);
      return null;
    }
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

  async updateSeller(id: number, updates: Partial<InsertSeller>): Promise<Seller> {
    const [seller] = await db
      .update(sellers)
      .set(updates)
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
    // Extract seller ID from referral code (format: sellerId-type-itemId-timestamp)
    const sellerIdMatch = clickData.referralCode.match(/^(\d+)-/);
    if (!sellerIdMatch) {
      console.error('Invalid referral code format:', clickData.referralCode);
      return;
    }
    
    const sellerId = parseInt(sellerIdMatch[1]);
    const seller = await this.getSeller(sellerId);
    if (!seller) {
      console.error('Seller not found for ID:', sellerId);
      return;
    }

    await db.insert(referralClicks).values({
      sellerId: seller.id,
      courseId: clickData.courseId,
      referralCode: clickData.referralCode,
      ipAddress: clickData.ipAddress,
      userAgent: clickData.userAgent,
    });
  }

  async updateReferralConversion(referralCode: string, courseId: number, userId: number): Promise<void> {
    await db
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

  async getSellerSales(sellerId: number): Promise<Sale[]> {
    return await db
      .select()
      .from(sales)
      .where(eq(sales.sellerId, sellerId))
      .orderBy(desc(sales.createdAt));
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

  async getSellerWithdrawals(sellerId: number): Promise<WithdrawalRequest[]> {
    return await db
      .select()
      .from(withdrawalRequests)
      .where(eq(withdrawalRequests.sellerId, sellerId))
      .orderBy(desc(withdrawalRequests.createdAt));
  }

  async getAllWithdrawals(): Promise<WithdrawalRequest[]> {
    return await db
      .select()
      .from(withdrawalRequests)
      .orderBy(desc(withdrawalRequests.createdAt));
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
        gatewayResponse: paymentResponse,
        updatedAt: new Date()
      })
      .where(eq(payments.transactionId, transactionId));
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
          isNotified: userAchievements.isNotified,
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

  // Admin analytics with comprehensive data
  async getAdminAnalytics() {
    const totalUsers = await db.select({ count: sql`count(*)::int` }).from(users);
    const totalCourses = await db.select({ count: sql`count(*)::int` }).from(courses);
    const totalCertificates = await db.select({ count: sql`count(*)::int` }).from(certificates);
    const totalSellers = await db.select({ count: sql`count(*)::int` }).from(sellers);
    const approvedSellers = await db.select({ count: sql`count(*)::int` }).from(sellers).where(eq(sellers.isApproved, true));
    const pendingSellers = await db.select({ count: sql`count(*)::int` }).from(sellers).where(eq(sellers.isApproved, false));
    
    // Calculate total revenue from payments
    const totalRevenue = await db.select({ 
      total: sql`COALESCE(SUM(CAST(amount AS DECIMAL)), 0)::int` 
    }).from(payments).where(eq(payments.status, 'success'));
    
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
      requestedAt: withdrawalRequests.requestedAt,
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
        WHERE user_id = ${users.id} AND status = 'success'
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
        WHERE course_id = ${courses.id} AND status = 'success'
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
    const [question] = await db.insert(questions).values(questionData).returning();
    return question;
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

  // Get all exam attempts for admin
  async getAllExamAttempts() {
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
      courseTitle: sql`(SELECT title FROM courses WHERE id = ${examAttempts.courseId})`.as('courseTitle'),
      passed: examAttempts.passed
    })
    .from(examAttempts)
    .orderBy(desc(examAttempts.createdAt));
  }

  // Admin course management
  async getAllCoursesForAdmin() {
    return await db.select({
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
        SELECT COUNT(*) FROM exam_attempts 
        WHERE course_id = ${courses.id}
      )`.as('enrollmentCount'),
      certificateCount: sql`(
        SELECT COUNT(*) FROM certificates 
        WHERE course_id = ${courses.id}
      )`.as('certificateCount'),
      revenue: sql`(
        SELECT COALESCE(SUM(CAST(amount AS DECIMAL)), 0)
        FROM payments p
        JOIN certificates c ON p.certificate_id = c.id
        WHERE c.course_id = ${courses.id} AND p.status = 'success'
      )`.as('revenue')
    })
    .from(courses)
    .leftJoin(categories, eq(courses.categoryId, categories.id))
    .orderBy(desc(courses.createdAt));
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
      .set({ ...updates, createdAt: new Date() })
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
}

export const storage = new DatabaseStorage();
