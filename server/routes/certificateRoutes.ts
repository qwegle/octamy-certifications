import { Router } from 'express';
import type { RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import { CertificateController } from '../controllers/certificateController';
import { authenticateToken } from '../middleware/auth';

const router = Router();
const requireUser = authenticateToken as RequestHandler;

// A credential is retrievable by its exact public certificate ID because that
// is the same disclosure the QR verification endpoint already makes: holder
// name, course, score, badge, issuer and validity. The rendered credential
// carries no email, answers, question data, integrity events or device data.
// Retrieval is bounded so an exact-ID credential cannot be enumerated or
// scraped in bulk.
const credentialRetrievalLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many credential requests. Please wait and try again.' },
});

// Certificate routes
router.post('/create', requireUser, CertificateController.createCertificate as RequestHandler);
// Specific collection/action routes must precede the generic /:id matcher.
router.get('/user/certificates', requireUser, CertificateController.getUserCertificates as RequestHandler);
router.get('/verify/:id', credentialRetrievalLimiter, CertificateController.verifyCertificate as RequestHandler);
router.get('/:id/activation', requireUser, CertificateController.getActivationCheckout as RequestHandler);
router.get('/:id/download', credentialRetrievalLimiter, CertificateController.downloadCertificate as RequestHandler);
router.get('/:id', credentialRetrievalLimiter, CertificateController.getCertificate as RequestHandler);

export default router;
