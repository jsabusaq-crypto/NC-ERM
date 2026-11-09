#!/usr/bin/env python3
"""
NH-ERM migration extractor (§3).

Reads the official Holding-Company Excel file and extracts the current risks from
three sheets — Risk Register (سجل المخاطر), Top Risks (أهم المخاطر), and New Risks
(المخاطر الجديدة) — into a clean JSON for the platform, plus a migration report.

Rules honored (REQUIREMENTS.md §3):
  - header row = 6, data starts row 7 (register/new); top-risks header row 7, data 8
  - cells with formula errors (#REF!, #NAME?…) or placeholders (Unidentified,
    خطأ في التقييم) are treated as EMPTY, never stored as literal text
  - a row is skipped entirely when its risk code is empty-equivalent (filler rows)
  - Arabic scale labels are mapped to the 1–5 scale; priority/level integers are
    extracted from "أولوية N" / "مستوى N" (Arabic-Indic digits folded)

Usage:  python3 -I scripts/extract_risks.py <file.xlsx> [out.json]
"""
import sys, json, re, datetime
import openpyxl

EMPTY_EQUIVALENT = {
    "#ref!", "#name?", "#value!", "#div/0!", "#n/a", "#null!", "#num!",
    "unidentified", "خطأ في التقييم", "غير محدد",
}

# ── Arabic label → scale maps (confirmed from the real file) ──────────────────
def norm(s):
    if s is None:
        return ""
    out = []
    for ch in str(s):
        o = "٠١٢٣٤٥٦٧٨٩".find(ch)
        out.append(str(o) if o >= 0 else ch)
    t = "".join(out)
    t = re.sub(r"[ً-ْـ]", "", t)  # harakat + tatweel
    t = re.sub(r"[أإآٱ]", "ا", t)                # alef variants
    t = t.replace("ة", "ه").replace("ى", "ي")    # teh marbuta, alef maqsura
    return re.sub(r"\s+", " ", t).strip()

LIKELIHOOD = {"مستبعد حدوثه": 1, "مستبعد": 1, "نادر": 2, "محتمل": 3, "غالبا": 4, "شبه مؤكد": 5}
IMPACT = {"ضئيل": 1, "قليل": 2, "متوسط": 3, "مرتفع": 4, "مرتفع جدا": 5}
INHERENT = {"منخفض جدا": "very_low", "منخفض": "low", "متوسط": "medium", "عالي": "high", "حرج": "critical"}
ADEQUACY = {"ممتاز": "excellent", "مقبول": "acceptable", "محايد": "neutral", "غير مقبول": "unacceptable", "ضعيف": "weak"}
CTYPE = {"وقائي": "preventive", "كشفي": "detective", "تصحيحي": "corrective", "توجيهي": "directive", "لا يوجد": "none", "لايوجد": "none"}

DOMAIN_KEYS = [
    "business_continuity", "digital_transformation", "cybersecurity", "project_execution",
    "security_safety", "graduation_readiness", "regulatory_compliance", "governance",
    "public_opinion", "external_stakeholders", "financial_sustainability", "funding_budget",
    "beneficiary_cost", "operational_losses", "service_availability", "care_quality",
    "supply_chains", "serious_events", "beneficiary_experience", "non_communicable_diseases",
    "workforce_attraction", "workforce_retention", "profession_localization", "employee_satisfaction",
]  # cols 12..35


def is_empty(v):
    if v is None:
        return True
    s = str(v).strip()
    return s == "" or s.lower() in EMPTY_EQUIVALENT


def clean(v):
    """Return the value, or None if empty-equivalent. Dates → ISO strings."""
    if is_empty(v):
        return None
    if isinstance(v, (datetime.datetime, datetime.date)):
        return v.isoformat()[:10]
    return v


def yn(v):
    k = norm(v)
    if k == "نعم":
        return True
    if k in ("لا", "لايوجد"):
        return False
    return None


def map_label(table, v):
    return table.get(norm(v)) if not is_empty(v) else None


def extract_int(v):
    if is_empty(v):
        return None
    m = re.search(r"\d+", norm(v))
    return int(m.group()) if m else None


def cell(ws, r, c):
    return ws.cell(row=r, column=c).value


