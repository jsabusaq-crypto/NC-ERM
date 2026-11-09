import { useEffect, useMemo, useState } from 'react';
import { DIR_FOR, I18nContext, t as translate, type Lang } from './i18n/index.ts';
import { Dashboard } from './pages/Dashboard.tsx';
import { RiskRegister } from './pages/RiskRegister.tsx';

type Tab = 'dashboard' | 'register' | 'top' | 'audit';

export function App() {
  const [lang, setLang] = useState<Lang>('ar');
  const [tab, setTab] = useState<Tab>('dashboard');
  const dir = DIR_FOR[lang];

  // §2: flip language + direction on <html> together.
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
  }, [lang, dir]);

  const i18n = useMemo(
    () => ({ lang, dir, t: (k: string) => translate(k, lang), setLang }),
    [lang, dir],
  );

  return (
    <I18nContext.Provider value={i18n}>
      <header className="app-header">
        <div>
          <strong>{i18n.t('app_title')}</strong>
          <div style={{ fontSize: 12, opacity: 0.85 }}>{i18n.t('cluster')}</div>
        </div>
        <nav style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <TabBtn active={tab === 'dashboard'} onClick={() => setTab('dashboard')}>{i18n.t('nav_dashboard')}</TabBtn>
          <TabBtn active={tab === 'register'} onClick={() => setTab('register')}>{i18n.t('nav_register')}</TabBtn>
          <TabBtn active={tab === 'top'} onClick={() => setTab('top')}>{i18n.t('nav_top_risks')}</TabBtn>
          <TabBtn active={tab === 'audit'} onClick={() => setTab('audit')}>{i18n.t('nav_audit')}</TabBtn>
          <button className="btn ghost" onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}>
            {i18n.t('switch_lang')}
          </button>
        </nav>
      </header>

      <main style={{ padding: 20, maxWidth: 1200, margin: '0 auto' }}>
        {tab === 'dashboard' && <Dashboard />}
        {tab === 'register' && <RiskRegister scope="all" />}
        {tab === 'top' && <RiskRegister scope="top" />}
        {tab === 'audit' && <Placeholder title={i18n.t('nav_audit')} />}
      </main>
    </I18nContext.Provider>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      className="btn ghost"
      onClick={onClick}
      style={active ? { background: 'rgba(255,255,255,.22)' } : undefined}
    >
      {children}
    </button>
  );
}

function Placeholder({ title }: { title: string }) {
  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>{title}</h2>
      <p style={{ color: 'var(--text-muted)' }}>
        Scaffolded screen — wires to <code>/api/audit</code>. See docs/REQUIREMENTS.md §7.
      </p>
    </div>
  );
}
