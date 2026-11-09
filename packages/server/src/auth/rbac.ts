/**
 * NH-ERM RBAC (§12) — the OFFICIAL permission matrix (confirmed by the client).
 *
 * Two groups:
 *
 *  Group 1 — full permissions across the whole platform (all departments + full dashboard):
 *    • CLUSTER_CEO       الرئيس التنفيذي للتجمع
 *    • GRC_DIRECTOR      مدير الإدارة التنفيذية للحوكمة والمخاطر والالتزام
 *    • ERM_MANAGER       مدير إدارة المخاطر المؤسسية
 *
 *  Group 2 — full permissions for THEIR OWN department ONLY; cannot view other
 *  departments; dashboard shows their department only:
 *    • DEPUTY            النائب
 *    • DEPARTMENT_MANAGER مدير الإدارة
 *    • RISK_OWNER        مالك الخطر
 *    • MITIGATION_OWNER  مالك خطط التخفيف
 *    • RISK_CHAMPION     رائد الخطر
 *
 * Group-2 edits apply directly (no later approval). The only approval step is a
 * NEW risk's first entry into the register (§13), done by the department's
 * management level (DEPARTMENT_MANAGER / DEPUTY).
 */

export type RoleKey =
  // Group 1 — full platform
  | 'CLUSTER_CEO'
  | 'GRC_DIRECTOR'
  | 'ERM_MANAGER'
  // Group 2 — own department only
  | 'DEPUTY'
  | 'DEPARTMENT_MANAGER'
  | 'RISK_OWNER'
  | 'MITIGATION_OWNER'
  | 'RISK_CHAMPION';

export const GROUP1_ROLES: readonly RoleKey[] = ['CLUSTER_CEO', 'GRC_DIRECTOR', 'ERM_MANAGER'];
export const GROUP2_ROLES: readonly RoleKey[] = [
  'DEPUTY',
  'DEPARTMENT_MANAGER',
  'RISK_OWNER',
  'MITIGATION_OWNER',
  'RISK_CHAMPION',
];

/** Arabic / English display names. */
export const ROLE_LABELS: Record<RoleKey, { ar: string; en: string; group: 1 | 2 }> = {
  CLUSTER_CEO: { ar: 'الرئيس التنفيذي للتجمع', en: 'Cluster CEO', group: 1 },
  GRC_DIRECTOR: { ar: 'مدير الإدارة التنفيذية للحوكمة والمخاطر والالتزام', en: 'Executive GRC Director', group: 1 },
  ERM_MANAGER: { ar: 'مدير إدارة المخاطر المؤسسية', en: 'ERM Manager', group: 1 },
  DEPUTY: { ar: 'النائب', en: 'Deputy', group: 2 },
  DEPARTMENT_MANAGER: { ar: 'مدير الإدارة', en: 'Department Manager', group: 2 },
  RISK_OWNER: { ar: 'مالك الخطر', en: 'Risk Owner', group: 2 },
  MITIGATION_OWNER: { ar: 'مالك خطط التخفيف', en: 'Mitigation Plan Owner', group: 2 },
  RISK_CHAMPION: { ar: 'رائد الخطر', en: 'Risk Champion', group: 2 },
};

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

export interface Grant {
  capability: Capability;
  scope: 'all' | 'department';
}

const ALL_CAPS: Capability[] = [
  'user:create', 'user:deactivate', 'risk:create', 'risk:read', 'risk:update',
  'risk:delete', 'risk:restore', 'risk:approve', 'export:run', 'import:run',
  'audit:read', 'methodology:edit',
];

// Group 2 within their own department: full risk lifecycle + export of own dept.
const DEPT_CAPS: Capability[] = [
  'risk:create', 'risk:read', 'risk:update', 'risk:delete', 'risk:restore', 'export:run',
];

export const ROLE_CAPABILITIES: Record<RoleKey, Grant[]> = {
  // ── Group 1: everything, platform-wide ──────────────────────────────────
  CLUSTER_CEO: all(ALL_CAPS),
  GRC_DIRECTOR: all(ALL_CAPS),
  ERM_MANAGER: all(ALL_CAPS),

  // ── Group 2: own department only ────────────────────────────────────────
  // Management level also approves new risks (§13).
  DEPARTMENT_MANAGER: dept([...DEPT_CAPS, 'risk:approve']),
  DEPUTY: dept([...DEPT_CAPS, 'risk:approve']),
  // Operational roles: full CRUD within the department, but not the approval step.
  RISK_OWNER: dept(DEPT_CAPS),
  MITIGATION_OWNER: dept(DEPT_CAPS),
  RISK_CHAMPION: dept(DEPT_CAPS),
};

export interface Actor {
  userId: string;
  roles: RoleKey[];
  departmentId: string | null;
}

/** True if the actor belongs to Group 1 (full platform / full dashboard). */
export function isPlatformWide(actor: Actor): boolean {
  return actor.roles.some((r) => GROUP1_ROLES.includes(r));
}

/**
 * The data scope for list/dashboard reads:
 *  - 'all'       → Group 1 (whole cluster)
 *  - department  → Group 2 (own department only — dashboard & lists filtered)
 */
export function readScope(actor: Actor): { scope: 'all' | 'department'; departmentId: string | null } {
  return isPlatformWide(actor)
    ? { scope: 'all', departmentId: null }
    : { scope: 'department', departmentId: actor.departmentId };
}

/**
 * Filter a list of records to the actor's read scope: Group 1 sees everything,
 * Group 2 sees only records whose department matches their own. `deptOf` maps a
 * record to its department identifier.
 */
export function scopeRecords<T>(actor: Actor, records: T[], deptOf: (r: T) => string | null | undefined): T[] {
  const s = readScope(actor);
  if (s.scope === 'all') return records;
  return records.filter((r) => deptOf(r) === s.departmentId);
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
