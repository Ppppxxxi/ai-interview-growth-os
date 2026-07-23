import { useEffect, useState } from 'react';
import {
  answerAssets as initialAnswerAssets,
  interviewSessions as initialInterviewSessions,
  jobFiles as initialJobFiles,
  reviewReports as initialReviewReports
} from './domain/sampleData';
import type { AnswerAsset, InterviewSession, JobFile, ReviewReport } from './domain/types';
import { AssetsAndTraining } from './pages/AssetsAndTraining';
import { GrowthDashboard } from './pages/GrowthDashboard';
import { JobFileDetail } from './pages/JobFileDetail';
import {
  attachInterviewSessionToJob,
  clearPersonalWorkspace,
  createEmptyPersonalWorkspaceData,
  createJobFileFromDraft,
  createPersonalWorkspaceData,
  getBrowserStorage,
  hasPersonalWorkspace,
  type NewJobDraft,
  readPersonalWorkspace,
  removeJobFile,
  removeInterviewRecord,
  upsertInterviewSession,
  upsertJobFile,
  upsertReviewReport,
  writePersonalWorkspace
} from './workflow/personalWorkspace';
import { upsertAnswerAsset } from './workflow/runtimeAssets';

type AppView = 'workspace' | 'assets' | 'growth';

const navItems: Array<{ id: AppView; label: string }> = [
  { id: 'workspace', label: '生成本场回答' },
  { id: 'assets', label: '我的回答库' },
  { id: 'growth', label: '面试复盘' }
];

function createSampleWorkspaceData() {
  return createPersonalWorkspaceData(
    initialJobFiles,
    initialAnswerAssets,
    initialJobFiles[0]?.id ?? '',
    new Date().toISOString(),
    initialInterviewSessions,
    initialReviewReports
  );
}

