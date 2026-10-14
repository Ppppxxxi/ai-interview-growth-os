import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArchiveRestore,
  BriefcaseBusiness,
  ChevronDown,
  FileText,
  LayoutDashboard,
  Library,
  Plus,
  Radar,
  Trash2
} from 'lucide-react';
import {
  answerAssets as initialAnswerAssets,
  interviewSessions as initialInterviewSessions,
  jobFiles as initialJobFiles,
  reviewReports as initialReviewReports
} from './domain/sampleData';
import type {
  AnswerAsset,
  InterviewSession,
  JobFile,
  ReviewReport
} from './domain/types';
import { AssetsAndTraining } from './pages/AssetsAndTraining';
import { FocusFlowPage } from './pages/FocusFlowPage';
import { GrowthDashboard } from './pages/GrowthDashboard';
import { JobFileDetail } from './pages/JobFileDetail';
import { WorkspaceHome } from './pages/WorkspaceHome';
import { MyMaterials } from './pages/MyMaterials';
import { createMaterialRepository } from './materials/repository';
import { useMaterials } from './materials/useMaterials';
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

type AppView = 'focus' | 'workspace' | 'job' | 'assets' | 'growth' | 'materials';

const navItems: Array<{ id: AppView; label: string }> = [
  { id: 'workspace', label: '工作台' },
  { id: 'job', label: '目标岗位' },
  { id: 'assets', label: '我的回答库' },
  { id: 'materials', label: '我的资料' },
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
  const isPreviewMode =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('preview') === 'workspace';
  if (isPreviewMode) {
    return {
      hasStarted: false,
      view: 'focus' as AppView,
      workspace: createEmptyPersonalWorkspaceData(),
      isPreviewMode
    };
  }

  const storage = getBrowserStorage();
  const fallback = createEmptyPersonalWorkspaceData();
  const persisted = hasPersonalWorkspace(storage);
  const workspace = persisted
    ? readPersonalWorkspace(storage, fallback)
    : fallback;
  const sampleJobIds = initialJobFiles.map((job) => job.id);
  const hasData = hasRealWorkspaceData(workspace, sampleJobIds);

  return {
    hasStarted: persisted,
    view: hasData ? ('workspace' as AppView) : ('focus' as AppView),
    workspace,
    isPreviewMode
  };
}

