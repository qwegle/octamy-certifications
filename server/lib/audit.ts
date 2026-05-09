import { Request } from 'express';
import { db } from '../db';
import { auditLogs } from '@shared/schema';

type AuditInput = {
  action: string;
  userId?: number | null;
  actorEmail?: string | null;
  actorRole?: string | null;
  resourceType?: string | null;
  resourceId?: string | number | null;
  metadata?: Record<string, any> | null;
  status?: 'success' | 'failure';
  req?: Request;
};

function getIp(req?: Request): string | null {
  if (!req) return null;
  const fwd = req.header('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return (req.ip || req.socket?.remoteAddress || null) ?? null;
}

/**
 * Append an entry to the audit_logs table. Fire-and-forget — never throws.
 * Use for: auth events, admin actions, payments, refunds, role/plan changes,
 * data exports, and anything compliance/forensics may need to reconstruct.
 */
export async function audit(input: AuditInput): Promise<void> {
  try {
    const actor = (input.req as any)?.user || (input.req as any)?.seller || null;
    await db.insert(auditLogs).values({
      userId: input.userId ?? actor?.userId ?? actor?.sellerId ?? null,
      actorEmail: input.actorEmail ?? actor?.email ?? null,
      actorRole: input.actorRole ?? (actor?.isAdmin ? 'admin' : actor ? 'user' : 'system'),
      action: input.action,
      resourceType: input.resourceType ?? null,
      resourceId: input.resourceId != null ? String(input.resourceId) : null,
      ip: getIp(input.req),
      userAgent: input.req?.header('user-agent') || null,
      metadata: input.metadata ?? null,
      status: input.status ?? 'success',
    });
  } catch (err) {
    // Never let audit failure break the user request.
    console.error('[audit] failed to record', input.action, err);
  }
}
