import { 
  users, 
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
  type UserPreferences,
  type InsertUserPreferences,
  type Notification,
  type InsertNotification,
  type CourseRecommendation,
  type InsertCourseRecommendation,
  type UserActivity,
  type InsertUserActivity
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Category operations
  getCategories(): Promise<Category[]>;
  createCategory(category: InsertCategory): Promise<Category>;

  // Course operations
  getCourses(categoryId?: number): Promise<(Course & { category: Category })[]>;
  getCourse(id: number): Promise<Course | undefined>;
  getCourseBySlug(slug: string): Promise<(Course & { category: Category }) | undefined>;
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

  // Certificate operations
  createCertificate(certificate: InsertCertificate): Promise<Certificate>;
  getCertificate(id: number): Promise<Certificate | undefined>;
  getCertificateByCertificateId(certificateId: string): Promise<Certificate | undefined>;
  getUserCertificates(userId: number): Promise<Certificate[]>;
  updateCertificatePayment(id: number, updates: { isPaid: boolean; paymentId: string }): Promise<void>;

  // Payment operations
  createPayment(payment: InsertPayment): Promise<Payment>;
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
}

export const storage = new DatabaseStorage();
