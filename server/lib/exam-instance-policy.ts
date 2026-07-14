export type ExamWorkspaceOwner = {
  ownerType: string;
  ownerId: number | null;
};

/**
 * Question-bank visibility is discovery metadata, not permission to execute or
 * disclose its answer keys. Only the exact owning workspace may attach a bank
 * to an exam. Platform-admin exams are the deliberate exception.
 */
export function canAttachQuestionBank(
  examOwner: ExamWorkspaceOwner,
  bankOwner: ExamWorkspaceOwner,
  actorIsAdmin: boolean,
): boolean {
  if (examOwner.ownerType === "admin") return actorIsAdmin;
  if (!["creator", "institute"].includes(examOwner.ownerType)) return false;
  return bankOwner.ownerType === examOwner.ownerType
    && bankOwner.ownerId != null
    && bankOwner.ownerId === examOwner.ownerId;
}

/** Bcrypt hashes never belong in browser-facing exam payloads. */
export function withoutExamPasswordHash<T extends Record<string, unknown>>(
  instance: T,
): Omit<T, "passwordHash"> {
  const { passwordHash: _passwordHash, ...safe } = instance;
  return safe;
}
