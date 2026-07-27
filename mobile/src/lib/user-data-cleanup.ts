export type UserDataCleaner = (userId: number) => Promise<void> | void;

const cleaners = new Set<UserDataCleaner>();

/** Feature repositories register deletion here so local logout can purge every user-scoped record. */
export function registerUserDataCleaner(cleaner: UserDataCleaner): () => void {
  cleaners.add(cleaner);
  return () => cleaners.delete(cleaner);
}

export async function purgeUserScopedLocalData(userId: number): Promise<void> {
  const results = await Promise.allSettled([...cleaners].map((cleaner) => cleaner(userId)));
  const failures = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected');
  if (failures.length === 0) return;

  if (__DEV__) console.warn(`Octamy local cleanup failed in ${failures.length} registered repository/repositories.`);
  throw new Error(`Could not remove learner data from ${failures.length} local repository/repositories.`);
}
