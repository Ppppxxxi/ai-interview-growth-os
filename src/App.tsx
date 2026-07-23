import { useEffect, useState } from 'react';
import {
  answerAssets as initialAnswerAssets,
  interviewSessions as initialInterviewSessions,
  jobFiles as initialJobFiles,
  reviewReports as initialReviewReports
} from './domain/sampleData';
import type { AnswerAsset, InterviewSession, JobFile, ReviewReport } from './domain/types';
import { AssetsAndTraining } from './pages/AssetsAndTraining';
import { FocusFlowPage } from './pages/FocusFlowPage';
import { GrowthDashboard } from './pages/GrowthDashboard';
import { JobFileDetail } from './pages/JobFileDetail';
import {
  attachInterviewSessionToJob,
  clearPersonalWorkspace,
  createEmptyPersonalWorkspaceData,
  createJobFileFromDraft,
  createPersonalWorkspaceData,
  getBrowserStorage,
  hasRealWorkspaceData,
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

type AppView = 'focus' | 'workspace' | 'assets' | 'growth';

const navItems: Array<{ id: AppView; label: string }> = [
  { id: 'workspace', label: '工作台' },
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

function createInitialAppState() {
  const storage = getBrowserStorage();
  const fallback = createEmptyPersonalWorkspaceData();
  const persisted = hasPersonalWorkspace(storage);
  const workspace = persisted ? readPersonalWorkspace(storage, fallback) : fallback;
  const sampleJobIds = initialJobFiles.map((job) => job.id);
  const hasData = hasRealWorkspaceData(workspace, sampleJobIds);

  return {
    hasStarted: persisted,
    view: hasData ? ('workspace' as AppView) : ('focus' as AppView),
    workspace
  };
}

export default function App() {
  const [initialAppState] = useState(createInitialAppState);
  const [view, setView] = useState<AppView>(initialAppState.view);
  const [hasStarted, setHasStarted] = useState(initialAppState.hasStarted);
  const [workspaceData, setWorkspaceData] = useState(initialAppState.workspace);

  useEffect(() => {
    if (!hasStarted) return;
    writePersonalWorkspace(getBrowserStorage(), workspaceData);
  }, [hasStarted, workspaceData]);

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
    setView('focus');
  }

  function handleSaveAsset(asset: AnswerAsset) {
    setHasStarted(true);
    setWorkspaceData((current) => ({
      ...current,
      answerAssets: upsertAnswerAsset(current.answerAssets, asset),
      updatedAt: new Date().toISOString()
    }));
  }

  function handleSelectJob(jobId: string) {
    setHasStarted(true);
    setWorkspaceData((current) => ({
      ...current,
      selectedJobId: jobId,
      updatedAt: new Date().toISOString()
    }));
  }

  function handleCreateJob(draft: NewJobDraft) {
    setHasStarted(true);
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
    setHasStarted(true);
    setWorkspaceData((current) => ({
      ...current,
      jobFiles: upsertJobFile(current.jobFiles, nextJob),
      updatedAt: new Date().toISOString()
    }));
  }

  function handleDeleteJob(jobId: string) {
    setHasStarted(true);
    setWorkspaceData((current) => {
      if (current.jobFiles.length <= 1) return current;
      return removeJobFile(current, jobId);
    });
  }

  function handleSaveInterviewRecord(session: InterviewSession, review: ReviewReport) {
    setHasStarted(true);
    setWorkspaceData((current) => ({
      ...current,
      interviewSessions: upsertInterviewSession(current.interviewSessions, session),
      reviewReports: upsertReviewReport(current.reviewReports, review),
      jobFiles: attachInterviewSessionToJob(current.jobFiles, session),
      updatedAt: new Date().toISOString()
    }));
  }

  function handleDeleteInterviewRecord(sessionId: string) {
    setHasStarted(true);
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
              <button
                className={view === 'focus' ? 'nav-button nav-button--active' : 'nav-button'}
                type="button"
                onClick={() => setView('focus')}
              >
                开始新面试
              </button>
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
      {!hasStarted && view === 'focus' && (
        <FocusFlowPage
          selectedJobId={workspaceData.selectedJobId}
          jobFiles={workspaceData.jobFiles}
          onUpdateJob={handleUpdateJob}
          onSaveInterviewRecord={handleSaveInterviewRecord}
          onSaveAsset={handleSaveAsset}
          onFinish={(target) => {
            setHasStarted(true);
            setView(target);
          }}
          onUseExample={handleStartWithExample}
        />
      )}
      {hasStarted && view === 'focus' && (
        <FocusFlowPage
          selectedJobId={workspaceData.selectedJobId}
          jobFiles={workspaceData.jobFiles}
          onUpdateJob={handleUpdateJob}
          onSaveInterviewRecord={handleSaveInterviewRecord}
          onSaveAsset={handleSaveAsset}
          onFinish={(target) => setView(target)}
          onUseExample={handleStartWithExample}
        />
      )}
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
          onStartFocus={() => setView('focus')}
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
