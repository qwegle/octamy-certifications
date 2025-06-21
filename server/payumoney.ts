import crypto from 'crypto';

export interface PayUMoneyConfig {
  merchantId: string;
  merchantKey: string;
  salt: string;
  baseUrl: string;
}

export interface PaymentRequest {
  txnid: string;
  amount: string;
  productinfo: string;
  firstname: string;
  email: string;
  phone?: string;
  surl: string; // success URL
  furl: string; // failure URL
  udf1?: string;
  udf2?: string;
  udf3?: string;
  udf4?: string;
  udf5?: string;
}

export interface PaymentResponse {
  mihpayid: string;
  mode: string;
  status: string;
  unmappedstatus: string;
  key: string;
  txnid: string;
  amount: string;
  addedon: string;
  productinfo: string;
  firstname: string;
  lastname: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  country: string;
  zipcode: string;
  email: string;
  phone: string;
  udf1: string;
  udf2: string;
  udf3: string;
  udf4: string;
  udf5: string;
  field1: string;
  field2: string;
  field3: string;
  field4: string;
  field5: string;
  field6: string;
  field7: string;
  field8: string;
  field9: string;
  error: string;
  error_Message: string;
  net_amount_debit: string;
  disc: string;
  hash: string;
  bank_ref_num: string;
  bankcode: string;
  cardnum: string;
  name_on_card: string;
  cardCategory: string;
  isConvenientFeeFromMerchant: string;
  card_type: string;
  easypayid: string;
  payment_source: string;
  PG_TYPE: string;
  encryptedPaymentId: string;
  offer_key: string;
  offer_discount: string;
  offer_failure_reason: string;
  cardToken: string;
}

export class PayUMoneyService {
  private config: PayUMoneyConfig;

  constructor() {
    this.config = {
      merchantId: process.env.PAYUMONEY_MERCHANT_ID || '',
      merchantKey: process.env.PAYUMONEY_MERCHANT_KEY || '',
      salt: process.env.PAYUMONEY_SALT || '',
      baseUrl: 'https://secure.payu.in/_payment'
    };

    // Only throw error in production
    if (process.env.NODE_ENV === 'production' && (!this.config.merchantId || !this.config.merchantKey || !this.config.salt)) {
      throw new Error('PayUMoney configuration is incomplete. Please provide PAYUMONEY_MERCHANT_ID, PAYUMONEY_MERCHANT_KEY, and PAYUMONEY_SALT');
    }
  }

  /**
   * Generate hash for payment request
   */
  generateHash(paymentData: PaymentRequest): string {
    if (!this.config.merchantKey || !this.config.salt) {
      throw new Error('PayUMoney credentials not configured for payment processing');
    }

    const {
      txnid,
      amount,
      productinfo,
      firstname,
      email,
      udf1 = '',
      udf2 = '',
      udf3 = '',
      udf4 = '',
      udf5 = ''
    } = paymentData;

    const hashString = `${this.config.merchantKey}|${txnid}|${amount}|${productinfo}|${firstname}|${email}|${udf1}|${udf2}|${udf3}|${udf4}|${udf5}||||||${this.config.salt}`;
    
    return crypto.createHash('sha512').update(hashString).digest('hex');
  }

  /**
   * Verify hash for payment response
   */
  verifyHash(responseData: Partial<PaymentResponse>): boolean {
    if (!this.config.merchantKey || !this.config.salt) {
      throw new Error('PayUMoney credentials not configured for payment verification');
    }

    const {
      status,
      firstname,
      productinfo,
      amount,
      txnid,
      hash,
      udf1 = '',
      udf2 = '',
      udf3 = '',
      udf4 = '',
      udf5 = '',
      email = ''
    } = responseData;

    const hashString = `${this.config.salt}|${status}||||||${udf5}|${udf4}|${udf3}|${udf2}|${udf1}|${email}|${firstname}|${productinfo}|${amount}|${txnid}|${this.config.merchantKey}`;
    
    const calculatedHash = crypto.createHash('sha512').update(hashString).digest('hex');
    
    return calculatedHash === hash;
  }

  /**
   * Generate secure payment form data with SSL enforcement
   */
  generatePaymentForm(paymentData: PaymentRequest): {
    action: string;
    method: string;
    fields: Record<string, string>;
    securityHeaders: Record<string, string>;
    html: string;
    url: string;
  } {
    const hash = this.generateHash(paymentData);

    // Ensure HTTPS URLs for production security
    const secureSuccessUrl = paymentData.surl.replace('http://', 'https://');
    const secureFailureUrl = paymentData.furl.replace('http://', 'https://');

    const fields = {
      key: this.config.merchantKey,
      txnid: paymentData.txnid,
      amount: paymentData.amount,
      productinfo: paymentData.productinfo,
      firstname: paymentData.firstname,
      email: paymentData.email,
      phone: paymentData.phone || '',
      surl: secureSuccessUrl,
      furl: secureFailureUrl,
      hash: hash,
      udf1: paymentData.udf1 || '',
      udf2: paymentData.udf2 || '',
      udf3: paymentData.udf3 || '',
      udf4: paymentData.udf4 || '',
      udf5: paymentData.udf5 || '',
      service_provider: 'payu_paisa',
      enforce_paymethod: 'creditcard,debitcard,netbanking,upi',
      pg: 'CC,DC,NB,UPI',
      bankcode: 'CC',
      drop_category: '0',
      offer_key: '',
      show_payment_mode: '1'
    };

    // Generate HTML form
    const formFields = Object.entries(fields)
      .map(([key, value]) => `<input type="hidden" name="${key}" value="${value}" />`)
      .join('\n');

    const html = `
      <form method="POST" action="${this.config.baseUrl}" id="payuform">
        ${formFields}
      </form>
      <script>
        document.getElementById('payuform').submit();
      </script>
    `;

    return {
      action: this.config.baseUrl,
      method: 'POST',
      fields,
      html,
      url: this.config.baseUrl,
      securityHeaders: {
        'Content-Security-Policy': "default-src 'self' https://secure.payu.in https://test.payu.in; script-src 'self' 'unsafe-inline' https://secure.payu.in; style-src 'self' 'unsafe-inline'",
        'X-Frame-Options': 'SAMEORIGIN',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
      }
    };
  }

  /**
   * Generate unique transaction ID
   */
  generateTransactionId(): string {
    return 'TXN' + Date.now() + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Get payment status from response
   */
  getPaymentStatus(responseData: Partial<PaymentResponse>): 'success' | 'failure' | 'pending' {
    const status = responseData.status?.toLowerCase();
    
    if (status === 'success') return 'success';
    if (status === 'failure') return 'failure';
    return 'pending';
  }

  /**
   * Validate payment amount
   */
  validateAmount(amount: string | number): boolean {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    return !isNaN(numAmount) && numAmount > 0;
  }

  /**
   * Format amount for PayUMoney (should be in paisa for some operations)
   */
  formatAmount(amount: string | number): string {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    return numAmount.toFixed(2);
  }
}

export const payuMoneyService = new PayUMoneyService();