#!/usr/bin/env python3
"""
NH-ERM export — platform → official Excel template (§5).

Loads the official export template, writes the platform's risks back into the
"Risk Register" and "Top Risks" sheets in the exact official layout (header row 6,
data from row 7; top-risks header row 7, data from row 8), preserving the
template's own cell styles, then saves a new workbook to open & verify.

Writes back the ORIGINAL stored Arabic labels (fidelity, §3), reconstructs
"أولوية N" / "مستوى N", and leaves the broken IM#/LI# formula columns blank.

Usage: python3 -I scripts/export_to_template.py <template.xlsx> <risks.json> <out.xlsx>
"""
import sys, json
import openpyxl

# enum → original Arabic label (reverse of the import maps)
CTYPE_AR = {'preventive': 'وقائي', 'detective': 'كشفي', 'corrective': 'تصحيحي',
            'directive': 'توجيهي', 'none': 'لا يوجد'}
DOMAIN_KEYS = [
    'business_continuity', 'digital_transformation', 'cybersecurity', 'project_execution',
    'security_safety', 'graduation_readiness', 'regulatory_compliance', 'governance',
    'public_opinion', 'external_stakeholders', 'financial_sustainability', 'funding_budget',
    'beneficiary_cost', 'operational_losses', 'service_availability', 'care_quality',
    'supply_chains', 'serious_events', 'beneficiary_experience', 'non_communicable_diseases',
    'workforce_attraction', 'workforce_retention', 'profession_localization', 'employee_satisfaction',
]


def yn(v):
    return 'نعم' if v is True else ('لا' if v is False else None)


def set_cell(ws, row, col, value):
    """Set a value only (keeps the template cell's existing style)."""
    if value is not None:
        ws.cell(row=row, column=col).value = value


def write_register(ws, risks, first_row=7):
    for i, r in enumerate(risks):
        row = first_row + i
        set_cell(ws, row, 1, r.get('clusterGroup'))
        set_cell(ws, row, 2, r.get('clusterName'))
        set_cell(ws, row, 3, r.get('sector'))
        set_cell(ws, row, 4, r.get('department'))
        set_cell(ws, row, 5, r.get('owner'))
        set_cell(ws, row, 6, r.get('identDate'))
        set_cell(ws, row, 7, r.get('code'))
        set_cell(ws, row, 8, r.get('title'))
        set_cell(ws, row, 9, r.get('rootCauses'))
        set_cell(ws, row, 10, r.get('category'))
        set_cell(ws, row, 11, r.get('subCategory'))
        impacts = r.get('impacts') or {}
        for j, key in enumerate(DOMAIN_KEYS):
            set_cell(ws, row, 12 + j, impacts.get(key))
        # 36 IM# / 38 LI# left blank (were #REF!)
        set_cell(ws, row, 37, r.get('impactLabel'))
        set_cell(ws, row, 39, r.get('likelihoodLabel'))
        set_cell(ws, row, 40, r.get('inherentLabel'))
        set_cell(ws, row, 41, r.get('controlId'))
        set_cell(ws, row, 42, r.get('controlDescription'))
        set_cell(ws, row, 43, CTYPE_AR.get(r.get('controlType')))
        set_cell(ws, row, 44, yn(r.get('controlActivated')))
        set_cell(ws, row, 45, yn(r.get('controlShared')))
        set_cell(ws, row, 46, yn(r.get('controlComplied')))
        set_cell(ws, row, 47, yn(r.get('controlEffective')))
        set_cell(ws, row, 48, r.get('adequacyLabel'))
        if r.get('residualPriority') is not None:
            set_cell(ws, row, 49, f"أولوية {r['residualPriority']}")
        if r.get('residualLevel') is not None:
            set_cell(ws, row, 50, f"مستوى {r['residualLevel']}")
        set_cell(ws, row, 51, r.get('updateDate'))
        set_cell(ws, row, 52, r.get('lastUpdate'))
    return first_row + len(risks)  # next free row


def clear_rows(ws, start_row, end_row, cols):
    """Blank leftover template/filler rows so no fake data remains in the export."""
    for row in range(start_row, end_row + 1):
        for col in range(1, cols + 1):
            c = ws.cell(row=row, column=col)
            if c.value is not None:
                c.value = None


def write_top(ws, top, first_row=8):
    for i, t in enumerate(top):
        row = first_row + i
        set_cell(ws, row, 1, t.get('riskSource'))
        set_cell(ws, row, 4, t.get('identDate'))
        set_cell(ws, row, 5, t.get('code'))
        set_cell(ws, row, 8, t.get('category'))
        if t.get('residualLevel') is not None:
            set_cell(ws, row, 9, f"مستوى {t['residualLevel']}")
        set_cell(ws, row, 10, t.get('topRiskTheme'))
        set_cell(ws, row, 11, t.get('topRiskDescription'))
        set_cell(ws, row, 12, t.get('owner'))
        set_cell(ws, row, 14, t.get('mitigationPlanType'))
        set_cell(ws, row, 15, t.get('mitigationPlanDescription'))
        set_cell(ws, row, 16, t.get('mitigationOwner'))
        set_cell(ws, row, 18, t.get('expectedImplementationDate'))
        set_cell(ws, row, 19, t.get('status'))
        set_cell(ws, row, 20, t.get('completionPct'))
        set_cell(ws, row, 21, t.get('notes'))
    return first_row + len(top)


def main():
    template, risks_json, out = sys.argv[1], sys.argv[2], sys.argv[3]
    data = json.load(open(risks_json, encoding='utf-8'))
    wb = openpyxl.load_workbook(template)

    reg = wb['سجل المخاطر ']
    next_reg = write_register(reg, data['register'], first_row=7)
    clear_rows(reg, next_reg, reg.max_row, 52)

    top_ws = wb['أهم المخاطر']
    next_top = write_top(top_ws, data['topRisks'], first_row=8)
    clear_rows(top_ws, next_top, top_ws.max_row, 21)

    wb.save(out)
    print(f"Exported {len(data['register'])} register rows, {len(data['topRisks'])} top risks → {out}")


if __name__ == '__main__':
    main()
