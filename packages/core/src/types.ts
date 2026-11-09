/**
 * NH-ERM core domain types.
 *
 * Erasable-syntax TypeScript only (no `enum`, no `namespace`) so Node's native
 * type stripping (`node --test`) runs these files with no build step.
 */

/** Likelihood score, integer 1..5. */
export type Likelihood = 1 | 2 | 3 | 4 | 5;

/** Per-domain impact score, integer 1..5. */
export type ImpactScore = 1 | 2 | 3 | 4 | 5;

/** Inherent-risk band (best → worst). */
export type InherentBand = 'very_low' | 'low' | 'medium' | 'high' | 'critical';

export const INHERENT_BANDS: readonly InherentBand[] = [
  'very_low',
  'low',
  'medium',
  'high',
  'critical',
] as const;

/** Control-environment adequacy (best → worst). */
export type ControlAdequacy =
  | 'excellent'
  | 'acceptable'
  | 'neutral'
  | 'unacceptable'
  | 'weak';

export const CONTROL_ADEQUACY_LEVELS: readonly ControlAdequacy[] = [
  'excellent',
  'acceptable',
  'neutral',
  'unacceptable',
  'weak',
] as const;

/** Final residual level (1 = most severe … 5 = least severe). */
export type ResidualLevel = 1 | 2 | 3 | 4 | 5;

/** Residual priority, integer 1..25 (1 = most urgent). */
export type Priority = number;

/** Control type (§8.7). */
export type ControlType =
  | 'preventive'
  | 'detective'
  | 'corrective'
  | 'directive'
  | 'none';

/** Control nature (§8.7). */
export type ControlNature = 'manual' | 'automated' | 'hybrid' | 'none';

/** Risk response plan — the "4 Ts" (§8.7). */
export type ResponsePlan = 'treat' | 'tolerate' | 'transfer' | 'terminate';

/**
 * The 24 impact assessment domains (§8.2), in official order.
 * `key` is the stable identifier used in the DB; `ar`/`en` are display labels.
 */
export interface ImpactDomain {
  readonly key: string;
  readonly ar: string;
  readonly en: string;
}

export const IMPACT_DOMAINS: readonly ImpactDomain[] = [
  { key: 'business_continuity', ar: 'استمرارية الأعمال', en: 'Business continuity' },
  { key: 'digital_transformation', ar: 'التحول الرقمي', en: 'Digital transformation' },
  { key: 'cybersecurity', ar: 'الأمن السيبراني', en: 'Cybersecurity' },
  { key: 'project_execution', ar: 'تنفيذ المشاريع', en: 'Project execution' },
  { key: 'security_safety', ar: 'الأمن والسلامة', en: 'Security & safety' },
  { key: 'graduation_readiness', ar: 'جاهزية التجمعات للتخرج', en: 'Cluster graduation readiness' },
  { key: 'regulatory_compliance', ar: 'الالتزام بالأنظمة', en: 'Regulatory compliance' },
  { key: 'governance', ar: 'الحوكمة', en: 'Governance' },
  { key: 'public_opinion', ar: 'تفاعلات الرأي العام', en: 'Public-opinion interactions' },
  { key: 'external_stakeholders', ar: 'أصحاب المصلحة الخارجيين', en: 'External stakeholders' },
  { key: 'financial_sustainability', ar: 'الاستدامة المالية', en: 'Financial sustainability' },
  { key: 'funding_budget', ar: 'التمويل والموازنة', en: 'Funding & budget' },
  { key: 'beneficiary_cost', ar: 'تكلفة المستفيد', en: 'Beneficiary cost' },
  { key: 'operational_losses', ar: 'الخسائر التشغيلية', en: 'Operational losses' },
  { key: 'service_availability', ar: 'توفر الخدمات الصحية', en: 'Availability of health services' },
  { key: 'care_quality', ar: 'جودة الرعاية الصحية', en: 'Quality of healthcare' },
  { key: 'supply_chains', ar: 'سلاسل التوريد', en: 'Supply chains' },
  { key: 'serious_events', ar: 'الأحداث الجسيمة', en: 'Serious / sentinel events' },
  { key: 'beneficiary_experience', ar: 'تجربة المستفيد', en: 'Beneficiary experience' },
  { key: 'non_communicable_diseases', ar: 'الأمراض غير المعدية', en: 'Non-communicable diseases' },
  { key: 'workforce_attraction', ar: 'جذب القوى العاملة', en: 'Workforce attraction' },
  { key: 'workforce_retention', ar: 'الحفاظ على القوى العاملة', en: 'Workforce retention' },
  { key: 'profession_localization', ar: 'توطين المهن', en: 'Profession localization' },
  { key: 'employee_satisfaction', ar: 'رضا الموظفين', en: 'Employee satisfaction' },
] as const;

/** The four control-environment questions (§8.4). */
export const CONTROL_QUESTIONS: readonly { key: string; ar: string; en: string }[] = [
  { key: 'activated', ar: 'تفعيل/اعتماد الضوابط', en: 'Controls activated / approved' },
  { key: 'shared', ar: 'مشاركتها وتطبيقها', en: 'Controls shared & applied' },
  { key: 'complied', ar: 'الالتزام الكامل بتنفيذها', en: 'Full compliance with execution' },
  { key: 'effective', ar: 'فعاليتها دون حالات فشل', en: 'Effective without failures' },
] as const;

/** Input to the assessment engine. */
export interface RiskAssessmentInput {
  likelihood: Likelihood;
  /** Per-domain impact scores keyed by `ImpactDomain.key`. Omitted/undefined = domain not applicable. */
  impacts: Partial<Record<string, ImpactScore>>;
  /** Answers to the 4 control questions, in `CONTROL_QUESTIONS` order. */
  controlAnswers: readonly boolean[];
}

/** Output of the assessment engine. */
export interface RiskAssessmentResult {
  likelihood: Likelihood;
  aggregatedImpact: number;
  inherentScore: number;
  inherentBand: InherentBand;
  controlAdequacy: ControlAdequacy;
  residualPriority: Priority;
  residualLevel: ResidualLevel;
  /** True when the risk qualifies for the Top Risks sheet (§4, §8.6). */
  isTopRisk: boolean;
}
