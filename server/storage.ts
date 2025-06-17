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
  type InsertUserAchievement
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc } from "drizzle-orm";

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
    
    return await query.orderBy(desc(userCourseProgress.lastAccessedAt));
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
}

export const storage = new DatabaseStorage();
