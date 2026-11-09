import { useI18n } from '../i18n/index.ts';

/**
 * Risk Register / Top Risks table (§3, §4).
 * `scope="top"` shows only Top Risks. Wire to /api/risks and /api/top-risks.
 * Demo rows below illustrate the band/level color coding (§8).
 */
export function RiskRegister({ scope }: { scope: 'all' | 'top' }) {
  const { t, dir } = useI18n();

  const demo = [
    { code: 'NC-001', department: 'IT', inherent: 25, level: 1, top: true },
    { code: 'NC-002', department: 'Nursing', inherent: 12, level: 3, top: false },
    { code: 'NC-003', department: 'Pharmacy', inherent: 20, level: 2, top: true },
    { code: 'NC-004', department: 'Finance', inherent: 4, level: 5, top: false },
  ].filter((r) => (scope === 'top' ? r.top : true));

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>{t(scope === 'top' ? 'nav_top_risks' : 'nav_register')}</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: dir === 'rtl' ? 'right' : 'left', color: 'var(--text-muted)' }}>
            <th style={th}>{t('risk_code')}</th>
            <th style={th}>{t('department')}</th>
            <th style={th}>{t('inherent')}</th>
            <th style={th}>{t('residual_level')}</th>
            <th style={th}>{t('is_top_risk')}</th>
          </tr>
        </thead>
        <tbody>
          {demo.map((r) => (
            <tr key={r.code} style={{ borderTop: '1px solid var(--border)' }}>
              <td style={td}>{r.code}</td>
              <td style={td}>{r.department}</td>
              <td style={td}>{r.inherent}</td>
              <td style={td}>
                <span className="badge" style={{ background: `var(--level_${r.level})` }}>
                  {t('level')} {r.level}
                </span>
              </td>
              <td style={td}>{r.top ? t('yes') : t('no')}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
        Demo data. Wire to <code>/api/{scope === 'top' ? 'top-risks' : 'risks'}</code>.
      </p>
    </div>
  );
}

const th: React.CSSProperties = { padding: '8px 10px', fontWeight: 600 };
const td: React.CSSProperties = { padding: '8px 10px' };
