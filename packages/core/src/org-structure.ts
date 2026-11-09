/**
 * NH-ERM official organizational structure (§12), transcribed from the SIGNED org
 * chart (signed by Khalid bin Ayed Al-Asiri, CEO of Najran Health Cluster).
 *
 * Hierarchy: Holding Health Company → Najran Health Cluster (CEO) → Sectors →
 * Departments. The Healthcare-Delivery sector additionally has facilities and
 * clinical specialty tracks (§12).
 *
 * This is reference data (the "References / المراجع" sheet equivalent): it drives
 * the department picker, RBAC department scoping, and the dashboard's sector/
 * department breakdowns. It matches the `sector`/`department` fields found in the
 * real register, so it is both the official source and a validation of the data.
 */

export interface OrgDepartment {
  ar: string;
  en?: string;
}

export interface OrgSector {
  ar: string;
  en?: string;
  /** Governance/CEO-office staff unit rather than a line sector. */
  staff?: boolean;
  departments: OrgDepartment[];
}

/** CEO-office / governance staff units (report to the cluster CEO). */
const STAFF_UNITS: OrgSector[] = [
  { ar: 'مكتب الرئيس التنفيذي', en: 'CEO Office', staff: true, departments: [] },
  { ar: 'المراجعة الداخلية', en: 'Internal Audit', staff: true, departments: [] },
  {
    ar: 'الاستراتيجية والتحول ومكتب إدارة المشاريع',
    en: 'Strategy, Transformation & PMO',
    staff: true,
    departments: [],
  },
  { ar: 'الشؤون الأكاديمية والتدريب والبحث', en: 'Academic Affairs, Training & Research', staff: true, departments: [] },
  { ar: 'الحوكمة والالتزام والمخاطر', en: 'Governance, Compliance & Risk', staff: true, departments: [] },
  { ar: 'الشؤون القانونية', en: 'Legal Affairs', staff: true, departments: [] },
  { ar: 'التواصل وإدارة التغيير', en: 'Communication & Change Management', staff: true, departments: [] },
  { ar: 'وحدة الابتكار وإدارة المعرفة', en: 'Innovation & Knowledge Management', staff: true, departments: [] },
];

/** The main line sectors and their departments. */
const SECTORS: OrgSector[] = [
  {
    ar: 'الخدمات الصحية',
    en: 'Health Services',
    departments: [
      { ar: 'الخدمات الصحية المساندة', en: 'Support Health Services' },
      { ar: 'التمريض', en: 'Nursing' },
      { ar: 'الصحة السكانية', en: 'Population Health' },
      { ar: 'نموذج الرعاية الصحية', en: 'Care Model' },
      { ar: 'مسار الخدمات الاكلينيكية', en: 'Clinical Services Track' },
      { ar: 'الصحة العامة والمجتمعية', en: 'Public & Community Health' },
      { ar: 'الأداء الاكلينيكي', en: 'Clinical Performance' },
    ],
  },
  {
    ar: 'تقديم الرعاية الصحية',
    en: 'Healthcare Delivery',
    departments: [
      { ar: 'المستشفيات المرجعية', en: 'Reference Hospitals' },
      { ar: 'المستشفيات العامة', en: 'General Hospitals' },
      { ar: 'المراكز المتخصصة', en: 'Specialized Centers' },
      { ar: 'المستشفيات الطرفية', en: 'Peripheral Hospitals' },
      { ar: 'مراكز الرعاية الأولية', en: 'Primary Care Centers' },
      // clinical specialty tracks (applied cluster-wide)
      { ar: 'مسار تخصص الرعاية الطارئة', en: 'Emergency Care Track' },
      { ar: 'مسار تخصص الرعاية القلبية', en: 'Cardiac Care Track' },
      { ar: 'مسار تخصص الرعاية الحرجة', en: 'Critical Care Track' },
    ],
  },
  {
    ar: 'الجودة والأداء',
    en: 'Quality & Performance',
    departments: [
      { ar: 'السلامة والمخاطر الاكلينيكية', en: 'Clinical Safety & Risk' },
      { ar: 'الجودة والاعتماد', en: 'Quality & Accreditation' },
      { ar: 'الأداء والمخرجات', en: 'Performance & Outputs' },
      { ar: 'تجربة المستفيد', en: 'Beneficiary Experience' },
    ],
  },
  {
    ar: 'التشغيل',
    en: 'Operations',
    departments: [
      { ar: 'المنشآت', en: 'Facilities' },
      { ar: 'العقود والمشتريات', en: 'Contracts & Procurement' },
      { ar: 'الهندسة والصيانة', en: 'Engineering & Maintenance' },
      { ar: 'الخدمات المساندة', en: 'Support Services' },
      { ar: 'الأمن والسلامة', en: 'Security & Safety' },
    ],
  },
  {
    ar: 'الصحة الرقمية',
    en: 'Digital Health',
    departments: [
      { ar: 'الاستراتيجية الرقمية والبنية المؤسسية', en: 'Digital Strategy & Enterprise Architecture' },
      { ar: 'مكتب البيانات', en: 'Data Office' },
      { ar: 'الأنظمة الاكلينيكية', en: 'Clinical Systems' },
      { ar: 'حلول الأعمال', en: 'Business Solutions' },
      { ar: 'البنية التحتية والتشغيل', en: 'Infrastructure & Operations' },
    ],
  },
  {
    ar: 'المالية',
    en: 'Finance',
    departments: [
      { ar: 'التخطيط المالي والميزانية', en: 'Financial Planning & Budget' },
      { ar: 'عمليات الحسابات', en: 'Accounts Operations' },
      { ar: 'مكتب كفاءة الإنفاق', en: 'Spending Efficiency Office' },
      { ar: 'إدارة الإيرادات', en: 'Revenue Management' },
      { ar: 'السجلات', en: 'Records' },
      { ar: 'التحول المالي', en: 'Financial Transformation' },
    ],
  },
  {
    ar: 'الموارد البشرية',
    en: 'Human Resources',
    departments: [
      { ar: 'الرواتب', en: 'Payroll' },
      { ar: 'تخطيط وتطوير الموارد البشرية', en: 'HR Planning & Development' },
      { ar: 'عمليات الموارد البشرية', en: 'HR Operations' },
      { ar: 'التوظيف', en: 'Recruitment' },
    ],
  },
];

export interface OrgStructure {
  clusterAr: string;
  clusterEn: string;
  holdingAr: string;
  holdingEn: string;
  approvedBy: string;
  sectors: OrgSector[];
  staffUnits: OrgSector[];
}

export const NAJRAN_ORG_STRUCTURE: OrgStructure = {
  clusterAr: 'تجمع نجران الصحي',
  clusterEn: 'Najran Health Cluster',
  holdingAr: 'شركة الصحة القابضة',
  holdingEn: 'Holding Health Company',
  approvedBy: 'خالد بن عايض العسيري — الرئيس التنفيذي لتجمع نجران الصحي',
  sectors: SECTORS,
  staffUnits: STAFF_UNITS,
};

/** Normalize a sector/department label from the register for matching. */
export function normalizeOrgName(s: string): string {
  return s
    .replace(/\(التجمع\)/g, '') // strip the "(cluster)" suffix seen in data
    .replace(/^قطاع\s+/, '') // strip leading "sector" word
    .replace(/[ً-ْـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ')
    .trim();
}

/** All sectors (line + staff) flattened. */
export function allSectors(): OrgSector[] {
  return [...SECTORS, ...STAFF_UNITS];
}
