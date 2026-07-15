ALTER TABLE "certificates" DROP CONSTRAINT IF EXISTS "certificates_funding_source_check";
--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_funding_source_check"
  CHECK ("funding_source" IN (
    'direct_payment',
    'learner_subscription',
    'institute_contract',
    'complimentary',
    'institute_voucher',
    'creator_voucher'
  ));
