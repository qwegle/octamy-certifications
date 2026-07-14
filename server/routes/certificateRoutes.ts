import { Router } from 'express';
import type { RequestHandler } from 'express';
import { CertificateController } from '../controllers/certificateController';
import { authenticateToken, optionalAuth } from '../middleware/auth';

const router = Router();
const requireUser = authenticateToken as RequestHandler;
const allowAnonymous = optionalAuth as RequestHandler;

// Certificate routes
router.post('/create', allowAnonymous, CertificateController.createCertificate as RequestHandler);
// Specific collection/action routes must precede the generic /:id matcher.
router.get('/user/certificates', requireUser, CertificateController.getUserCertificates as RequestHandler);
router.get('/verify/:id', CertificateController.verifyCertificate as RequestHandler);
router.get('/:id/activation', requireUser, CertificateController.getActivationCheckout as RequestHandler);
router.get('/:id/download', CertificateController.downloadCertificate as RequestHandler);
router.get('/:id', CertificateController.getCertificate as RequestHandler);

export default router;
