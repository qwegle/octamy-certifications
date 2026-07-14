import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { storage } from './storage';
import jwt from 'jsonwebtoken';
import { generateUniqueReferralCode } from './utils/referralCodeGenerator';

const JWT_SECRET = process.env.JWT_SECRET!;

// Google OAuth Configuration. Secrets are read from env — never commit credentials.
// Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env (production rotates the
// previously-leaked values).
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const APP_URL = (process.env.APP_URL || "").replace(/\/$/, "");

function isUsableOAuthCredential(value: string) {
  const normalized = value.trim().toLowerCase();
  return Boolean(
    normalized &&
    !normalized.startsWith("your_") &&
    !normalized.startsWith("change_me") &&
    !normalized.includes("placeholder") &&
    !normalized.includes("example"),
  );
}

export const isGoogleAuthConfigured = Boolean(
  isUsableOAuthCredential(GOOGLE_CLIENT_ID) && isUsableOAuthCredential(GOOGLE_CLIENT_SECRET)
);

function callbackUrl(path: string) {
  return APP_URL ? `${APP_URL}${path}` : path;
}

if (!isGoogleAuthConfigured) {
  console.warn(
    "[google-auth] usable GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not configured — Google sign-in is disabled."
  );
}

export function setupGoogleAuth() {
  if (!isGoogleAuthConfigured) {
    // Skip strategy registration entirely — the routes will still mount but
    // any Google sign-in attempt will redirect with auth_failed.
    return;
  }
  // User Google Strategy
  passport.use('google-user', new GoogleStrategy({
    clientID: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    callbackURL: callbackUrl("/api/auth/google/user/callback"),
    proxy: true,
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      const googleEmail = profile.emails?.[0];
      const email = googleEmail?.value?.trim().toLowerCase();
      const name = profile.displayName;
      
      if (!email || googleEmail?.verified !== true) {
        return done(new Error('Google did not provide a verified email address'), false);
      }

      // Check if user exists
      let user = await storage.getUserByEmail(email);
      
      if (!user) {
        // Create new user
        const userData = {
          name,
          email,
          password: '', // Google users don't need password
          googleId: profile.id,
          isGoogleUser: true
        };
        
        user = await storage.createUser(userData);
      } else if (user.googleId && user.googleId !== profile.id) {
        return done(new Error("This email is linked to a different Google identity."), false);
      } else if (!user.googleId) {
        // Google OAuth only returns an account email after Google has verified it.
        // Linking by the unique, normalized email keeps one account per person and
        // prevents an existing password user from being locked out of Google login.
        user = await storage.updateUser(user.id, {
          googleId: profile.id,
          isGoogleUser: true,
        });
      }

      if (!user) {
        return done(new Error("Unable to create or update the Google user"), false);
      }
      return done(null, { ...user, userId: user.id });
    } catch (error) {
      return done(error, false);
    }
  }));

  // Seller Google Strategy  
  passport.use('google-seller', new GoogleStrategy({
    clientID: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    callbackURL: callbackUrl("/api/auth/google/seller/callback"),
    proxy: true,
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      const googleEmail = profile.emails?.[0];
      const email = googleEmail?.value?.trim().toLowerCase();
      const name = profile.displayName;
      
      if (!email || googleEmail?.verified !== true) {
        return done(new Error('Google did not provide a verified email address'), false);
      }

      // Check if seller exists
      let seller = await storage.getSellerByEmail(email);
      
      if (!seller) {
        // Generate unique referral code for new seller
        const referralCode = await generateUniqueReferralCode();
          
        // Create new seller with pending status (requires admin approval)
        const sellerData = {
          name,
          email,
          password: '', // Google sellers don't need password
          phone: '', // Will need to be filled later
          googleId: profile.id,
          isGoogleUser: true,
          isApproved: false, // Requires admin approval
          isActive: true,
          referralCode: referralCode
        };
        
        seller = await storage.createSeller(sellerData);
      } else if (seller.googleId && seller.googleId !== profile.id) {
        return done(new Error("This email is linked to a different Google identity."), false);
      } else if (!seller.googleId) {
        seller = await storage.updateSeller(seller.id, {
          googleId: profile.id,
          isGoogleUser: true,
        });
      }

      return done(null, { ...seller, userId: seller.id });
    } catch (error) {
      return done(error, false);
    }
  }));

  passport.serializeUser((user: any, done) => {
    done(null, user);
  });

  passport.deserializeUser((user: any, done) => {
    done(null, user);
  });
}



export function generateToken(user: any, type: 'user' | 'seller') {
  const payload = type === 'user' 
    ? { userId: user.id, email: user.email, name: user.name }
    : { sellerId: user.id, email: user.email, name: user.name };
    
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}
