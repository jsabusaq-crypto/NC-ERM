/**
 * NH-ERM RBAC (§12).
 *
 * 8 confirmed roles; the detailed permission matrix arrives from the client later,
 * so permissions are expressed as a configurable capability map. "Department user"
 * edits apply directly (no later approval); approval is required only for a new
 * risk's first entry (§13).
 */

export type RoleKey =
  | 'ERM_MANAGER'
  | 'CLUSTER_CEO'
  | 'DEPARTMENT_MANAGER'
  | 'RISK_OWNER'
  | 'DEPARTMENT_USER'
  | 'VIEWER'
  | 'AUDITOR'
  | 'SYSTEM_ADMIN';

export type Capability =
  | 'user:create' // create/activate platform accounts (§12)
  | 'user:deactivate'
  | 'risk:create'
  | 'risk:read'
  | 'risk:update'
  | 'risk:delete' // soft delete (§6)
  | 'risk:restore'
  | 'risk:approve' // approve a pending new risk (§13)
  | 'export:run'
  | 'import:run'
  | 'audit:read' // audit search/filter screen (§7)
  | 'methodology:edit'; // change matrices (§8)

/** Whether a capability is scoped to the actor's own department. */
export interface Grant {
  capability: Capability;
  scope: 'all' | 'department';
}

/**
 * Default capability map. ⚠ Replace with the official permission matrix when received.
 * `department` scope means "only within the actor's own department".
 */
export const ROLE_CAPABILITIES: Record<RoleKey, Grant[]> = {
  ERM_MANAGER: all([
    'user:create', 'user:deactivate', 'risk:create', 'risk:read', 'risk:update',
    'risk:delete', 'risk:restore', 'risk:approve', 'export:run', 'import:run',
    'audit:read', 'methodology:edit',
  ]),
  CLUSTER_CEO: all([
    'risk:create', 'risk:read', 'risk:update', 'risk:delete', 'risk:restore',
    'risk:approve', 'export:run', 'audit:read',
  ]),
  DEPARTMENT_MANAGER: [
    ...dept(['risk:create', 'risk:read', 'risk:update', 'risk:delete', 'risk:restore', 'risk:approve', 'export:run']),
  ],
  RISK_OWNER: dept(['risk:create', 'risk:read', 'risk:update']),
  // §12: department-user edits apply directly (no later approval), but NOT risk:approve.
  DEPARTMENT_USER: dept(['risk:create', 'risk:read', 'risk:update']),
  VIEWER: all(['risk:read']),
  AUDITOR: all(['audit:read', 'risk:read']),
  SYSTEM_ADMIN: all(['audit:read', 'user:create', 'user:deactivate']),
};

export interface Actor {
  userId: string;
  roles: RoleKey[];
  departmentId: string | null;
}

/** Check whether an actor may perform a capability, optionally on a target department. */
export function can(actor: Actor, capability: Capability, targetDepartmentId?: string): boolean {
  for (const role of actor.roles) {
    for (const grant of ROLE_CAPABILITIES[role] ?? []) {
      if (grant.capability !== capability) continue;
      if (grant.scope === 'all') return true;
      if (
        grant.scope === 'department' &&
        actor.departmentId &&
        (!targetDepartmentId || targetDepartmentId === actor.departmentId)
      ) {
        return true;
      }
    }
  }
  return false;
}

function all(caps: Capability[]): Grant[] {
  return caps.map((capability) => ({ capability, scope: 'all' as const }));
}
function dept(caps: Capability[]): Grant[] {
  return caps.map((capability) => ({ capability, scope: 'department' as const }));
}
