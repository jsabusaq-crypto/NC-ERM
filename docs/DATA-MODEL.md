# NH-ERM Data Model

Full schema: [`prisma/schema.prisma`](../prisma/schema.prisma). This note explains
how the official 9-sheet / 57-column template maps onto the relational model.

## The 57-column Risk Register → relational model

The official register is **one wide sheet of 57 columns**. Storing 57 scalar
columns would be brittle (24 of them are near-identical impact domains). Instead:

| Register columns (§3 order) | Modeled as |
|---|---|
| Identification (cluster, department, owner, code, title) | `Risk` scalar fields + `Department` relation |
| **24 impact-domain columns** | `RiskImpact` rows (`riskId`, `domainKey`, `score`) — one per applicable domain |
| Likelihood, aggregated impact, inherent score | `Risk.likelihood`, `Risk.aggregatedImpact`, `Risk.inherentScore` (computed) |
| 4 control questions | `Risk.controlActivated/Shared/Complied/Effective` (booleans) |
| Control adequacy | `Risk.controlAdequacy` (computed enum) |
| Residual priority & level | `Risk.residualPriority`, `Risk.residualLevel` (computed) |
| Last-update date & details | `Risk.updatedAt` + change log |

The **exact 57-column order and headers** for export fidelity live in
[`packages/server/src/excel/column-map.ts`](../packages/server/src/excel/column-map.ts),
not in the DB shape — so the DB can stay normalized while exports remain byte-faithful
to the template.

### Computed vs. stored
`aggregatedImpact`, `inherentScore`, `inherentBand`, `controlAdequacy`,
`residualPriority`, `residualLevel`, `isTopRisk` are **derived** by `@nh-erm/core`
and **persisted** for query/export performance. They are recomputed on every
create/update/approve and must never be hand-edited.

## Sheet → model mapping (9 sheets)

| Template sheet | Model(s) |
|---|---|
| Introduction | — (static) |
| Terminology | reference data (seed) |
| References (clusters/departments/sectors) | `Cluster`, `Sector`, `Department` |
| Dashboard | derived at query time (§10) |
| **Risk Register** | `Risk` (status `ACTIVE`) + `RiskImpact` |
| Top Risks | `Risk` where `isTopRisk = true` (projection, §4) |
| Analytics | derived |
| **New Risks** (staging) | `Risk` (status `PENDING_APPROVAL`, §7/§13) |
| Standards / Criteria | `MethodologyConfig` (the matrices as JSON, §8) |

## Lifecycle & integrity

- **Soft delete** — `Risk.deletedAt`. Active = `deletedAt IS NULL`. (§6)
- **Change log** — `ChangeLog` rows: user, action, field, old/new, reason. (§6)
- **Audit log** — `AuditLog`, append-only; logins + modifications; permanent retention. (§7)
- **Top-risk history** — `TopRiskHistory` keeps added/removed events even after
  a risk leaves Top Risks. (§4.4)
- **Unique risk code** — `Risk.code @unique` is the cross-sheet join key. (§4.8)

## RBAC tables
`Role` (8 `RoleKey`s), `User` (platform-only credential, `isActive`, `createdBy`),
`UserRole` join. Capability resolution is in
[`packages/server/src/auth/rbac.ts`](../packages/server/src/auth/rbac.ts) and is
replaced by the official permission matrix when received. (§12)

## Methodology config
`MethodologyConfig.config` is the JSON form of the `Methodology` object in
[`packages/core/src/methodology.ts`](../packages/core/src/methodology.ts), versioned
and activatable so matrices stay configurable. (§8)
