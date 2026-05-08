import { Router } from 'express';
import passport from 'passport';
import { generateToken } from '../google-auth';

const router = Router();

// User Google Authentication Routes
router.get('/auth/google/user', 
  passport.authenticate('google-user', { scope: ['profile', 'email'] })
);

router.get('/auth/google/user/callback',
  (req, res, next) => {
    passport.authenticate('google-user', { session: false }, (err: any, user: any) => {
      if (err) {
        const code = err.code === 'GOOGLE_LINK_REQUIRED' ? 'google_link_required' : 'auth_failed';
        return res.redirect(`/auth?error=${code}`);
      }
      if (!user) {
        return res.redirect('/auth?error=auth_failed');
      }
      try {
        const token = generateToken(user, 'user');
        return res.redirect(`/auth?token=${token}&success=true`);
      } catch (error) {
        console.error('Google auth callback error:', error);
        return res.redirect('/auth?error=auth_failed');
      }
    })(req, res, next);
  }
);

// Seller Google Authentication Routes
router.get('/auth/google/seller',
  passport.authenticate('google-seller', { scope: ['profile', 'email'] })
);

router.get('/auth/google/seller/callback',
  (req, res, next) => {
    passport.authenticate('google-seller', { session: false }, (err: any, seller: any) => {
      if (err) {
        const code = err.code === 'GOOGLE_LINK_REQUIRED' ? 'google_link_required' : 'auth_failed';
        return res.redirect(`/seller-auth?error=${code}`);
      }
      if (!seller) {
        return res.redirect('/seller-auth?error=auth_failed');
      }
      try {
        const token = generateToken(seller, 'seller');
        return res.redirect(`/seller-auth?token=${token}&success=true`);
      } catch (error) {
        console.error('Google seller auth callback error:', error);
        return res.redirect('/seller-auth?error=auth_failed');
      }
    })(req, res, next);
  }
);

export default router;