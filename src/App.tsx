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
  createJobFileFromDraft,
  createPersonalWorkspaceData,
  getBrowserStorage,
  type NewJobDraft,
  readPersonalWorkspace,
  removeInterviewRecord,
  upsertInterviewSession,
  upsertJobFile,
  upsertReviewReport,
  writePersonalWorkspace
} from './workflow/personalWorkspace';
import { upsertAnswerAsset } from './workflow/runtimeAssets';

type AppView = 'workspace' | 'assets' | 'growth';

const navItems: Array<{ id: AppView; label: string }> = [
  { id: 'workspace', label: '岗位工作台' },
  { id: 'assets', label: '回答资产库' },
  { id: 'growth', label: '全局成长' }
];

export default function App() {
  const [view, setView] = useState<AppView>('workspace');
  const [workspaceData, setWorkspaceData] = useState(() =>
    readPersonalWorkspace(
      getBrowserStorage(),
      createPersonalWorkspaceData(
        initialJobFiles,
        initialAnswerAssets,
        initialJobFiles[0]?.id ?? '',
        new Date().toISOString(),
        initialInterviewSessions,
        initialReviewReports
      )
    )
  );

  useEffect(() => {
    writePersonalWorkspace(getBrowserStorage(), workspaceData);
  }, [workspaceData]);

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
        <JobFileDetail
          selectedJobId={workspaceData.selectedJobId}
          onSelectJob={handleSelectJob}
          jobFiles={workspaceData.jobFiles}
          interviewSessions={workspaceData.interviewSessions}
          reviewReports={workspaceData.reviewReports}
          answerAssets={workspaceData.answerAssets}
          onCreateJob={handleCreateJob}
          onUpdateJob={handleUpdateJob}
          onSaveInterviewRecord={handleSaveInterviewRecord}
          onDeleteInterviewRecord={handleDeleteInterviewRecord}
          onSaveAsset={handleSaveAsset}
          onOpenAssets={() => setView('assets')}
        />
      )}
      {view === 'assets' && (
        <AssetsAndTraining
          answerAssets={workspaceData.answerAssets}
          interviewSessions={workspaceData.interviewSessions}
          jobFiles={workspaceData.jobFiles}
        />
      )}
      {view === 'growth' && (
        <GrowthDashboard
          answerAssets={workspaceData.answerAssets}
          jobFiles={workspaceData.jobFiles}
          reviewReports={workspaceData.reviewReports}
        />
      )}
    </main>
  );
}
