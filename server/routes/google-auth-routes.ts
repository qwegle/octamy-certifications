import { Router } from 'express';
import passport from 'passport';
import { generateToken } from '../google-auth';

const router = Router();

// User Google Authentication Routes
router.get('/auth/google/user', 
  passport.authenticate('google-user', { scope: ['profile', 'email'] })
);

router.get('/auth/google/user/callback',
  passport.authenticate('google-user', { session: false }),
  (req, res) => {
    try {
      const user = req.user as any;
      console.log('Google user callback - User:', user);
      
      if (!user) {
        console.error('No user returned from Google authentication');
        return res.redirect('/auth?error=auth_failed');
      }
      
      const token = generateToken(user, 'user');
      console.log('Generated token for user:', user.email);
      
      // Redirect to auth page with token for frontend handling
      res.redirect(`/auth?token=${token}&success=true`);
    } catch (error) {
      console.error('Google auth callback error:', error);
      res.redirect('/auth?error=auth_failed');
    }
  }
);

// Seller Google Authentication Routes
router.get('/auth/google/seller',
  passport.authenticate('google-seller', { scope: ['profile', 'email'] })
);

router.get('/auth/google/seller/callback',
  passport.authenticate('google-seller', { session: false }),
  (req, res) => {
    try {
      const seller = req.user as any;
      console.log('Google seller callback - Seller:', seller);
      
      if (!seller) {
        console.error('No seller returned from Google authentication');
        return res.redirect('/seller-auth?error=auth_failed');
      }
      
      const token = generateToken(seller, 'seller');
      console.log('Generated token for seller:', seller.email);
      
      // Redirect to seller auth page with token for frontend handling
      res.redirect(`/seller-auth?token=${token}&success=true`);
    } catch (error) {
      console.error('Google seller auth callback error:', error);
      res.redirect('/seller-auth?error=auth_failed');
    }
  }
);

export default router;