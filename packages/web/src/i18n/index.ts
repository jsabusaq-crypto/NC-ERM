/**
 * NH-ERM bilingual i18n (§2).
 * Switching language flips both language AND direction (RTL ↔ LTR) automatically.
 */

import { createContext, useContext } from 'react';

export type Lang = 'ar' | 'en';
export type Dir = 'rtl' | 'ltr';

export const DIR_FOR: Record<Lang, Dir> = { ar: 'rtl', en: 'ltr' };

type Dict = Record<string, { ar: string; en: string }>;

export const STRINGS: Dict = {
  app_title: { ar: 'منصة NH-ERM لإدارة المخاطر', en: 'NH-ERM Risk Management' },
  cluster: { ar: 'تجمع نجران الصحي', en: 'Najran Health Cluster' },
  nav_dashboard: { ar: 'لوحة القيادة', en: 'Dashboard' },
  nav_register: { ar: 'سجل المخاطر', en: 'Risk Register' },
  nav_top_risks: { ar: 'أهم المخاطر', en: 'Top Risks' },
  nav_audit: { ar: 'سجل التدقيق', en: 'Audit Log' },
  switch_lang: { ar: 'English', en: 'العربية' },
  risk_code: { ar: 'رمز الخطر', en: 'Risk code' },
  department: { ar: 'الإدارة', en: 'Department' },
  inherent: { ar: 'التقييم الكامن', en: 'Inherent' },
  residual_level: { ar: 'مستوى المخاطر المتبقية', en: 'Residual level' },
  is_top_risk: { ar: 'من أهم المخاطر', en: 'Top risk' },
  by_level: { ar: 'التوزيع حسب المستوى', en: 'Distribution by level' },
  by_department: { ar: 'التوزيع حسب الإدارة', en: 'Distribution by department' },
  kri_completion: { ar: 'إنجاز خطط المعالجة', en: 'Treatment-plan completion' },
  kpi_adherence: { ar: 'الالتزام بالمواعيد', en: 'Deadline adherence' },
  yes: { ar: 'نعم', en: 'Yes' },
  no: { ar: 'لا', en: 'No' },
  level: { ar: 'مستوى', en: 'Level' },
};

export function t(key: string, lang: Lang): string {
  return STRINGS[key]?.[lang] ?? key;
}

export interface I18n {
  lang: Lang;
  dir: Dir;
  t: (key: string) => string;
  setLang: (l: Lang) => void;
}

export const I18nContext = createContext<I18n>({
  lang: 'ar',
  dir: 'rtl',
  t: (k) => k,
  setLang: () => {},
});

export const useI18n = (): I18n => useContext(I18nContext);
