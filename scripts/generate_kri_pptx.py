#!/usr/bin/env python3
"""
NH-ERM KRI PowerPoint report generator (§9) — matches the official ACO evidence
format (3GOV7.9.2.2A): a cover/title slide, a KRI dashboard of eight stat tiles
with an escalate marker, and an indicators detail table.

Values are computed from the risk register where the data exists; indicators that
depend on data not yet captured (mitigation plans, strategic linkage) are marked
"—" and fill automatically once entered.

Usage: python3 -I scripts/generate_kri_pptx.py <risks.json> <logo.png> <out.pptx> [--quarter "الربع الثالث 2026"]
"""
import sys, json, argparse, datetime
from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.oxml.ns import qn

NAVY = RGBColor(0x1B, 0x3A, 0x6B)
RED = RGBColor(0x9C, 0x1B, 0x1B)
DRED = RGBColor(0x8A, 0x15, 0x15)
GREY = RGBColor(0x5B, 0x70, 0x83)
TILE = RGBColor(0xF5, 0xF7, 0xFA)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
LINE = RGBColor(0xD9, 0xE1, 0xEA)


def rtl(p):
    pPr = p._pPr
    if pPr is None:
        pPr = p._p.get_or_add_pPr()
    pPr.set('rtl', '1')


def txt(tf, text, size, color, bold=False, align=PP_ALIGN.RIGHT, font='Arial'):
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.alignment = align
    rtl(p)
    r = p.add_run(); r.text = text
    r.font.size = Pt(size); r.font.bold = bold; r.font.color.rgb = color; r.font.name = font
    return p


def add_text(slide, l, t, w, h, text, size, color, bold=False, align=PP_ALIGN.RIGHT, anchor=MSO_ANCHOR.TOP):
    tb = slide.shapes.add_textbox(l, t, w, h); tf = tb.text_frame
    tf.vertical_anchor = anchor
    txt(tf, text, size, color, bold, align)
    return tb


