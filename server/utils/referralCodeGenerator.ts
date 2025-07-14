import { storage } from '../storage';

// Generate unique referral code with retry logic
export async function generateUniqueReferralCode(): Promise<string> {
  let attempts = 0;
  const maxAttempts = 10;
  
  while (attempts < maxAttempts) {
    // Generate referral code: REF + 4 random uppercase letters + 4 random numbers
    const letters = Math.random().toString(36).substring(2, 6).toUpperCase();
    const numbers = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    const referralCode = `REF${letters}${numbers}`;
    
    // Check if code already exists
    const existingSeller = await storage.getSellerByReferralCode(referralCode);
    if (!existingSeller) {
      return referralCode;
    }
    
    attempts++;
  }
  
  // Fallback with timestamp if all attempts fail
  return `REF${Date.now()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
}