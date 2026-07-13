import { Router } from 'express';
import passport from 'passport';
import crypto from 'node:crypto';
import { generateToken, isGoogleAuthConfigured } from '../google-auth';

const router = Router();

router.get('/auth/google/status', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ enabled: isGoogleAuthConfigured });
});

function requireGoogleAuth(req: any, res: any, next: any) {
  if (!isGoogleAuthConfigured) {
    const loginPath = req.path.includes('/seller') ? '/partners/login' : '/login';
    return res.redirect(`${loginPath}?error=google_not_configured`);
  }
  next();
}

function readCookie(req: any, name: string) {
  const raw = req.headers.cookie || '';
  const match = raw.split(';').map((item: string) => item.trim()).find((item: string) => item.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : undefined;
}

function stateCookie(name: string, value: string, maxAgeSeconds: number) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${name}=${encodeURIComponent(value)}; Path=/api/auth/google; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure}`;
}

function beginGoogleAuth(strategy: 'google-user' | 'google-seller', cookieName: string) {
  return (req: any, res: any, next: any) => {
    const state = crypto.randomBytes(32).toString('base64url');
    res.setHeader('Set-Cookie', stateCookie(cookieName, state, 600));
    passport.authenticate(strategy, { scope: ['profile', 'email'], state })(req, res, next);
  };
}

function verifyGoogleState(cookieName: string, failurePath: string) {
  return (req: any, res: any, next: any) => {
    const expected = readCookie(req, cookieName);
    const received = typeof req.query.state === 'string' ? req.query.state : '';
    res.setHeader('Set-Cookie', stateCookie(cookieName, '', 0));
    if (!expected || !received || expected.length !== received.length ||
        !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received))) {
      return res.redirect(`${failurePath}?error=invalid_oauth_state`);
    }
    next();
  };
}

// User Google Authentication Routes
router.get('/auth/google/user',
  requireGoogleAuth,
  beginGoogleAuth('google-user', 'octamy_google_user_state')
);

router.get('/auth/google/user/callback',
  verifyGoogleState('octamy_google_user_state', '/login'),
  (req, res, next) => {
    passport.authenticate('google-user', { session: false }, (err: any, user: any) => {
      if (err) {
        const code = err.code === 'GOOGLE_LINK_REQUIRED' ? 'google_link_required' : 'auth_failed';
        return res.redirect(`/login?error=${code}`);
      }
      if (!user) {
        return res.redirect('/login?error=auth_failed');
      }
      try {
        const token = generateToken(user, 'user');
        // A URL fragment is never sent in HTTP requests or Referer headers, so
        // the bearer token does not leak into access logs or third-party assets.
        return res.redirect(`/login#token=${encodeURIComponent(token)}&success=true`);
      } catch (error) {
        console.error('Google auth callback error:', error);
        return res.redirect('/login?error=auth_failed');
      }
    })(req, res, next);
  }
);

// Seller Google Authentication Routes
router.get('/auth/google/seller',
  requireGoogleAuth,
  beginGoogleAuth('google-seller', 'octamy_google_seller_state')
);

router.get('/auth/google/seller/callback',
  verifyGoogleState('octamy_google_seller_state', '/partners/login'),
  (req, res, next) => {
    passport.authenticate('google-seller', { session: false }, (err: any, seller: any) => {
      if (err) {
        const code = err.code === 'GOOGLE_LINK_REQUIRED' ? 'google_link_required' : 'auth_failed';
        return res.redirect(`/partners/login?error=${code}`);
      }
      if (!seller) {
        return res.redirect('/partners/login?error=auth_failed');
      }
      try {
        const token = generateToken(seller, 'seller');
        return res.redirect(`/partners/login#token=${encodeURIComponent(token)}&success=true`);
      } catch (error) {
        console.error('Google seller auth callback error:', error);
        return res.redirect('/partners/login?error=auth_failed');
      }
    })(req, res, next);
  }
);

export default router;
