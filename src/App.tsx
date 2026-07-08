import { useState } from 'react';
import { jobFiles } from './domain/sampleData';
import { AssetsAndTraining } from './pages/AssetsAndTraining';
import { GrowthDashboard } from './pages/GrowthDashboard';
import { JobFileDetail } from './pages/JobFileDetail';

type AppView = 'workspace' | 'assets' | 'growth';

const navItems: Array<{ id: AppView; label: string }> = [
  { id: 'workspace', label: '岗位工作台' },
  { id: 'assets', label: '回答资产库' },
  { id: 'growth', label: '全局成长' }
];

export default function App() {
  const [view, setView] = useState<AppView>('workspace');
  const [selectedJobId, setSelectedJobId] = useState(jobFiles[0]?.id ?? '');

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <strong>AI 面试成长 OS</strong>
          <span>把外部 AI 面试对话沉淀成下次可用回答</span>
        </div>
        <nav aria-label="主导航">
          {navItems.map((item) => (
            <button
              className={view === item.id ? 'nav-button nav-button--active' : 'nav-button'}
              key={item.id}
              type="button"
              onClick={() => setView(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </header>
      {view === 'workspace' && (
        <JobFileDetail selectedJobId={selectedJobId} onSelectJob={setSelectedJobId} onOpenAssets={() => setView('assets')} />
      )}
      {view === 'assets' && <AssetsAndTraining />}
      {view === 'growth' && <GrowthDashboard />}
    </main>
  );
}
