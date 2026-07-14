import { db } from "./db";
import { users, sellers } from "@shared/schema";
import bcrypt from "bcrypt";

export async function seedAdminCredentials() {
  try {
    const adminEmail = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
    const adminPassword = process.env.ADMIN_PASSWORD || "";
    if (!/^\S+@\S+\.\S+$/.test(adminEmail) || adminPassword.length < 12) {
      throw new Error("ADMIN_EMAIL and an ADMIN_PASSWORD of at least 12 characters are required");
    }
    const bcryptRounds = Math.max(10, Math.min(14, Number(process.env.BCRYPT_ROUNDS) || 12));
    const adminPasswordHash = await bcrypt.hash(adminPassword, bcryptRounds);
    await db.insert(users).values({
      email: adminEmail,
      password: adminPasswordHash,
      name: "Admin User",
      isAdmin: true
    }).onConflictDoUpdate({
      target: users.email,
      set: { password: adminPasswordHash, isAdmin: true },
    });

    const partnerEmail = String(process.env.SEED_PARTNER_EMAIL || "").trim().toLowerCase();
    const partnerPassword = process.env.SEED_PARTNER_PASSWORD || "";
    if (partnerEmail || partnerPassword) {
      if (!/^\S+@\S+\.\S+$/.test(partnerEmail) || partnerPassword.length < 12) {
        throw new Error("SEED_PARTNER_EMAIL and a SEED_PARTNER_PASSWORD of at least 12 characters must be supplied together");
      }
      const partnerPasswordHash = await bcrypt.hash(partnerPassword, bcryptRounds);
      await db.insert(sellers).values({
        email: partnerEmail,
        password: partnerPasswordHash,
        name: "Test Partner",
        isApproved: true,
        isActive: true,
        commissionRate: "10.00",
        phone: "9876543210",
        upiId: "partner@upi"
      }).onConflictDoUpdate({
        target: sellers.email,
        set: { password: partnerPasswordHash, isApproved: true, isActive: true },
      });
    }

    console.log(`Admin account ready: ${adminEmail} (password supplied via ADMIN_PASSWORD)`);
    if (partnerEmail) console.log(`Partner account ready: ${partnerEmail} (password supplied via SEED_PARTNER_PASSWORD)`);
  } catch (error) {
    console.error("Error seeding credentials:", error);
    throw error;
  }
}
