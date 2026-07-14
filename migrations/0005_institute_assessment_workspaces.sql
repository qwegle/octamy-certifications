-- Tenant-scoped course/question-bank and per-exam result queries are core
-- workspace paths. These indexes keep them predictable as organizations grow.
CREATE INDEX IF NOT EXISTS courses_owner_created_idx
  ON courses (owner_type, owner_id, created_at DESC);

CREATE INDEX IF NOT EXISTS question_banks_owner_updated_idx
  ON question_banks (owner_type, owner_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS questions_bank_active_idx
  ON questions (bank_id, is_active, id)
  WHERE bank_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS exam_instance_attempts_instance_started_idx
  ON exam_instance_attempts (instance_id, started_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS institute_members_active_user_idx
  ON institute_members (user_id, institute_id, role)
  WHERE status = 'active';

-- Repair cached counts for installations that imported/deleted questions
-- before the question-bank counter was transactionally maintained.
UPDATE question_banks bank
SET question_count = counts.total,
    updated_at = CASE WHEN bank.question_count <> counts.total THEN NOW() ELSE bank.updated_at END
FROM (
  SELECT bank_row.id, COUNT(question_row.id)::int AS total
  FROM question_banks bank_row
  LEFT JOIN questions question_row ON question_row.bank_id = bank_row.id
  GROUP BY bank_row.id
) counts
WHERE bank.id = counts.id
  AND bank.question_count <> counts.total;