def kri_values(reg):
    N = len(reg) or 1
    def pct(n): return round(n / N * 100, 1)
    today = datetime.date.today(); cq = (today.month - 1) // 3

    def in_q(s):
        try:
            y, m, d = map(int, str(s)[:10].split('-')); return y == today.year and (m - 1) // 3 == cq
        except Exception:
            return False
    incomplete = sum(1 for r in reg if r.get('likelihood') is None or r.get('aggregatedImpact') is None)
    weak = sum(1 for r in reg if r.get('controlAdequacy') in ('weak', 'unacceptable'))
    excellent = sum(1 for r in reg if r.get('controlAdequacy') == 'excellent')
    updated = sum(1 for r in reg if in_q(r.get('updateDate')))
    sectors = set((r.get('sector') or '').replace('(التجمع)', '').strip() for r in reg if r.get('sector'))
    # 8 KRIs: (value_text, label, status) — status: 'ok' | 'alert' | 'na'
    return [
        (f"{pct(incomplete)}%", "نسبة المخاطر غير مكتملة التقييم", 'alert' if pct(incomplete) > 10 else 'ok'),
        (f"{pct(weak)}%", "نسبة المخاطر ذات الضوابط الضعيفة أو غير المقبولة", 'alert' if pct(weak) > 20 else 'ok'),
        ("—", "نسبة مخاطر المستوى الأول التي لها خطة تخفيف جارية أو مكتملة", 'na'),
        ("—", "نسبة أهم المخاطر التي لها خطة تخفيف جارية أو مكتملة", 'na'),
        (str(max(0, 15 - len(sectors))), "عدد الإدارات التنفيذية بلا مخاطر مسجلة", 'ok'),
        (f"{pct(excellent)}%", "نسبة المخاطر ذات الضوابط المطبقة والفعالة بالكامل", 'ok'),
        ("—", "نسبة أهم المخاطر المرتبطة بهدف استراتيجي", 'na'),
        (f"{pct(updated)}%", "نسبة المخاطر المحدّثة خلال الدورة الربعية", 'alert' if pct(updated) < 90 else 'ok'),
    ]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('risks'); ap.add_argument('logo'); ap.add_argument('out')
    ap.add_argument('--quarter', default='الربع الرابع 2026')
    a = ap.parse_args()
    reg = json.load(open(a.risks, encoding='utf-8'))['register']
    kris = kri_values(reg)
    today = datetime.date.today().strftime('%d/%m/%Y')

    prs = Presentation(); prs.slide_width = Inches(13.333); prs.slide_height = Inches(7.5)
    SW, SH = prs.slide_width, prs.slide_height
    blank = prs.slide_layouts[6]

    # ---- Slide 1: title (navy) ----
    s = prs.slides.add_slide(blank)
    bg = s.shapes.add_shape(1, 0, 0, SW, SH); bg.fill.solid(); bg.fill.fore_color.rgb = NAVY; bg.line.fill.background()
    bg.shadow.inherit = False
    s.shapes.add_picture(a.logo, SW - Inches(2.6), Inches(0.4), height=Inches(0.9))
    add_text(s, Inches(1), Inches(2.4), Inches(11.3), Inches(1.3),
             "تقرير مؤشرات المخاطر الرئيسية لملف المخاطر المؤسسي", 34, WHITE, True, PP_ALIGN.CENTER)
    add_text(s, Inches(1), Inches(3.7), Inches(11.3), Inches(0.6),
             f"{a.quarter}  |  مستخرج من سجل المخاطر الموحد ومنصة NH-ERM", 18, RGBColor(0xC7, 0xD6, 0xE6), False, PP_ALIGN.CENTER)
    add_text(s, Inches(1), Inches(4.3), Inches(11.3), Inches(0.5),
             f"تاريخ الإصدار: {today}", 14, RGBColor(0xC7, 0xD6, 0xE6), False, PP_ALIGN.CENTER)
    add_text(s, Inches(1), Inches(6.5), Inches(11.3), Inches(0.5),
             "الإدارة التنفيذية للحوكمة والمخاطر والالتزام – إدارة المخاطر المؤسسية", 13, RGBColor(0xAFC0D4, 0xAFC0D4, 0xAFC0D4) if False else RGBColor(0xAF, 0xC0, 0xD4), False, PP_ALIGN.CENTER)

    # ---- Slide 2: KRI dashboard ----
    s = prs.slides.add_slide(blank)
    s.shapes.add_picture(a.logo, Inches(0.4), Inches(0.3), height=Inches(0.7))
    add_text(s, Inches(6.8), Inches(0.35), Inches(6.1), Inches(0.6), "لوحة مؤشرات ملف المخاطر", 26, RED, True, PP_ALIGN.RIGHT)
    add_text(s, Inches(5.3), Inches(1.0), Inches(7.6), Inches(0.4),
             f"{a.quarter} – تاريخ إقفال البيانات: {today} (آخر تحديث للسجل)", 13, GREY, False, PP_ALIGN.RIGHT)
    cols, rows = 4, 2
    gx, gy = Inches(0.45), Inches(1.75)
    cw, ch = Inches(3.0), Inches(2.5)
    gap = Inches(0.1)
    for i, (val, label, status) in enumerate(kris):
        r, c = divmod(i, cols)
        x = gx + (cw + gap) * (cols - 1 - c)  # right-to-left placement
        y = gy + (ch + gap) * r
        card = s.shapes.add_shape(5, x, y, cw, ch)  # rounded rect
        card.fill.solid(); card.fill.fore_color.rgb = TILE
        card.line.color.rgb = LINE; card.line.width = Pt(1.2); card.shadow.inherit = False
        add_text(s, x, y + Inches(0.35), cw, Inches(0.8), val, 34, RED, True, PP_ALIGN.CENTER)
        add_text(s, x + Inches(0.15), y + Inches(1.15), cw - Inches(0.3), Inches(0.9), label, 11.5, NAVY, True, PP_ALIGN.CENTER)
        btn = s.shapes.add_shape(5, x + Inches(0.85), y + ch - Inches(0.55), Inches(1.3), Inches(0.38))
        btn.fill.solid(); btn.fill.fore_color.rgb = DRED; btn.line.fill.background(); btn.shadow.inherit = False
        tf = btn.text_frame; tf.vertical_anchor = MSO_ANCHOR.MIDDLE
        txt(tf, "تصعيد", 11, WHITE, True, PP_ALIGN.CENTER)
    add_text(s, Inches(0.4), SH - Inches(0.5), Inches(12.5), Inches(0.35),
             "تجمع نجران الصحي | إدارة المخاطر المؤسسية | المصدر: سجل المخاطر الموحد ومنصة NH-ERM", 10, GREY, False, PP_ALIGN.CENTER)

    # ---- Slide 3: indicators table ----
    s = prs.slides.add_slide(blank)
    s.shapes.add_picture(a.logo, Inches(0.4), Inches(0.3), height=Inches(0.7))
    add_text(s, Inches(7.3), Inches(0.4), Inches(5.6), Inches(0.6), "نتائج المؤشرات وحدودها", 24, RED, True, PP_ALIGN.RIGHT)
    headers = ["الحالة", "القيمة", "حد التصعيد", "حد التنبيه", "المؤشر", "الرمز"]
    rows_n = len(kris) + 1
    tbl_shape = s.shapes.add_table(rows_n, len(headers), Inches(0.4), Inches(1.4), Inches(12.5), Inches(5.3))
    table = tbl_shape.table
    widths = [1.4, 1.4, 1.6, 1.6, 5.2, 1.3]
    for i, w in enumerate(widths):
        table.columns[i].width = Inches(w)
    for i, h in enumerate(headers):
        cell = table.cell(0, i); cell.fill.solid(); cell.fill.fore_color.rgb = NAVY
        tf = cell.text_frame; tf.word_wrap = True; txt(tf, h, 12, WHITE, True, PP_ALIGN.CENTER)
    thr = [("15%", "25%"), ("20%", "35%"), ("—", "—"), ("—", "—"), ("—", "—"), ("—", "—"), ("—", "—"), ("90%", "70%")]
    codes = ["KRI-01", "KRI-02", "KRI-03", "KRI-04", "KRI-05", "KRI-06", "KRI-07", "KRI-08"]
    stat_txt = {'ok': ("ضمن الحد", RGBColor(0x2E, 0x8B, 0x57)), 'alert': ("تنبيه", RGBColor(0xC1, 0x12, 0x1F)), 'na': ("بانتظار بيانات", GREY)}
    for ri, (val, label, status) in enumerate(kris, start=1):
        data_row = [stat_txt[status][0], val, thr[ri - 1][1], thr[ri - 1][0], label, codes[ri - 1]]
        for ci, v in enumerate(data_row):
            cell = table.cell(ri, ci); cell.fill.solid(); cell.fill.fore_color.rgb = WHITE if ri % 2 else TILE
            tf = cell.text_frame; tf.word_wrap = True
            col = stat_txt[status][1] if ci == 0 else NAVY
            txt(tf, v, 10.5, col, ci in (0, 1, 5), PP_ALIGN.CENTER if ci != 4 else PP_ALIGN.RIGHT)

    prs.save(a.out)
    print(f"KRI PowerPoint: 3 slides, {len(kris)} indicators → {a.out}")


if __name__ == '__main__':
    main()