export default function App() {
  const [initialAppState] = useState(createInitialAppState);
  const [view, setView] = useState<AppView>(initialAppState.view);
  const [hasStarted, setHasStarted] = useState(initialAppState.hasStarted);
  const [workspaceData, setWorkspaceData] = useState(initialAppState.workspace);
  const workspaceSnapshot = useRef(workspaceData); workspaceSnapshot.current = workspaceData;
  const handleFlowDraftPersisted = useCallback(() => {
    if (!initialAppState.isPreviewMode) writePersonalWorkspace(getBrowserStorage(), workspaceSnapshot.current);
    setHasStarted(true);
  }, [initialAppState.isPreviewMode]);
  const [isDataMenuOpen, setIsDataMenuOpen] = useState(false);
  const dataMenuRef = useRef<HTMLDetailsElement>(null);
  const materialsGuard = useRef<(() => boolean) | null>(null);
  const registerMaterialsGuard = useCallback((guard: (() => boolean) | null) => { materialsGuard.current = guard; }, []);
  const [materialRepository] = useState(() => createMaterialRepository(initialAppState.isPreviewMode ? {
    open: (name: string, version?: number) => globalThis.indexedDB.open(`${name}-preview`, version)
  } as IDBFactory : undefined));
  const materials = useMaterials(materialRepository);

  useEffect(() => {
    if (!isDataMenuOpen) return;
    function closeMenu(event: PointerEvent) {
      if (!dataMenuRef.current?.contains(event.target as Node))
        setIsDataMenuOpen(false);
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsDataMenuOpen(false);
    }
    document.addEventListener('pointerdown', closeMenu);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('pointerdown', closeMenu);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isDataMenuOpen]);

  useEffect(() => {
    if (!hasStarted || initialAppState.isPreviewMode) return;
    writePersonalWorkspace(getBrowserStorage(), workspaceData);
  }, [hasStarted, initialAppState.isPreviewMode, workspaceData]);

  function switchView(nextView: AppView) {
    setIsDataMenuOpen(false);
    if (nextView !== view && materialsGuard.current && !materialsGuard.current()) return;
    setView(nextView);
  }

  function handleRestoreExample() {
    setIsDataMenuOpen(false);
    if (materialsGuard.current && !materialsGuard.current()) return;
    const confirmed = window.confirm(
      '恢复示例数据会覆盖当前浏览器里的本地数据，是否继续？'
    );
    if (!confirmed) return;
    setWorkspaceData(createSampleWorkspaceData());
    setHasStarted(true);
    setView('workspace');
  }

  function handleClearLocalData() {
    setIsDataMenuOpen(false);
    if (materialsGuard.current && !materialsGuard.current()) return;
    const confirmed = window.confirm(
      '清空本地数据后，当前岗位、面试记录和我的回答库会从这个浏览器删除，是否继续？'
    );
    if (!confirmed) return;
    if (!initialAppState.isPreviewMode)
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

  function handleSaveInterviewRecord(
    session: InterviewSession,
    review: ReviewReport
  ) {
    setHasStarted(true);
    setWorkspaceData((current) => ({
      ...current,
      interviewSessions: upsertInterviewSession(
        current.interviewSessions,
        session
      ),
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
    <main className="app-shell app-shell--home app-shell--redesign">
      <header className="topbar">
        <div className="brand-lockup">
          <span className="brand-symbol">
            <Radar size={22} />
          </span>
          <strong>AI 面试成长 OS</strong>
        </div>
        <div className="topbar-actions">
          <nav aria-label="主导航">
            <button
              className={
                view === 'focus'
                  ? 'nav-button nav-button--active'
                  : 'nav-button'
              }
              type="button"
              onClick={() => switchView('focus')}
            >
              <Plus size={17} />
              开始新面试
            </button>
            {navItems.map((item) => (
              <button
                className={
                  view === item.id
                    ? 'nav-button nav-button--active'
                    : 'nav-button'
                }
                key={item.id}
                type="button"
                onClick={() => switchView(item.id)}
              >
                {item.id === 'workspace' ? (
                  <LayoutDashboard size={17} />
                ) : item.id === 'job' ? (
                  <BriefcaseBusiness size={17} />
                ) : item.id === 'assets' ? (
                  <Library size={17} />
                ) : item.id === 'materials' ? (
                  <FileText size={17} />
                ) : (
                  <Radar size={17} />
                )}
                {item.label}
              </button>
            ))}
          </nav>
        </div>
        <div className="sidebar-profile">
          <span>我</span>
          <div>
            <strong>我的成长空间</strong>
            <small>
              {workspaceData.answerAssets.length} 条回答 ·{' '}
              {workspaceData.interviewSessions.length} 场面试
            </small>
          </div>
        </div>
      </header>
      <div className="app-content">
        <div className="content-topbar">
          <span>
            我的空间 <span className="breadcrumb-divider">/</span>{' '}
            {view === 'focus'
              ? '开始新面试'
              : navItems.find((item) => item.id === view)?.label}
          </span>
          <details
            ref={dataMenuRef}
            className="data-menu"
            open={isDataMenuOpen}
            onToggle={(event) => setIsDataMenuOpen(event.currentTarget.open)}
          >
            <summary>
              数据管理 <ChevronDown size={14} />
            </summary>
            <div className="data-menu-list" aria-label="本地数据管理">
              <button
                type="button"
                className="ghost-action"
                onClick={handleRestoreExample}
              >
                <ArchiveRestore size={16} />
                恢复示例
              </button>
              <button
                type="button"
                className="ghost-action danger-ghost-action"
                onClick={handleClearLocalData}
              >
                <Trash2 size={16} />
                清空本地数据
              </button>
            </div>
          </details>
        </div>
        {view === 'focus' && (
          <FocusFlowPage
            onDraftPersisted={handleFlowDraftPersisted}
            repository={materialRepository}
            materialsLoading={materials.loading}
            materialChunks={materials.chunks}
            selectedJobId={workspaceData.selectedJobId}
            jobFiles={workspaceData.jobFiles}
            onUpdateJob={handleUpdateJob}
            onSaveInterviewRecord={handleSaveInterviewRecord}
            onSaveAsset={handleSaveAsset}
            onFinish={(target) => {
              setIsDataMenuOpen(false);
              setHasStarted(true);
              setView(target);
            }}
          />
        )}
        {view === 'workspace' && (
          <WorkspaceHome
            data={workspaceData}
            onSelectJob={handleSelectJob}
            onOpenJob={() => switchView('job')}
            onOpenAssets={() => switchView('assets')}
            onOpenGrowth={() => switchView('growth')}
            onStartNew={() => switchView('focus')}
          />
        )}
        {view === 'job' && (
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
            onOpenAssets={() => switchView('assets')}
            onStartFocus={() => switchView('focus')}
          />
        )}
        {view === 'assets' && (
          <AssetsAndTraining
            answerAssets={workspaceData.answerAssets}
            interviewSessions={workspaceData.interviewSessions}
            jobFiles={workspaceData.jobFiles}
            onUpdateAsset={handleSaveAsset}
          />
        )}
        {view === 'growth' && (
          <GrowthDashboard
            answerAssets={workspaceData.answerAssets}
            jobFiles={workspaceData.jobFiles}
            reviewReports={workspaceData.reviewReports}
          />
        )}
        {view === 'materials' && <MyMaterials repository={materialRepository} onMaterialsChanged={() => { void materials.refresh(); }} onNavigationGuardChange={registerMaterialsGuard} />}
      </div>
    </main>
  );
}