def extract_register_like(ws, start_row, issues, sheet_label):
    """Register / New-Risks have identical 52-col layout; header row = start_row-1."""
    out = []
    for r in range(start_row, ws.max_row + 1):
        code = clean(cell(ws, r, 7))
        if code is None:
            continue  # filler row (Unidentified / blank code) — skipped per §3
        impacts = {}
        for i, key in enumerate(DOMAIN_KEYS):
            val = cell(ws, r, 12 + i)
            if not is_empty(val):
                try:
                    impacts[key] = int(val)
                except (ValueError, TypeError):
                    pass
        # count error cells for the report
        for col in (36, 37, 38, 39, 40):
            v = cell(ws, r, col)
            if v is not None and str(v).strip().lower() in EMPTY_EQUIVALENT:
                issues.append({"row": r, "code": code, "type": "error_cell",
                               "detail": f"{sheet_label} col{col} = {str(v).strip()} → blanked"})
        level = extract_int(cell(ws, r, 50))
        risk = {
            "code": code,
            "clusterGroup": clean(cell(ws, r, 1)),
            "clusterName": clean(cell(ws, r, 2)),
            "sector": clean(cell(ws, r, 3)),
            "department": clean(cell(ws, r, 4)),
            "owner": clean(cell(ws, r, 5)),
            "identDate": clean(cell(ws, r, 6)),
            "title": clean(cell(ws, r, 8)),
            "rootCauses": clean(cell(ws, r, 9)),
            "category": clean(cell(ws, r, 10)),
            "subCategory": clean(cell(ws, r, 11)),
            "impacts": impacts,
            "likelihoodLabel": clean(cell(ws, r, 39)),
            "likelihood": map_label(LIKELIHOOD, cell(ws, r, 39)),
            "impactLabel": clean(cell(ws, r, 37)),
            "aggregatedImpact": map_label(IMPACT, cell(ws, r, 37)),
            "inherentLabel": clean(cell(ws, r, 40)),
            "inherentBand": map_label(INHERENT, cell(ws, r, 40)),
            "controlId": clean(cell(ws, r, 41)),
            "controlDescription": clean(cell(ws, r, 42)),
            "controlType": map_label(CTYPE, cell(ws, r, 43)),
            "controlActivated": yn(cell(ws, r, 44)),
            "controlShared": yn(cell(ws, r, 45)),
            "controlComplied": yn(cell(ws, r, 46)),
            "controlEffective": yn(cell(ws, r, 47)),
            "adequacyLabel": clean(cell(ws, r, 48)),
            "controlAdequacy": map_label(ADEQUACY, cell(ws, r, 48)),
            "residualPriority": extract_int(cell(ws, r, 49)),
            "residualLevel": level,
            "updateDate": clean(cell(ws, r, 51)),
            "lastUpdate": clean(cell(ws, r, 52)),
            "isTopRisk": level in (1, 2) if level is not None else False,
        }
        out.append(risk)
    return out


def extract_top(ws, issues):
    """Top Risks sheet (21 cols): header row 7, data row 8. code col 5, level col 9."""
    out = []
    for r in range(8, ws.max_row + 1):
        code = clean(cell(ws, r, 5))
        if code is None:
            continue
        out.append({
            "code": code,
            "riskSource": clean(cell(ws, r, 1)),
            "identDate": clean(cell(ws, r, 4)),
            "category": clean(cell(ws, r, 8)),
            "residualLevel": extract_int(cell(ws, r, 9)),
            "topRiskTheme": clean(cell(ws, r, 10)),
            "topRiskDescription": clean(cell(ws, r, 11)),
            "owner": clean(cell(ws, r, 12)),
            "mitigationPlanType": clean(cell(ws, r, 14)),
            "mitigationPlanDescription": clean(cell(ws, r, 15)),
            "mitigationOwner": clean(cell(ws, r, 16)),
            "expectedImplementationDate": clean(cell(ws, r, 18)),
            "status": clean(cell(ws, r, 19)),
            "completionPct": clean(cell(ws, r, 20)),
            "notes": clean(cell(ws, r, 21)),
        })
    return out


def dup_report(risks, label, issues):
    seen, dups = set(), 0
    for x in risks:
        if x["code"] in seen:
            dups += 1
            issues.append({"code": x["code"], "type": "duplicate", "detail": f"duplicate in {label}"})
        seen.add(x["code"])
    return dups


def missing_report(risks, label, issues):
    n = 0
    for x in risks:
        for f in ("department", "title"):
            if not x.get(f):
                n += 1
                issues.append({"code": x["code"], "type": "missing_field", "detail": f"{label}: missing {f}"})
    return n


def main():
    path = sys.argv[1]
    out_path = sys.argv[2] if len(sys.argv) > 2 else "packages/server/data/current-risks.json"
    wb = openpyxl.load_workbook(path, data_only=True)

    issues = []
    register = extract_register_like(wb["سجل المخاطر "], 7, issues, "register")
    new_risks = extract_register_like(wb["المخاطر الجديدة"], 7, issues, "new")
    top = extract_top(wb["أهم المخاطر"], issues)

    for lst, lbl in ((register, "register"), (new_risks, "new")):
        dup_report(lst, lbl, issues)
        missing_report(lst, lbl, issues)

    # mark new risks as pending-approval (§13)
    for r in new_risks:
        r["status"] = "PENDING_APPROVAL"
    for r in register:
        r["status"] = "ACTIVE"

    report = {
        "sourceFile": path.split("/")[-1],
        "registerImported": len(register),
        "topImported": len(top),
        "newImported": len(new_risks),
        "registerTopRisks": sum(1 for r in register if r["isTopRisk"]),
        "duplicates": sum(1 for i in issues if i["type"] == "duplicate"),
        "missingFields": sum(1 for i in issues if i["type"] == "missing_field"),
        "errorCells": sum(1 for i in issues if i["type"] == "error_cell"),
        "issuesSample": issues[:25],
    }

    import os
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump({"register": register, "topRisks": top, "newRisks": new_risks, "report": report},
                  f, ensure_ascii=False, indent=2)

    print(json.dumps(report, ensure_ascii=False, indent=2))
    print(f"\nWrote {out_path}")


if __name__ == "__main__":
    main()
