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

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
  console.warn(
    "[google-auth] GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not configured — Google sign-in is disabled."
  );
}

export function setupGoogleAuth() {
  // User Google Strategy
  passport.use('google-user', new GoogleStrategy({
    clientID: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    callbackURL: "/api/auth/google/user/callback"
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      const email = profile.emails?.[0]?.value;
      const name = profile.displayName;
      
      if (!email) {
        return done(new Error('No email found in Google profile'), null);
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
      } else if (!user.googleId) {
        // SECURITY: do NOT auto-link Google to a password account by email match.
        // The owner of the password account may not control this Google identity.
        // Force them to log in with email/password and link from settings.
        const err: any = new Error(
          "An account with this email already exists. Sign in with your password and link Google from your profile settings."
        );
        err.code = "GOOGLE_LINK_REQUIRED";
        return done(err, null);
      }

      return done(null, user);
    } catch (error) {
      return done(error, null);
    }
  }));

  // Seller Google Strategy  
  passport.use('google-seller', new GoogleStrategy({
    clientID: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    callbackURL: "/api/auth/google/seller/callback"
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      const email = profile.emails?.[0]?.value;
      const name = profile.displayName;
      
      if (!email) {
        return done(new Error('No email found in Google profile'), null);
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
      } else if (!seller.googleId) {
        // SECURITY: do NOT auto-link Google to a password seller account by email.
        const err: any = new Error(
          "A seller account with this email already exists. Sign in with your password and link Google from your dashboard."
        );
        err.code = "GOOGLE_LINK_REQUIRED";
        return done(err, null);
      }

      return done(null, seller);
    } catch (error) {
      return done(error, null);
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