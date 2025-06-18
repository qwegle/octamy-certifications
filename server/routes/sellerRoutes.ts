import { Router } from 'express';
import { SellerController } from '../controllers/sellerController';
import { authenticateSellerToken } from '../middleware/auth';

const router = Router();

// Public seller routes
router.post('/register', SellerController.register);
router.post('/login', SellerController.login);

// Protected seller routes
router.get('/dashboard', authenticateSellerToken, SellerController.getDashboard);
router.get('/shareable-items', authenticateSellerToken, SellerController.getShareableItems);
router.post('/generate-referral', authenticateSellerToken, SellerController.generateReferralUrl);
router.post('/withdrawal-request', authenticateSellerToken, SellerController.requestWithdrawal);

export default router;