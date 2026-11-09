import { useI18n } from '../i18n/index.ts';

/**
 * Dashboard (§10) — dynamic charts that auto-update on risk changes.
 * This shell renders the layout with demo data; wire each panel to the API
 * (/api/risks, /api/top-risks, KRI/KPI endpoints) and a chart lib later.
 */
export function Dashboard() {
  const { t } = useI18n();

  // Demo data — replace with live API fetch.
  const byLevel = [
    { level: 1, count: 4, color: 'var(--level_1)' },
    { level: 2, count: 9, color: 'var(--level_2)' },
    { level: 3, count: 21, color: 'var(--level_3)' },
    { level: 4, count: 34, color: 'var(--level_4)' },
    { level: 5, count: 105, color: 'var(--level_5)' },
  ];
  const max = Math.max(...byLevel.map((b) => b.count));

  return (
    <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
      <section className="card">
        <h3 style={{ marginTop: 0 }}>{t('by_level')}</h3>
        <div style={{ display: 'grid', gap: 8 }}>
          {byLevel.map((b) => (
            <div key={b.level} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 40px', alignItems: 'center', gap: 8 }}>
              <span className="badge" style={{ background: b.color }}>{t('level')} {b.level}</span>
              <div style={{ background: 'var(--bg-muted)', borderRadius: 6, overflow: 'hidden' }}>
                <div style={{ width: `${(b.count / max) * 100}%`, background: b.color, height: 16 }} />
              </div>
              <span style={{ textAlign: 'end' }}>{b.count}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <h3 style={{ marginTop: 0 }}>{t('kri_completion')}</h3>
        <Meter label="IT" pct={72} />
        <Meter label="Nursing" pct={55} />
        <Meter label="Pharmacy" pct={88} />
      </section>

      <section className="card">
        <h3 style={{ marginTop: 0 }}>{t('kpi_adherence')}</h3>
        <Meter label="IT" pct={94} />
        <Meter label="Nursing" pct={61} />
        <Meter label="Pharmacy" pct={79} />
      </section>
    </div>
  );
}

function Meter({ label, pct }: { label: string; pct: number }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
        <span>{label}</span>
        <span>{pct}%</span>
      </div>
      <div style={{ background: 'var(--bg-muted)', borderRadius: 6, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: 10, background: 'var(--brand-accent)' }} />
      </div>
    </div>
  );
}
