import { Request, Response } from 'express';
import { storage } from '../storage';
import { payuMoneyService } from '../payumoney';

interface AuthenticatedRequest extends Request {
  user?: {
    userId: number;
    email: string;
  };
}

export class PaymentController {
  static async initiatePayment(req: AuthenticatedRequest, res: Response) {
    try {
      const { certificateId, amount, courseId, sellerCode } = req.body;
      const userId = req.user?.userId;

      // Generate unique transaction ID
      const transactionId = payuMoneyService.generateTransactionId();

      // Get user details
      const user = userId ? await storage.getUser(userId) : null;
      const userEmail = user?.email || req.body.email;
      const userName = user?.name || req.body.name;

      if (!userEmail || !userName) {
        return res.status(400).json({ message: "User email and name are required" });
      }

      // Prepare payment data
      const paymentData = {
        txnid: transactionId,
        amount: amount.toString(),
        productinfo: `Certificate for Course ${courseId}`,
        firstname: userName,
        email: userEmail,
        phone: req.body.phone || '',
        surl: `${req.protocol}://${req.get('host')}/api/payment/success`,
        furl: `${req.protocol}://${req.get('host')}/api/payment/failure`,
        udf1: certificateId?.toString() || '',
        udf2: courseId?.toString() || '',
        udf3: userId?.toString() || '',
        udf4: sellerCode || '',
        udf5: ''
      };

      // Generate payment form
      const paymentForm = payuMoneyService.generatePaymentForm(paymentData);

      // Store payment record
      await storage.createPayment({
        transactionId,
        userId: userId || null,
        certificateId: certificateId || null,
        courseId: courseId || null,
        amount: amount.toString(),
        status: 'pending',
        paymentMethod: 'payumoney'
      });

      res.json({
        success: true,
        transactionId,
        paymentForm
      });
    } catch (error) {
      console.error("Initiate payment error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  }

  static async handlePaymentSuccess(req: Request, res: Response) {
    try {
      const paymentResponse = req.body;
      
      // Verify payment hash
      const isValidHash = payuMoneyService.verifyHash(paymentResponse);
      if (!isValidHash) {
        return res.status(400).json({ message: "Invalid payment hash" });
      }

      const transactionId = paymentResponse.txnid;
      const status = payuMoneyService.getPaymentStatus(paymentResponse);

      // Update payment record
      await storage.updatePaymentStatus(transactionId, status, paymentResponse);

      if (status === 'success') {
        // Process successful payment
        const certificateId = paymentResponse.udf1;
        const courseId = parseInt(paymentResponse.udf2);
        const userId = paymentResponse.udf3 ? parseInt(paymentResponse.udf3) : null;
        const sellerCode = paymentResponse.udf4;

        // Handle seller commission if applicable
        if (sellerCode) {
          await storage.processSale({
            sellerId: null, // Will be resolved by sellerCode
            courseId,
            amount: parseFloat(paymentResponse.amount),
            commission: parseFloat(paymentResponse.amount) * 0.1,
            referralCode: sellerCode,
            paymentId: transactionId
          });
        }

        // Generate certificate if needed
        if (certificateId && courseId) {
          await storage.deliverCertificate(certificateId, {
            userEmail: paymentResponse.email,
            userName: paymentResponse.firstname,
            transactionId
          });
        }

        // Redirect to success page
        res.redirect(`/payment-success?txn=${transactionId}&cert=${certificateId}`);
      } else {
        // Redirect to failure page
        res.redirect(`/payment-failed?txn=${transactionId}`);
      }
    } catch (error) {
      console.error("Payment success handler error:", error);
      res.redirect('/payment-failed');
    }
  }

  static async handlePaymentFailure(req: Request, res: Response) {
    try {
      const paymentResponse = req.body;
      const transactionId = paymentResponse.txnid;

      // Update payment record
      await storage.updatePaymentStatus(transactionId, 'failure', paymentResponse);

      // Redirect to failure page
      res.redirect(`/payment-failed?txn=${transactionId}`);
    } catch (error) {
      console.error("Payment failure handler error:", error);
      res.redirect('/payment-failed');
    }
  }

  static async getPaymentStatus(req: Request, res: Response) {
    try {
      const transactionId = req.params.transactionId;
      const payment = await storage.getPaymentByTransactionId(transactionId);

      if (!payment) {
        return res.status(404).json({ message: "Payment not found" });
      }

      res.json(payment);
    } catch (error) {
      console.error("Get payment status error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  }
}