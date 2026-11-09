# NH-ERM — Najran Health Cluster Enterprise Risk Management

> منصة NH-ERM لإدارة المخاطر المؤسسية — تجمع نجران الصحي

Digitizes the cluster's Excel-based risk register into an integrated platform:
bidirectional Excel import/export in the official Holding-Company identity, a
configurable 5×5 risk-assessment engine, RBAC, append-only audit, soft delete,
bilingual (AR/EN) RTL UI, and a dynamic dashboard.

📄 **Full spec:** [`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md) · **Architecture:**
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) · **Data model:**
[`docs/DATA-MODEL.md`](docs/DATA-MODEL.md) · **Acceptance:**
[`docs/ACCEPTANCE.md`](docs/ACCEPTANCE.md)

## What's in this foundation

| Area | Location | State |
|---|---|---|
| **Risk-scoring engine** (§8) — inherent/residual matrices, control adequacy, Top-Risks rule | `packages/core/src/risk-scoring.ts`, `top-risks-sync.ts` | ✅ implemented + **22 passing tests** |
| **Methodology config** (§8) — matrices as editable data, `⚠ VERIFY` defaults | `packages/core/src/methodology.ts` | ✅ |
| **Import normalization** (§3) — error cells/placeholders → blank | `packages/core/src/import-normalize.ts` | ✅ tested |
| **Excel import/export** (§3, §5) — template-fidelity, 200-row cap, review report | `packages/server/src/excel/` | ✅ implemented (+ round-trip tests) |
| **Data model** (§3, §6, §7, §12) — 57-col register, audit, soft delete, RBAC | `prisma/schema.prisma` | ✅ schema |
| **REST API skeleton** — risk lifecycle, approval workflow, soft delete, audit | `packages/server/src/index.ts` | ✅ boots & runs (in-memory store) |
| **RBAC** (§12) — 8 roles, capability map | `packages/server/src/auth/rbac.ts` | ✅ tested |
| **Audit log** (§7) — append-only store | `packages/server/src/audit/audit.ts` | ✅ |
| **Web shell** (§2, §10) — bilingual RTL, official colors/font, dashboard | `packages/web/` | ✅ scaffold |

## Quick start

```bash
npm install            # installs workspace deps (see note below)

npm run test:core      # ✅ runs today with no external deps — 22 tests
npm run test:server    # RBAC tests + Excel round-trip (Excel tests need exceljs)

npm run dev:server     # API on http://localhost:4000  (in-memory store, no DB needed)
npm run dev:web        # web on http://localhost:5173  (proxies /api → :4000)

npx prisma migrate dev # create the PostgreSQL schema (needs DATABASE_URL)
```

`packages/core` and the API server run under **Node ≥ 22's native TypeScript
type-stripping — no build step**.

### ⚠ Dependency install note
This repo's own domain logic (`@nh-erm/core`) and the API server run with **zero
third-party packages**. Two packages are needed for the rest:
- `exceljs` — Excel import/export
- `react` / `vite` — the web app

If `npm install` cannot reach the registry in your environment, install those in
a network-enabled environment, or add the install to the cloud environment's
**setup script** so it runs on each session start. The Excel tests **skip
gracefully** (they do not fake a pass) until `exceljs` is present.

## Build order (from the client's priority, §17)
1. Excel import/export PoC — exact template fidelity *(hardest; core logic done)*
2. Auth & RBAC — 8 roles, platform-only accounts
3. New-risk approval workflow *(API wired)*
4. Risk-assessment engine *(done + tested)*
5. Audit log + soft delete *(schema + store done)*
6. KRIs/KPIs & alerts (email + in-platform)
7. Interactive dashboard in the official identity *(shell done)*

## Non-negotiable constraints (§17)
Exact Holding-Company export identity · 200-row/sheet cap · error cells → blank ·
soft delete only (permanent history) · full AR/EN + RTL/LTR · platform-only
accounts (no SSO) · internal-server hosting · responsive web + standalone mobile ·
~200 users · colors `#0096DD`/`#00AFEE`/`#B6E0F6` · Janna LT.

## Open items needing client confirmation
See [`docs/REQUIREMENTS.md` §15](docs/REQUIREMENTS.md#15-open-points-needing-decision).
Every `⚠ VERIFY` value in `methodology.ts` is a documented default standing in for
an official-matrix cell that must be confirmed against the "المعايير / Standards"
sheet + methodology PDF before go-live.
