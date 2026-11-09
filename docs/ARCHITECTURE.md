# NH-ERM Architecture

## Monorepo layout

```
NC-ERM/
├─ packages/
│  ├─ core/     @nh-erm/core   — pure domain: methodology, risk-scoring, import normalization
│  ├─ server/   @nh-erm/server — REST API, RBAC, audit, Excel import/export
│  └─ web/      @nh-erm/web     — bilingual RTL React app (official identity)
├─ prisma/      schema.prisma   — PostgreSQL data model
└─ docs/        specs
```

### Why this shape
- **`core` is pure and dependency-free** so the methodology (the riskiest, most
  scrutinized logic) is unit-tested in isolation and reused identically by the
  server, any batch job, and — if needed — the mobile app. It runs under Node's
  native type-stripping with **no build step** (`node --test`).
- **`server` owns I/O**: HTTP, DB (Prisma), Excel (exceljs), auth. It never
  re-implements methodology — it calls `core`.
- **`web` is a thin client** over the REST API, carrying only presentation +
  i18n/RTL.

## Technology choices (and the reasoning)

| Concern | Choice | Why |
|---|---|---|
| Language | TypeScript everywhere | One language front-to-back for a ~200-user internal app; lowers team friction. |
| Backend runtime | Node.js ≥ 22 | Native `.ts` type-stripping → no build step for server/core; built-in test runner. |
| DB | PostgreSQL + Prisma | Self-documenting schema; strong relational integrity for audit/soft-delete. |
| Excel | `exceljs` | Loads an existing template and writes **only data cells**, preserving styles, formulas, data validation, RTL — essential for §5/§17.1 fidelity. |
| Frontend | React + Vite | Fast dev loop; first-class RTL via `dir` on `<html>`; simple i18n. |
| Mobile | Responsive web + (future) wrapper/native | §11 requires both; the responsive app ships first, a standalone app reuses the same API. |

> The server deliberately uses Node's built-in `http` for the skeleton (no web
> framework dependency) so it boots with zero installs. Swap in Fastify/Express
> when middleware needs grow.

## Request → domain flow (risk assessment)

```
POST /api/risks ──► server/index.ts
        │               │  validate + RBAC (auth/rbac.ts)
        │               ▼
        │          core: assessRisk(input, methodology)
        │               │  aggregateImpact → computeInherent → controlAdequacy
        │               │  → residualPriority → levelForPriority → isTopRisk
        │               ▼
        │          core: syncTopRisk(prev, curr)  (on update/approve)
        │               ▼
        └──────►  persist (Prisma) + audit.append (append-only)
```

## Key design rules enforced in code
- **Soft delete only** (`deletedAt`) — active queries filter it; export excludes it. (§6)
- **Append-only audit** — `AuditStore` exposes only `append`/`search`. (§7)
- **Methodology is data** — all matrices live in a `Methodology` config object,
  versioned in `MethodologyConfig`. (§8)
- **New risks are staged** — created as `PENDING_APPROVAL`; top-risk status is
  computed only after a Department Manager approves. (§13)
- **Template fidelity** — export loads the official template and writes data
  cells only; it never rebuilds the workbook. (§5)

## Environments & hosting (§11)
Internal server (not external cloud). Standard server backup policy. Platform-only
accounts (no SSO). See `.env.example`.

## Build & run

```bash
npm install                 # workspaces
npm run test:core           # domain tests (no deps) — always runnable
npm run test:server         # RBAC + Excel round-trip (Excel tests skip if exceljs absent)
npm run dev:server          # API on :4000
npm run dev:web             # web on :5173 (proxies /api → :4000)
npx prisma migrate dev      # create the DB schema
```
