-- Performance indexes for hot dashboard / API queries.
-- Idempotent: safe to run multiple times via IF NOT EXISTS.

CREATE INDEX IF NOT EXISTS idx_creators_user_id ON creators(user_id);
CREATE INDEX IF NOT EXISTS idx_creators_status ON creators(status);

CREATE INDEX IF NOT EXISTS idx_institute_members_user_id ON institute_members(user_id);
CREATE INDEX IF NOT EXISTS idx_institute_members_institute_id ON institute_members(institute_id);

CREATE INDEX IF NOT EXISTS idx_courses_owner ON courses(owner_type, owner_id);
CREATE INDEX IF NOT EXISTS idx_courses_category_id ON courses(category_id);
CREATE INDEX IF NOT EXISTS idx_courses_is_active ON courses(is_active);

CREATE INDEX IF NOT EXISTS idx_exam_attempts_user_id ON exam_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_course_id ON exam_attempts(course_id);

CREATE INDEX IF NOT EXISTS idx_exam_instances_owner ON exam_instances(owner_type, owner_id);
CREATE INDEX IF NOT EXISTS idx_exam_instances_status ON exam_instances(status);

CREATE INDEX IF NOT EXISTS idx_exam_instance_attempts_instance_id ON exam_instance_attempts(instance_id);
CREATE INDEX IF NOT EXISTS idx_exam_instance_attempts_user_id ON exam_instance_attempts(user_id);

-- Prevent two parallel in-progress attempts for the same (instance, user).
CREATE UNIQUE INDEX IF NOT EXISTS uniq_inprogress_attempt
  ON exam_instance_attempts(instance_id, user_id)
  WHERE status = 'in_progress' AND user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_questions_bank_active ON questions(bank_id, is_active);

CREATE INDEX IF NOT EXISTS idx_recruiters_kyc_status ON recruiters(kyc_status);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_recruiter ON credit_transactions(recruiter_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_desc ON credit_transactions(description);

CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);

CREATE INDEX IF NOT EXISTS idx_certificates_user_id ON certificates(user_id);
CREATE INDEX IF NOT EXISTS idx_certificates_course_id ON certificates(course_id);
