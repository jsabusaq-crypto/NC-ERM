#!/usr/bin/env python3
"""
NH-ERM report generator (§5 — official report template).

Takes report inputs (subject, scope, department) + the risk data and produces a
branded Word report in the cluster identity: official logo, title, meta block,
and a risk table. This is the "export to the official report template" path —
in the deployed platform it is a download button; here it writes a .docx.

Usage:
  python3 -I scripts/generate_report.py <risks.json> <logo.png> <out.docx> \
      --subject "..." --scope all|top|department|level --dept "..." --level N
"""
import sys, json, argparse, datetime
from docx import Document
from docx.shared import Pt, RGBColor, Inches, Cm
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

BRAND = RGBColor(0x00, 0x96, 0xDD)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
LEVEL_FILL = {1: 'D7263D', 2: 'EF6C2F', 3: 'EAA818', 4: '3AA266', 5: '79C99A'}
BAND_AR = {'very_low': 'منخفض جداً', 'low': 'منخفض', 'medium': 'متوسط', 'high': 'عالي', 'critical': 'حرج'}


def set_rtl(paragraph):
    pPr = paragraph._p.get_or_add_pPr()
    bidi = OxmlElement('w:bidi'); pPr.append(bidi)


def shade(cell, hex_fill):
    tcPr = cell._tc.get_or_add_tcPr()
    sh = OxmlElement('w:shd'); sh.set(qn('w:val'), 'clear'); sh.set(qn('w:fill'), hex_fill)
    tcPr.append(sh)


