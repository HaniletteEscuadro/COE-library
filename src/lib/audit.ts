import { prisma } from "@/lib/prisma";
import type { AuditAction, AuditEntity } from "@/lib/enums";

/**
 * Platform audit trail.
 *
 * Distinct from `LoginEvent`: that one is the user-facing activity feed shown
 * in the admin dashboard, this one is the lower-level operational record
 * (imports, exports, access-denied decisions, config changes). They are kept
 * apart so flooding one does not bury the other.
 *
 * Never throws — an audit failure must not roll back the operation it records.
 */
export async function recordAuditLog(input: {
  actorId?: string | null;
  action: AuditAction;
  entity: AuditEntity;
  entityId?: string | null;
  message: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  /** Arbitrary structured context; serialised to JSON (SQLite has no JSON column). */
  metadata?: unknown;
}) {
  try {
    return await prisma.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId ?? null,
        message: input.message,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
        metadata: serializeMetadata(input.metadata),
      },
    });
  } catch (error) {
    console.error("[audit] failed to record audit log", error);
    return null;
  }
}

/** Safe JSON encode — circular structures must not break the caller. */
function serializeMetadata(metadata: unknown): string | null {
  if (metadata === undefined || metadata === null) return null;

  try {
    return JSON.stringify(metadata);
  } catch {
    return null;
  }
}

/** Decode a stored `metadata` string back into an object. */
export function parseAuditMetadata(metadata: string | null): unknown {
  if (!metadata) return null;

  try {
    return JSON.parse(metadata);
  } catch {
    return null;
  }
}
