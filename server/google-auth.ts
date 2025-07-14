import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { storage } from './storage';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

// Google OAuth Configuration
const GOOGLE_CLIENT_ID = "sxt8OEXPWxrFXVK95WLtqfhlACiqa87k";
const GOOGLE_CLIENT_SECRET = "a7Ku36qnh3aID_ewTrk8sIHvmKiOL99hvSunIG2d8xUTcEPrlFtWSIPp8sDMOPHa";

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
        // Link existing account with Google
        await storage.updateUser(user.id, { googleId: profile.id, isGoogleUser: true });
        user.googleId = profile.id;
        user.isGoogleUser = true;
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
        // Create new seller with pending status
        const sellerData = {
          name,
          email,
          password: '', // Google sellers don't need password
          phone: '', // Will need to be filled later
          googleId: profile.id,
          isGoogleUser: true,
          isApproved: false // Pending admin approval
        };
        
        seller = await storage.createSeller(sellerData);
      } else if (!seller.googleId) {
        // Link existing account with Google
        await storage.updateSeller(seller.id, { googleId: profile.id, isGoogleUser: true });
        seller.googleId = profile.id;
        seller.isGoogleUser = true;
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