def cell_text(cell, text, bold=False, color=None, align='right', size=9):
    cell.text = ''
    p = cell.paragraphs[0]; p.alignment = WD_ALIGN_PARAGRAPH.RIGHT if align == 'right' else WD_ALIGN_PARAGRAPH.CENTER
    set_rtl(p)
    r = p.add_run(str(text)); r.font.size = Pt(size); r.bold = bold
    if color: r.font.color.rgb = color
    r.font.name = 'Janna LT'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('risks'); ap.add_argument('logo'); ap.add_argument('out')
    ap.add_argument('--subject', default='تقرير المخاطر المؤسسية')
    ap.add_argument('--scope', default='top')
    ap.add_argument('--dept', default='')
    ap.add_argument('--level', type=int, default=0)
    a = ap.parse_args()

    data = json.load(open(a.risks, encoding='utf-8'))
    reg = data['register']

    compliance = (a.scope == 'compliance')
    deps = []
    if compliance:
        from collections import OrderedDict
        today = datetime.date.today()
        by = OrderedDict()
        for r in reg:
            d = (r.get('department') or '—').strip()
            o = by.setdefault(d, {'dept': d, 'count': 0, 'last': None})
            o['count'] += 1
            u = r.get('updateDate')
            u = str(u)[:10] if u not in (None, '') else None
            if u and (not o['last'] or u > o['last']):
                o['last'] = u
        def _since(s):
            try:
                y, m, dd = map(int, s[:10].split('-')); return (today - datetime.date(y, m, dd)).days
            except Exception:
                return None
        deps = [{**o, 'since': _since(o['last'])} for o in by.values()]
        deps.sort(key=lambda x: -(x['since'] or 0))
        rows = []; scope_ar = 'حالات الإدارات والتأخير'
    elif a.scope == 'top':
        rows = [r for r in reg if r.get('isTopRisk')]
        scope_ar = 'أهم المخاطر (المستوى 1 و2)'
    elif a.scope == 'department':
        rows = [r for r in reg if (r.get('department') or '').strip() == a.dept.strip()]
        scope_ar = f'مخاطر إدارة: {a.dept}'
    elif a.scope == 'level':
        rows = [r for r in reg if r.get('residualLevel') == a.level]
        scope_ar = f'المخاطر من المستوى {a.level}'
    else:
        rows = reg; scope_ar = 'جميع المخاطر'

    doc = Document()
    sec = doc.sections[0]
    sec.left_margin = sec.right_margin = Cm(1.6); sec.top_margin = Cm(1.4)

    # logo
    p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.add_run().add_picture(a.logo, width=Inches(2.4))

    # title bar
    t = doc.add_paragraph(); t.alignment = WD_ALIGN_PARAGRAPH.CENTER; set_rtl(t)
    r = t.add_run(a.subject); r.bold = True; r.font.size = Pt(16); r.font.color.rgb = BRAND; r.font.name = 'Janna LT'
    sub = doc.add_paragraph(); sub.alignment = WD_ALIGN_PARAGRAPH.CENTER; set_rtl(sub)
    rs = sub.add_run('تجمع نجران الصحي · منصة NH-ERM لإدارة المخاطر المؤسسية'); rs.font.size = Pt(10); rs.font.color.rgb = RGBColor(0x5f, 0x74, 0x88); rs.font.name = 'Janna LT'

    # meta
    meta = doc.add_table(rows=1, cols=3); meta.alignment = WD_TABLE_ALIGNMENT.CENTER
    today = datetime.date.today().isoformat()
    _cnt = (('عدد الإدارات', str(len(deps))) if compliance else ('عدد المخاطر', str(len(rows))))
    for i, (k, v) in enumerate([('نطاق التقرير', scope_ar), _cnt, ('تاريخ الإصدار', today)]):
        c = meta.rows[0].cells[i]; shade(c, 'F6F9FC')
        cell_text(c, k, bold=True, color=BRAND, align='center', size=9)
        pp = c.add_paragraph(); pp.alignment = WD_ALIGN_PARAGRAPH.CENTER; set_rtl(pp)
        rr = pp.add_run(str(v)); rr.font.size = Pt(10); rr.bold = True; rr.font.name = 'Janna LT'
    doc.add_paragraph()

    # explanatory introduction
    intro_p = doc.add_paragraph(); intro_p.alignment = WD_ALIGN_PARAGRAPH.RIGHT; set_rtl(intro_p)
    intro_compliance = (
        'يوضّح هذا التقرير حالة التزام الإدارات برفع تقاريرها وتحديث سجلات مخاطرها. يبيّن الجدول أدناه '
        'لكل إدارة: عدد مخاطرها، وتاريخ آخر رفع/تحديث فعلي، ومدة التأخير بالأيام منذ آخر تحديث، وحالة '
        'السجل (محدّث أو متأخر). ويُستخدم لمتابعة انضباط الإدارات في الرفع والتحديث الدوري وفق الدورة '
        'الربع سنوية المعتمدة، ورفع حالات التأخير إلى الإدارة المختصة.')
    intro_risks = (
        'يعرض هذا التقرير المخاطر ضمن النطاق المحدّد أعلاه، مُقيّمةً وفق المنهجية الرسمية لإدارة '
        'المخاطر المؤسسية المعتمدة من شركة الصحة القابضة (مقياس الاحتمالية ومقياس الأثر عبر مجالات '
        'الخطر، ومصفوفة المخاطر الكامنة، وكفاية البيئة الرقابية، ومصفوفة المخاطر المتبقية). يوضّح الجدول '
        'أدناه لكل خطر: الإدارة المسؤولة، ووصفه، ومستوى احتماليته وأثره، وتقييمه الكامن، ومستواه المتبقّي. '
        'ويُستخدم هذا التقرير لمتابعة أهم المخاطر وخطط معالجتها ودعم اتخاذ القرار على مستوى التجمع.')
    ri = intro_p.add_run(intro_compliance if compliance else intro_risks)
    ri.font.size = Pt(10); ri.font.name = 'Janna LT'; ri.font.color.rgb = RGBColor(0x30, 0x45, 0x5a)
    doc.add_paragraph()

    if compliance:
        # department status & delays table
        cols = ['حالة السجل', 'التأخير (يوم)', 'آخر رفع/تحديث', 'عدد المخاطر', 'الإدارة']
        tbl = doc.add_table(rows=1, cols=len(cols)); tbl.style = 'Table Grid'; tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
        for i, h in enumerate(cols):
            c = tbl.rows[0].cells[i]; shade(c, '0A1F30'); cell_text(c, h, bold=True, color=WHITE, align='center', size=9)
        for d in deps:
            cells = tbl.add_row().cells
            since = d.get('since')
            stale = (since is None) or (since > 120)
            cell_text(cells[0], 'متأخر' if stale else 'محدّث', align='center', bold=True, color=WHITE)
            shade(cells[0], 'D7263D' if stale else '3AA266')
            cell_text(cells[1], '—' if since is None else str(since), align='center', bold=True)
            cell_text(cells[2], d.get('last') or '—', align='center')
            cell_text(cells[3], str(d.get('count', 0)), align='center')
            cell_text(cells[4], d.get('dept') or '—', align='right', bold=True)
    else:
        # risk table
        cols = ['المستوى', 'الكامن', 'الأثر', 'الاحتمالية', 'الإدارة', 'وصف الخطر', 'الرمز']
        tbl = doc.add_table(rows=1, cols=len(cols)); tbl.style = 'Table Grid'; tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
        for i, h in enumerate(cols):
            c = tbl.rows[0].cells[i]; shade(c, '0A1F30'); cell_text(c, h, bold=True, color=WHITE, align='center', size=9)
        for r in rows:
            cells = tbl.add_row().cells
            lvl = r.get('residualLevel')
            cell_text(cells[0], f"مستوى {lvl}" if lvl else '—', align='center', color=WHITE if lvl else None)
            if lvl: shade(cells[0], LEVEL_FILL.get(lvl, 'FFFFFF'))
            cell_text(cells[1], BAND_AR.get(r.get('inherentBand'), '—'), align='center')
            cell_text(cells[2], r.get('impactLabel') or '—', align='center')
            cell_text(cells[3], r.get('likelihoodLabel') or '—', align='center')
            cell_text(cells[4], r.get('department') or '—')
            cell_text(cells[5], (r.get('title') or '')[:80])
            cell_text(cells[6], r.get('code') or '—', align='center', bold=True)

    # sign-off / approval block
    doc.add_paragraph()
    so_t = doc.add_paragraph(); so_t.alignment = WD_ALIGN_PARAGRAPH.CENTER; set_rtl(so_t)
    rso = so_t.add_run('اعتماد التقرير'); rso.bold = True; rso.font.size = Pt(12); rso.font.color.rgb = BRAND; rso.font.name = 'Janna LT'
    sign = doc.add_table(rows=1, cols=4); sign.style = 'Table Grid'; sign.alignment = WD_TABLE_ALIGNMENT.CENTER
    # logical cells L→R: [التوقيع, التاريخ, الاسم والمنصب, البند] so البند shows rightmost in RTL reading
    for i, h in enumerate(['التوقيع', 'التاريخ', 'الاسم والمنصب', 'البند']):
        c = sign.rows[0].cells[i]; shade(c, '0A1F30'); cell_text(c, h, bold=True, color=WHITE, align='center', size=9)
    for role, name in [('الإعداد', 'مدير إدارة المخاطر المؤسسية'),
                       ('المراجعة', 'مدير الإدارة التنفيذية للحوكمة والمخاطر والالتزام'),
                       ('الاعتماد', 'الرئيس التنفيذي للتجمع')]:
        cells = sign.add_row().cells
        cells[0].height = Pt(34)
        cell_text(cells[0], '', align='center')        # signature (blank)
        cell_text(cells[1], '', align='center')        # date (blank)
        cell_text(cells[2], name, align='right', size=9)
        cell_text(cells[3], role, bold=True, align='center', color=BRAND, size=10)

    # footer note
    doc.add_paragraph()
    f = doc.add_paragraph(); f.alignment = WD_ALIGN_PARAGRAPH.CENTER; set_rtl(f)
    rf = f.add_run('أُصدر آلياً من منصة NH-ERM — تجمع نجران الصحي'); rf.font.size = Pt(8); rf.font.color.rgb = RGBColor(0x90, 0xa1, 0xb4); rf.font.name = 'Janna LT'

    doc.save(a.out)
    n = len(deps) if compliance else len(rows)
    print(f'Report: {n} {"departments" if compliance else "risks"} · scope={a.scope} → {a.out}')


if __name__ == '__main__':
    main()
