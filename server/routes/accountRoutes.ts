import { Router, type RequestHandler } from "express";
import rateLimit from "express-rate-limit";
import { authenticateToken } from "../middleware/auth";
import { emailService } from "../utils/emailService";
import {
  AccountDeletionError,
  AccountDeletionService,
  LocalArtifactCleaner,
  PostgresAccountDeletionStore,
  type AccountDeletionStore,
  type ArtifactCleaner,
  type VerificationMailer,
} from "../lib/account-deletion";

export type AccountRouteDependencies = {
  authenticate?: RequestHandler;
  store?: AccountDeletionStore;
  mailer?: VerificationMailer;
  cleaner?: ArtifactCleaner;
  now?: () => Date;
  requestLimit?: number;
};

function publicState(request: any) {
  if (!request) return { state: "none" };
  return {
    requestId: request.id,
    state: request.state,
    requestedAt: request.requestedAt,
    tokenExpiresAt: request.state === "requested" ? request.tokenExpiresAt : null,
    verifiedAt: request.verifiedAt,
    completedAt: request.completedAt,
    cancelledAt: request.cancelledAt,
    rejectedAt: request.rejectedAt,
    irreversible: request.state === "completed",
  };
}

export function createAccountRouter(dependencies: AccountRouteDependencies = {}) {
  const router = Router();
  const authenticate = dependencies.authenticate ?? authenticateToken;
  const store = dependencies.store ?? new PostgresAccountDeletionStore();
  const mailer = dependencies.mailer ?? {
    send: ({ to, token, expiresAt }) => emailService.sendEmail({
      to,
      subject: "Confirm deletion of your Octamy account",
      html: `<p>You requested permanent deletion of your Octamy learner account.</p><p>Verification token: <strong>${token}</strong></p><p>This token expires at ${expiresAt.toISOString()}. If this was not you, cancel the pending request in Octamy.</p>`,
    }),
  };
  const service = new AccountDeletionService(store, mailer, dependencies.cleaner ?? new LocalArtifactCleaner(), dependencies.now);
  const requestLimiter = rateLimit({
    windowMs: 60 * 60_000,
    limit: dependencies.requestLimit ?? 3,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => `learner:${req.user?.userId ?? req.ip}`,
    message: { message: "Too many account-deletion requests. Try again later.", code: "ACCOUNT_DELETION_RATE_LIMITED" },
  });
  const handler = (operation: (user: Express.User) => Promise<unknown>, successStatus = 200): RequestHandler => async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ message: "Access token required" });
      const result = await operation(req.user);
      res.setHeader("Cache-Control", "private, no-store");
      return res.status(successStatus).json(publicState((result as any)?.request ?? result));
    } catch (error) {
      if (error instanceof AccountDeletionError) return res.status(error.status).json({ message: error.message, code: error.code });
      console.error("account.deletion.error", error);
      return res.status(500).json({ message: "Account deletion could not be completed", code: "ACCOUNT_DELETION_FAILED" });
    }
  };

  router.get("/account/deletion", authenticate, handler((user) => service.current(user.userId)));
  router.post("/account/deletion", authenticate, requestLimiter, handler((user) => service.request({ userId: user.userId, email: user.email }), 202));
  router.post("/account/deletion/confirm", authenticate, async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ message: "Access token required" });
      const result = await service.confirm(req.user.userId, req.body?.token);
      res.setHeader("Cache-Control", "private, no-store");
      return res.json(publicState(result.request));
    } catch (error) {
      if (error instanceof AccountDeletionError) return res.status(error.status).json({ message: error.message, code: error.code });
      console.error("account.deletion.confirm.error", error);
      return res.status(500).json({ message: "Account deletion could not be completed", code: "ACCOUNT_DELETION_FAILED" });
    }
  });
  router.delete("/account/deletion", authenticate, handler((user) => service.cancel(user.userId)));
  return router;
}

export default createAccountRouter();
