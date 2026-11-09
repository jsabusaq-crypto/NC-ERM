# NH-ERM Acceptance Criteria & Test Mapping

The Excel integration is accepted only after the §16 scenarios are tested and
documented. This table maps each mandatory scenario to its automated test(s).

| # | Scenario (§16) | Covered by | Status |
|---|---|---|---|
| 1 | Add an ordinary risk → appears in Register only | `core/test/risk-scoring.test.ts` → "Scenario 1" | ✅ automated |
| 2 | Add a high risk → appears in Register **and** Top Risks | `core` → "Scenario 2" | ✅ automated |
| 3 | Raise an ordinary risk → auto-added to Top Risks | `core` → "Scenario 3" (+ `syncTopRisk`) | ✅ automated |
| 4 | Lower a high risk → removed from Top Risks, kept in Register | `core` → "Scenario 4" | ✅ automated |
| 5 | Edit a risk → export updates immediately | server `PUT /api/risks/:id` recomputes + re-exports | ⚙️ integration (API wired; e2e pending template) |
| 6 | Delete from UI → gone from export, history kept (Soft Delete) | server `DELETE` sets `deletedAt`; export filters it | ⚙️ integration |
| 7 | Export all → no risk/column/formula/format lost | `server/src/excel/excel-roundtrip.test.ts` → "round-trip" | ✅ automated* |
| 8 | Re-open exported file → fully intact | same round-trip test (re-loads buffer) | ✅ automated* |
| 9 | Compare DB counts vs. Excel sheet counts | round-trip test asserts `importedCount` | ✅ automated* |

\* Excel tests run when `exceljs` is installed; they **skip gracefully** otherwise
(they do not fake a pass). The final sign-off run must execute them against the
**real client template** (`695a1150`) and the **real current data** (`562be583`),
not the synthetic fixtures.

## Running the tests

```bash
npm run test:core     # scenarios 1–4, methodology, import normalization (no deps)
npm run test:server   # RBAC + Excel round-trip (scenarios 7–9)
```

## Remaining for full acceptance (needs client files §14)
- Replace the synthetic template in the round-trip test with the official
  `695a1150` template; confirm the real header strings in `column-map.ts`.
- Run scenarios 5 & 6 end-to-end through the API with a live DB.
- Verify exported formulas, dropdowns, data validation, logo, and RTL survive a
  real template round-trip (manual visual check + automated style assertions).
- Confirm every `⚠ VERIFY` methodology value (REQUIREMENTS.md §15) against the
  official المعايير sheet before go-live.
