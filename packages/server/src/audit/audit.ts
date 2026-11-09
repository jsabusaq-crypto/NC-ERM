/**
 * NH-ERM audit log (§7) — append-only interface.
 *
 * The audit log is independent of the risk change-log (§6) and is never updated
 * or deleted at the app layer. This module exposes only `append` and read/search;
 * there is deliberately no update/delete. Retention is permanent (§7).
 */

export type AuditKind =
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILURE'
  | 'LOGOUT'
  | 'SESSION_EXPIRED'
  | 'RISK_CREATE'
  | 'RISK_UPDATE'
  | 'RISK_DELETE'
  | 'RISK_RESTORE'
  | 'USER_CREATE'
  | 'USER_ACTIVATE'
  | 'EXPORT'
  | 'IMPORT'
  | 'METHODOLOGY_CHANGE';

export interface AuditEntry {
  kind: AuditKind;
  username?: string | null; // recorded even for failed logins (no user row)
  userId?: string | null;
  departmentId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
  ip?: string | null;
  at: Date;
}

export interface AuditSearch {
  userId?: string;
  departmentId?: string;
  kind?: AuditKind;
  from?: Date;
  to?: Date;
}

/** Append-only audit store. Implementations must forbid update/delete. */
export interface AuditStore {
  append(entry: Omit<AuditEntry, 'at'> & { at?: Date }): Promise<void>;
  search(query: AuditSearch, limit?: number): Promise<AuditEntry[]>;
}

/** In-memory reference implementation (dev/tests). Prod uses the Prisma AuditLog table. */
export class InMemoryAuditStore implements AuditStore {
  private entries: AuditEntry[] = [];

  async append(entry: Omit<AuditEntry, 'at'> & { at?: Date }): Promise<void> {
    this.entries.push({ ...entry, at: entry.at ?? new Date() });
  }

  async search(query: AuditSearch, limit = 500): Promise<AuditEntry[]> {
    return this.entries
      .filter((e) => (query.userId ? e.userId === query.userId : true))
      .filter((e) => (query.departmentId ? e.departmentId === query.departmentId : true))
      .filter((e) => (query.kind ? e.kind === query.kind : true))
      .filter((e) => (query.from ? e.at >= query.from : true))
      .filter((e) => (query.to ? e.at <= query.to : true))
      .slice(-limit)
      .reverse();
  }
}
