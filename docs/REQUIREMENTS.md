# NH-ERM — Engineering Requirements Specification

> **Project:** NH-ERM — Enterprise Risk Management platform for **Najran Health Cluster** (تجمع نجران الصحي)
> **Status:** Consolidated reference spec, translated and restructured from the Arabic
> "مستند المتطلبات الشامل" (Comprehensive Requirements Document, dated Nov 9, 2026).
> **Audience:** Development team / coding tools. This is the single source of truth for scope.

This document is an English engineering restatement of the client's Arabic requirements.
Where the Arabic document leaves a value unstated (typically because it lived in an Excel
table that must be read from the official files), this spec marks it **`⚠ VERIFY`** and the
code treats it as configuration, not a hardcoded constant.

---

## 1. Overview & Scope

NH-ERM is the unified **Enterprise Risk Management (ERM)** system for Najran Health Cluster.
Its purpose is to digitize the cluster's current Excel-based risk register into an integrated
platform.

- The **original mandatory annex** (the client's official Excel template + methodology PDF) is
  the formal basis of the design and **must be embedded in the architecture and database from
  the start**.
- Expected users: **~200** across the cluster. This number drives server capacity and
  performance sizing (confirmed by client).
- Migration volume: **≤ 200 rows per sheet** (confirmed). Drives import/filter performance design.

---

## 2. Visual Identity & Design

| Token | Value | Usage |
|---|---|---|
| `--brand-primary` | `#0096DD` | Corporate blue — page headers, primary buttons |
| `--brand-accent` | `#00AFEE` | Light blue — highlights, secondary elements |
| `--brand-tint` | `#B6E0F6` | Very light tint — soft backgrounds, subtle emphasis |
| Backgrounds | white / light grey | Base surfaces |
| Font | **Janna LT** | All platform pages |

- **Full RTL** support in tables, dialogs, reports, and every UI element.
- **Fully bilingual (Arabic / English)** — switching language flips both language **and**
  direction (RTL ↔ LTR) automatically (confirmed).
- The same identity extends to **exported Excel and PDF** files — they must look like part of a
  single integrated identity.

Colors were extracted from the received official logo. See `packages/web/src/theme/`.

---

## 3. Risk Register Import / Sync

**Core requirement:** the platform is a **full bidirectional** import/export tool —
Excel → platform **and** platform → Excel, in the **same official identity and format both
directions**. It is **not** a one-time initial import (per client clarification).

### Import pipeline
1. **Before import** — analyze every worksheet; understand column names and order, formulas,
   dropdown lists, and formatting used.
2. **During import** — preserve the original risk numbers and content **without any change**;
   do **not** modify or re-design the official template. Critically:
   - Any cell containing a **formula error** (e.g. `#REF!`, `#NAME?`) **or** a leftover default
     template placeholder (e.g. `"Unidentified"`, `"خطأ في التقييم"` / "evaluation error")
     is treated as a **completely empty cell** on import and is **not** written as literal text
     to the database. *(See `EMPTY_EQUIVALENT_VALUES` in core config.)*
   - Migration volume ≤ 200 rows/sheet.
3. **After import** — produce a report: # risks imported, # duplicates, # missing fields, # errors —
   for the responsible team to review **before final approval**.

### Confirmed template structure (from the two received files)
The official template (the unified Holding Health Company template used across all 20 health
clusters) has **9 worksheets**:

1. **Introduction** (المقدمة)
2. **Terminology** (مصطلحات) — a dictionary of 15+ approved terms
3. **References** (المراجع) — fill-in lists: cluster names, departments, sectors
4. **Dashboard** (لوحة المعلومات)
5. **Risk Register** (سجل المخاطر) — **57 columns** — the official register
6. **Top Risks** (أهم المخاطر) — **21 columns**
7. **Analytics** (التحليلات)
8. **New Risks** (المخاطر الجديدة) — **57 columns** — staging area for risks before approval (see §7)
9. **Standards / Criteria** (المعايير) — all methodology tables, matrices, reference lists

The **57 Risk Register columns** span, in order: identification data (cluster, department,
owner, risk code) → **24 impact-domain assessment columns** → likelihood, aggregated impact,
inherent score → the **4 control fields** → control-environment adequacy → residual priority &
level → date and details of last update.

---

## 4. Relationship: Risk Register ↔ Top Risks

A foundational rule governing synchronization of the two sheets:

1. Every risk is **first recorded in the main Risk Register**.
2. A risk appears in **Top Risks only if** its **residual level is Level 1 or Level 2**
   (i.e. **priority 1–7** per the approved residual matrix — see §8).
3. The risk **always stays in the main register**; it is **never deleted** from it when it is
   added to or removed from Top Risks.
4. If the level drops out of Level 1/2, the risk is **removed from Top Risks in the next export**,
   while **retaining the history** of its prior presence there.
5. If an ordinary risk's level rises into Level 1/2, it is **automatically added** to Top Risks.
6. The inclusion/removal threshold (**priority 1–7**) is **configurable** for the future if the
   official methodology changes.
7. **No duplicate** of the same risk within a single sheet.
8. The **unique risk code** is the join key between the two sheets.

---

## 5. Export & Official Templates

- **Official export template:** an approved **empty Excel template** will be received and is the
  **only** official export template — fully preserving sheet/column names & order, formatting,
  colors, logo, formulas, dropdowns & data validation, and RTL. The output matches the original
  as closely as possible; it is **not** a new design.
- **Empty register for migration:** confirmed — there is **no separate blank Excel file**; the
  approved export/migration destination is the **same official "Risk Register" sheet** in the
  template received from Holding Health Company. Platform risks are copied into it on each export
  or update, with identical identity/format, **data transfer only**.
- **Official report template:** an approved report template will be received for any other reports
  requested in future.
- **Export options:** all risks · top risks · a specific department's risks · risks by level ·
  risks by period · the full register after update.

---

## 6. Change Management & Soft Delete

- On any add / edit / delete of a risk, immediately update: database, dashboard, risk level
  (when needed), Top Risks list (per approved conditions), and related reports.
- Each change records: the user who performed it, date & time, old & new values, and the reason
  for edit/delete when needed.
- Deletion is **logical (Soft Delete)**, never permanent: the risk disappears from active records
  and the current export, while **fully retaining its historical record** and allowing restoration
  per permissions.

---

## 7. Audit Log

Separate from the risk-data change log (§6), the platform keeps an **independent, append-only,
non-editable, non-deletable** audit log covering:

- **Login log:** every login attempt (success or failure) — username, date/time, logout/session end.
- **Modification log:** every add/edit/delete/restore — user, date/time, old & new values.
- A **search & filter screen** for the system admin: by user, date, department, operation type.
- **Retention:** audit log and soft-deleted data are kept **permanently**, until an explicit
  request to delete/modify — **not** auto-deleted after any period (confirmed).

---

## 8. Risk Assessment Methodology

The full official methodology was received (from the "Standards/المعايير" Excel sheet and the
attached PDF). The calculation engines are built **exactly** per these tables and kept
**configurable** for future methodology changes.

### 8.1 Likelihood scale (1–5)
Integer 1–5.

### 8.2 Impact scale (1–5) across 24 domains
Impact is assessed across **24 sub-domains**: business continuity, digital transformation,
cybersecurity, project execution, security & safety, cluster graduation readiness, regulatory
compliance, governance, public-opinion interactions, external stakeholders, financial
sustainability, funding & budget, beneficiary cost, operational losses, availability of health
services, quality of healthcare, supply chains, serious/sentinel events, beneficiary experience,
non-communicable diseases, workforce attraction, workforce retention, profession localization,
employee satisfaction.

Each applicable domain receives a 1–5 score; the final **aggregated impact** is computed
automatically (the `IM#`/Impact columns in the register).

> **`⚠ VERIFY` — aggregation rule.** The Arabic doc states the aggregated impact is computed
> automatically but does not give the formula in the extracted text. Default implemented:
> **aggregated impact = max of the per-domain scores** (worst-case, the common ERM convention).
> Configurable via `methodology.impactAggregation` (`max` | `average` | `sum-capped`). **Confirm
> against the official المعايير sheet.**

### 8.3 Inherent risk matrix (Likelihood × Impact)
`inherent = likelihood × impact` (range 1–25), classified into bands:

| Band | Color |
|---|---|
| Very low (منخفض جداً) | very light green |
| Low (منخفض) | green |
| Medium (متوسط) | yellow |
| High (عالي) | orange |
| Critical (حرج) | red |

> **`⚠ VERIFY` — band ranges.** The exact numeric cut-offs live in the official matrix table
> (not in extracted text). Implemented as a configurable range table seeded with a documented
> default (see `methodology.inherentBands`). **Confirm against official matrix.**

### 8.4 Control-environment adequacy (5 levels)
**Excellent, Acceptable, Neutral, Unacceptable, Weak** — derived from **4 questions** in the
register: controls activated/approved, shared & applied, fully complied with, and effective
without failures.

> **`⚠ VERIFY` — derivation rule.** 4 yes/no answers → one of 5 levels. The exact mapping is in
> the official methodology; implemented as a configurable scoring rule (count of "yes" → level)
> seeded with a documented default. **Confirm against official methodology.**

### 8.5 Residual risk & priority matrix (25 priorities)
The intersection of **inherent band (5)** × **control adequacy (5)** yields **25 priorities**.
The 25 priorities group into **5 final colored levels** (**explicitly given, encoded directly**):

| Final level | Priority range | Color |
|---|---|---|
| Level 1 | 1–3 | red |
| Level 2 | 4–7 | orange |
| Level 3 | 8–12 | yellow |
| Level 4 | 13–17 | green |
| Level 5 | 18–25 | very light green |

> **`⚠ VERIFY` — the 5×5 → priority(1–25) grid.** The mapping of each (inherent, control) cell
> to a specific 1–25 priority is the official grid (table, not in extracted text). Implemented as
> a configurable 5×5 lookup seeded with a documented monotonic default. **Confirm against the
> official matrix.** The level grouping above is taken verbatim from the doc.

### 8.6 Top-Risks inclusion rule (numerically confirmed)
Per the official term definition: **only residual risks in Level 1 or 2 (priority 1–7)** are
included in the Top Risks sheet/list. Resolves §4 with full numeric precision.

### 8.7 Control types & response plans
- **Control types:** preventive, detective, corrective, directive, none.
- **Control nature:** manual, automated, hybrid, none.
- **Risk response plans:** Treat, Tolerate, Transfer, Terminate.

Auto-calculation engines and Top-Risks inclusion/removal rules are built per these confirmed
tables, kept configurable for future methodology changes.

---

## 9. KRIs & KPIs

- **Treatment-plan indicators (KRIs):** track each corrective action with its owner, deadline,
  completion %, and overdue status, with alerts when a deadline nears or passes. Alerts go via
  **both** channels together: **email + in-platform notification** (confirmed).
- **Department performance indicators (KPIs):** adherence to deadlines for raising/updating the
  register, delay % per department, and department-vs-department comparison.
- Exact indicator details (formulas, thresholds, responsibilities) will arrive from the client later.

---

## 10. Dashboard

- Clear, accurate charts that **auto-update immediately** on any add/edit to risk data
  (fully dynamic, not a static snapshot).
- Shows: risk distribution by level and department, treatment-plan completion (KRIs), and
  department deadline-adherence (KPIs).
- Design and colors match the cluster's visual identity (corporate blue — see §2).

---

## 11. Technical Environment & Hosting

- **Hosting:** an **internal server** at the cluster / holding company (not external cloud) — confirmed.
- **Login:** **independent platform accounts** created & activated inside the platform by the
  **"ERM Manager"** role — **no** integration with an HR system or SSO. This simplifies the build
  and removes dependency on the cluster's IT infrastructure (client correction/confirmation).
  **No one may enter the platform without an account and password.**
- **Mobile access:** **both** required — a responsive site (mobile browser) **and** a standalone
  mobile app (confirmed).
- **Backup / DR (RPO/RTO):** no specific requirements currently from cluster IT (confirmed) —
  apply the internal server's standard backup policies by default.

---

## 12. Roles & Access Control (RBAC)

- The detailed permission matrix will be sent later; the confirmed roles so far are preliminary.
- **"Department user"** edits (roles with "full permissions within the department") are applied
  **directly, without later approval** — approval is required **only** when a **"New Risk"** is
  entered for the first time (see §7 workflow).
- **Account creation & login:** adding and approving new users happens **inside the platform
  itself** by a user with the **"ERM Manager"** role (Group 1, full permissions). Independent
  platform accounts (email/username + password created inside the platform when each employee is
  activated). No HR/SSO linkage.

### Approved organizational structure (Najran Health Cluster)
The signed org chart was received (signed by Khalid bin Ayed Al-Asiri, CEO of Najran Health
Cluster) and defines the full approval hierarchy:

- **Holding Health Company** — top institutional level (founding council, company CEO, governance
  committees). **Outside NH-ERM scope.**
- **Najran Health Cluster** — cluster CEO (holder of full platform permissions).
- **Sector** — **8 main sectors** directly under the cluster CEO.
- **Department / Division** — each sector contains several departments; this is the level of
  **"Department Manager"** and **"Risk Owner"**, and is the same as the
  **"Department/Division/Unit name"** field in the register.
- **(Healthcare-delivery sector only) Facility** — reference hospitals → peripheral hospitals /
  primary-care centers, plus clinical specialty tracks (emergency, cardiac, critical care)
  applied cluster-wide.

> **`⚠ VERIFY` — "Deputy" level.** The signed structure did not show a standalone "Deputy"
> (النائب) organizational level; likely means "Deputy Department Manager" at level 4. **Confirm.**

---

## 13. New-Risk Approval Workflow

**3 steps, one decision.** A new risk raised by an employee does **not** enter the official
register directly; it stays **"Pending approval"** until the Department Manager approves it — only
then is its level computed and it appears in Top Risks if it qualifies.

Confirmed from the received Excel file: this matches the real, separate **"New Risks before
adding to the detailed register"** sheet in the official template — used as a **staging area** for
pending risks before they are actually migrated into the "Risk Register" sheet after the
Department Manager's approval.

> If additional cluster-level approval levels exist, the org chart defines the full chain. Encode
> the chain as configurable workflow steps.

---

## 14. Expected Client-Delivered Files & Templates

- **File 1 (`562be583`)** — current data (**173 actual Najran risks**).
- **File 2 (`695a1150`)** — final migration destination (the official template).
- Official **logo**.
- Official **report template (Word)**.
- Signed **organizational structure**.

---

## 15. Open Points Needing Decision

- Risk classification: an internal Holding-Health-Company system (24 main & sub risk domains),
  confirmed from "Standards" sheet + PDF — **not** directly tied to CBAHI or ISO 31000.
- Impact aggregation formula (§8.2) — `⚠ VERIFY`.
- Inherent band numeric ranges (§8.3) — `⚠ VERIFY`.
- Control adequacy derivation (§8.4) — `⚠ VERIFY`.
- 5×5 → priority grid (§8.5) — `⚠ VERIFY`.
- "Deputy" org level (§12) — `⚠ VERIFY`.
- KRI/KPI exact formulas & thresholds (§9) — pending from client.

---

## 16. Mandatory Acceptance Scenarios

The Excel integration unit is **not** accepted merely because a file downloads; it is accepted
only after the following scenarios are actually tested and their results documented:

1. Add an **ordinary** risk → appears in the Risk Register **only**.
2. Add a **high** risk → appears in **both** the register and Top Risks.
3. **Raise** an ordinary risk's level → auto-added to Top Risks.
4. **Lower** a high risk's level → removed from Top Risks **without** deleting it from the main register.
5. **Edit** a risk's data → export updates immediately.
6. **Delete** a risk from the UI → disappears from the current export while retaining history (Soft Delete).
7. **Export all** → no risk, column, formula, or essential formatting lost.
8. **Re-open** the resulting Excel file → fully intact.
9. **Compare** risk counts in the DB vs. the Excel sheets.

These map to automated tests in `packages/core/test/` (scoring/inclusion logic) and
`packages/server/src/excel/` (round-trip fidelity). See `docs/ACCEPTANCE.md`.

---

## 17. Non-Negotiable Constraints (build summary)

1. Export in the **exact** Holding-Company identity & format — **no** change to appearance.
2. Migration cap **200 rows/sheet**; any cell with a formula error or default placeholder
   (`#REF!`, `#NAME?`, `Unidentified`) is treated as an **empty cell**.
3. **Soft Delete only**, with permanent retention of history.
4. Full **bilingual (AR/EN)** UI with **RTL/LTR** support.
5. **Platform-only accounts** — no HR/SSO integration.
6. Hosting on an **internal server**.
7. Full **mobile access**: responsive site + standalone app.
8. Reference capacity: **~200 users**.
9. Official colors `#0096DD` / `#00AFEE` / `#B6E0F6`, **Janna LT** font.

### Suggested build order (hardest/riskiest first)
1. **Import/Export PoC** — exact fidelity to the official Risk Register template (hardest technical point).
2. **Auth & RBAC** — 8 confirmed roles, platform-only accounts, created by the ERM Manager.
3. **New-risk approval workflow.**
4. **Risk assessment engine** — inherent matrix, control-environment, residual/priority matrix, Top-Risks linkage.
5. **Full audit log + Soft Delete.**
6. **KRIs/KPIs & alerts** (email + in-platform).
7. **Interactive dashboard** in the official identity.
