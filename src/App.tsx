import { GrowthDashboard } from './pages/GrowthDashboard';

export default function App() {
  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <strong>AI 面试成长 OS</strong>
          <span>面向 AI 产品经理求职的复盘工作台</span>
        </div>
        <nav aria-label="主导航">
          <a href="#growth">成长总览</a>
          <a href="#jobs">岗位档案</a>
          <a href="#assets">回答库</a>
        </nav>
      </header>
      <GrowthDashboard />
    </main>
  );
}
