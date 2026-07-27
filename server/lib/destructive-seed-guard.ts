export function assertDestructiveSeedAllowed(environment: NodeJS.ProcessEnv = process.env) {
  if (environment.NODE_ENV === "production") {
    throw new Error("The comprehensive reset seed is disabled in production");
  }
  if (environment.ALLOW_DESTRUCTIVE_SEED !== "true") {
    throw new Error(
      "Refusing to truncate seed tables. Set ALLOW_DESTRUCTIVE_SEED=true only for a disposable local database.",
    );
  }
}
