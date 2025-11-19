import { db } from "./db";
import { users, sellers } from "@shared/schema";
import bcrypt from "bcrypt";

export async function seedAdminCredentials() {
  try {
    // Create admin user
    const adminPasswordHash = await bcrypt.hash("password", 10);
    await db.insert(users).values({
      email: "admin@premcq.com",
      password: adminPasswordHash,
      name: "Admin User",
      isAdmin: true,
      isActive: true
    }).onConflictDoNothing();

    // Create partner/seller account
    const partnerPasswordHash = await bcrypt.hash("password", 10);
    await db.insert(sellers).values({
      email: "partner@premcq.com",
      password: partnerPasswordHash,
      name: "Test Partner",
      isApproved: true,
      isActive: true,
      commissionRate: "10.00",
      phone: "9876543210",
      upiId: "partner@upi"
    }).onConflictDoNothing();

    console.log("✅ Admin and Partner credentials seeded successfully!");
    console.log("Admin Login: admin@premcq.com / password");
    console.log("Partner Login: partner@premcq.com / password");
  } catch (error) {
    console.error("Error seeding admin credentials:", error);
  }
}