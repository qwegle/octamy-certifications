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
      const token = generateToken(user, 'user');
      
      // Redirect to frontend with token
      res.redirect(`/?token=${token}&success=true`);
    } catch (error) {
      console.error('Google auth callback error:', error);
      res.redirect('/?error=auth_failed');
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
      const token = generateToken(seller, 'seller');
      
      // Redirect to seller dashboard with token
      res.redirect(`/seller-dashboard?token=${token}&success=true`);
    } catch (error) {
      console.error('Google seller auth callback error:', error);
      res.redirect('/seller-auth?error=auth_failed');
    }
  }
);

export default router;