export default function App() {
  const [view, setView] = useState<AppView>('workspace');
  const [hasStarted, setHasStarted] = useState(() => hasPersonalWorkspace(getBrowserStorage()));
  const [workspaceData, setWorkspaceData] = useState(() => {
    const fallback = createEmptyPersonalWorkspaceData();
    return hasPersonalWorkspace(getBrowserStorage()) ? readPersonalWorkspace(getBrowserStorage(), fallback) : fallback;
  });

  useEffect(() => {
    if (!hasStarted) return;
    writePersonalWorkspace(getBrowserStorage(), workspaceData);
  }, [hasStarted, workspaceData]);

  function handleStartBlank() {
    setWorkspaceData(createEmptyPersonalWorkspaceData());
    setHasStarted(true);
    setView('workspace');
  }

  function handleStartWithExample() {
    setWorkspaceData(createSampleWorkspaceData());
    setHasStarted(true);
    setView('workspace');
  }

  function handleRestoreExample() {
    const confirmed = window.confirm('恢复示例数据会覆盖当前浏览器里的本地数据，是否继续？');
    if (!confirmed) return;
    setWorkspaceData(createSampleWorkspaceData());
    setHasStarted(true);
    setView('workspace');
  }

  function handleClearLocalData() {
    const confirmed = window.confirm('清空本地数据后，当前岗位、面试记录和回答资产会从这个浏览器删除，是否继续？');
    if (!confirmed) return;
    clearPersonalWorkspace(getBrowserStorage());
    setWorkspaceData(createEmptyPersonalWorkspaceData());
    setHasStarted(false);
    setView('workspace');
  }

  function handleSaveAsset(asset: AnswerAsset) {
    setWorkspaceData((current) => ({
      ...current,
      answerAssets: upsertAnswerAsset(current.answerAssets, asset),
      updatedAt: new Date().toISOString()
    }));
  }

  function handleSelectJob(jobId: string) {
    setWorkspaceData((current) => ({
      ...current,
      selectedJobId: jobId,
      updatedAt: new Date().toISOString()
    }));
  }

  function handleCreateJob(draft: NewJobDraft) {
    setWorkspaceData((current) => {
      const nextJob = createJobFileFromDraft(draft, current.jobFiles.length);
      return {
        ...current,
        jobFiles: upsertJobFile(current.jobFiles, nextJob),
        selectedJobId: nextJob.id,
        updatedAt: new Date().toISOString()
      };
    });
  }

  function handleUpdateJob(nextJob: JobFile) {
    setWorkspaceData((current) => ({
      ...current,
      jobFiles: upsertJobFile(current.jobFiles, nextJob),
      updatedAt: new Date().toISOString()
    }));
  }

  function handleDeleteJob(jobId: string) {
    setWorkspaceData((current) => {
      if (current.jobFiles.length <= 1) return current;
      return removeJobFile(current, jobId);
    });
  }

  function handleSaveInterviewRecord(session: InterviewSession, review: ReviewReport) {
    setWorkspaceData((current) => ({
      ...current,
      interviewSessions: upsertInterviewSession(current.interviewSessions, session),
      reviewReports: upsertReviewReport(current.reviewReports, review),
      jobFiles: attachInterviewSessionToJob(current.jobFiles, session),
      updatedAt: new Date().toISOString()
    }));
  }

  function handleDeleteInterviewRecord(sessionId: string) {
    setWorkspaceData((current) => removeInterviewRecord(current, sessionId));
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <strong>AI 面试成长 OS</strong>
          <span>导入面试材料，生成下次可用回答</span>
        </div>
        <div className="topbar-actions">
          {hasStarted && (
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
          )}
          {hasStarted && (
            <div className="data-actions" aria-label="本地数据管理">
              <button type="button" className="ghost-action" onClick={handleRestoreExample}>
                恢复示例
              </button>
              <button type="button" className="ghost-action" onClick={handleClearLocalData}>
                清空本地数据
              </button>
            </div>
          )}
        </div>
      </header>
      {!hasStarted && <WelcomePanel onStartBlank={handleStartBlank} onStartWithExample={handleStartWithExample} />}
      {hasStarted && view === 'workspace' && (
        <JobFileDetail
          selectedJobId={workspaceData.selectedJobId}
          onSelectJob={handleSelectJob}
          jobFiles={workspaceData.jobFiles}
          interviewSessions={workspaceData.interviewSessions}
          reviewReports={workspaceData.reviewReports}
          answerAssets={workspaceData.answerAssets}
          onCreateJob={handleCreateJob}
          onUpdateJob={handleUpdateJob}
          onDeleteJob={handleDeleteJob}
          onSaveInterviewRecord={handleSaveInterviewRecord}
          onDeleteInterviewRecord={handleDeleteInterviewRecord}
          onSaveAsset={handleSaveAsset}
          onOpenAssets={() => setView('assets')}
        />
      )}
      {hasStarted && view === 'assets' && (
        <AssetsAndTraining
          answerAssets={workspaceData.answerAssets}
          interviewSessions={workspaceData.interviewSessions}
          jobFiles={workspaceData.jobFiles}
          onUpdateAsset={handleSaveAsset}
        />
      )}
      {hasStarted && view === 'growth' && (
        <GrowthDashboard
          answerAssets={workspaceData.answerAssets}
          jobFiles={workspaceData.jobFiles}
          reviewReports={workspaceData.reviewReports}
        />
      )}
    </main>
  );
}

function WelcomePanel({
  onStartBlank,
  onStartWithExample
}: {
  onStartBlank: () => void;
  onStartWithExample: () => void;
}) {
  return (
    <section className="welcome-panel">
      <div>
        <p className="eyebrow">开始使用</p>
        <h1>粘贴面试材料，拿到下次可以直接改用的回答</h1>
        <p>
          不需要先整理完整档案。把 JD、模拟面试对话、真实面试回忆或复盘笔记粘贴进来，先生成可确认草稿，
          再保存你愿意复用的回答。
        </p>
        <div className="welcome-actions">
          <button type="button" className="primary-action" onClick={onStartBlank}>
            开始准备我的面试
          </button>
          <button type="button" className="secondary-action" onClick={onStartWithExample}>
            使用示例体验
          </button>
        </div>
      </div>
      <div className="welcome-flow" aria-label="产品流程">
        <article>
          <strong>1. 粘贴一整段材料</strong>
          <span>JD、问答、追问、点评或复盘笔记都可以混在一起</span>
        </article>
        <article>
          <strong>2. 检查可确认草稿</strong>
          <span>确认问题、原回答、具体问题和修改建议</span>
        </article>
        <article>
          <strong>3. 保存下次可用回答</strong>
          <span>保存到当前岗位，也能在回答库里继续修改</span>
        </article>
      </div>
    </section>
  );
}
