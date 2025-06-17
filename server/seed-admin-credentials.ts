import { db } from "./db";
import { users, sellers } from "@shared/schema";
import bcrypt from "bcrypt";

export async function seedAdminCredentials() {
  try {
    // Create admin user
    const adminPasswordHash = await bcrypt.hash("admin123", 10);
    await db.insert(users).values({
      email: "admin@octamy.com",
      password: adminPasswordHash,
      name: "Admin User",
      isAdmin: true,
      isActive: true
    }).onConflictDoNothing();

    // Create partner/seller account
    const partnerPasswordHash = await bcrypt.hash("partner123", 10);
    await db.insert(sellers).values({
      email: "partner@octamy.com",
      password: partnerPasswordHash,
      name: "Test Partner",
      isApproved: true,
      isActive: true,
      commissionRate: "10.00",
      phone: "9876543210",
      upiId: "partner@upi"
    }).onConflictDoNothing();

    console.log("✅ Admin and Partner credentials seeded successfully!");
    console.log("Admin Login: admin@octamy.com / admin123");
    console.log("Partner Login: partner@octamy.com / partner123");
  } catch (error) {
    console.error("Error seeding admin credentials:", error);
  }
}