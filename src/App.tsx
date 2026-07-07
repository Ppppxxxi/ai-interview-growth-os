import { useState } from 'react';
import { jobFiles } from './domain/sampleData';
import { AssetsAndTraining } from './pages/AssetsAndTraining';
import { InterviewReview } from './pages/InterviewReview';
import { JobFileDetail } from './pages/JobFileDetail';
import { GrowthDashboard } from './pages/GrowthDashboard';

type AppView = 'growth' | 'jobs' | 'reviews' | 'assets';

export default function App() {
  const [view, setView] = useState<AppView>('growth');
  const [selectedJobId, setSelectedJobId] = useState(jobFiles[0]?.id ?? '');

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <strong>AI 面试成长 OS</strong>
          <span>面向 AI 产品经理求职的复盘工作台</span>
        </div>
        <nav aria-label="主导航">
          <button className={view === 'growth' ? 'nav-button nav-button--active' : 'nav-button'} type="button" onClick={() => setView('growth')}>
            成长总览
          </button>
          <button className={view === 'jobs' ? 'nav-button nav-button--active' : 'nav-button'} type="button" onClick={() => setView('jobs')}>
            岗位档案
          </button>
          <button className={view === 'reviews' ? 'nav-button nav-button--active' : 'nav-button'} type="button" onClick={() => setView('reviews')}>
            面试复盘
          </button>
          <button className={view === 'assets' ? 'nav-button nav-button--active' : 'nav-button'} type="button" onClick={() => setView('assets')}>
            资产与训练
          </button>
        </nav>
      </header>
      {view === 'growth' && <GrowthDashboard />}
      {view === 'jobs' && <JobFileDetail selectedJobId={selectedJobId} onSelectJob={setSelectedJobId} />}
      {view === 'reviews' && <InterviewReview />}
      {view === 'assets' && <AssetsAndTraining />}
    </main>
  );
}
