import { Router } from 'express';
import { CertificateController } from '../controllers/certificateController';
import { authenticateToken, optionalAuth } from '../middleware/auth';

const router = Router();

// Certificate routes
router.post('/create', optionalAuth, CertificateController.createCertificate);
router.get('/:id', CertificateController.getCertificate);
router.get('/:id/download', CertificateController.downloadCertificate);
router.get('/verify/:id', CertificateController.verifyCertificate);
router.get('/user/certificates', authenticateToken, CertificateController.getUserCertificates);

export default router;