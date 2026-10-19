import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArchiveRestore,
  Download,
  Upload,
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
import { mergeWorkspaceEdit, WorkspaceConflictError } from './workflow/mergeWorkspaceEdit';
import { getMaterialDraftQueue } from './materials/draftQueue';
import { configureWorkspaceFence, invalidateWorkspaceEpoch } from './materials/workspaceFence';
import { clearAllUserData, deleteMaterial, persistMaterialUpdate, readUserBackup, resumePendingDeletions, type WorkspaceStore } from './materials/workspaceDataCoordinator';
import { MAX_BACKUP_BYTES, restoreUserBackup, validateUserBackup } from './materials/backup';

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

  let initialError = '';
  let storage: ReturnType<typeof getBrowserStorage>;
  try { storage = getBrowserStorage(); } catch { initialError = '本地存储不可用'; }
  const fallback = createEmptyPersonalWorkspaceData();
  let persisted = false;
  let workspace = fallback;
  try { persisted = hasPersonalWorkspace(storage); workspace = readPersonalWorkspace(storage, fallback); }
  catch { initialError = '本地数据读取失败，请重试'; }
  const sampleJobIds = initialJobFiles.map((job) => job.id);
  const hasData = hasRealWorkspaceData(workspace, sampleJobIds);

  return {
    hasStarted: persisted,
    view: hasData ? ('workspace' as AppView) : ('focus' as AppView),
    workspace,
    initialError,
    isPreviewMode
  };
}

export default function App() {
  const [initialAppState] = useState(createInitialAppState);
  const [view, setView] = useState<AppView>(initialAppState.view);
  const [workspaceData, setWorkspaceData] = useState(initialAppState.workspace);
  const workspaceSnapshot = useRef(workspaceData); workspaceSnapshot.current = workspaceData;
  const [dataError, setDataError] = useState(initialAppState.initialError ?? '');
  const [maintaining, setMaintaining] = useState(true);
  const [recoveryNeeded, setRecoveryNeeded] = useState(false);
  const [journalState, setJournalState] = useState<'unknown' | 'pending' | 'ready'>('unknown');
  const [isolatedEditing, setIsolatedEditing] = useState(false);
  const [isolatedWorkspace] = useState(createEmptyPersonalWorkspaceData);
  const [exporting, setExporting] = useState(false);
  const blocked = useRef(true);
  const mounted = useRef(true);
  const revision = useRef(0);
  const [contentRevision, setContentRevision] = useState(0);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; blocked.current = true; revision.current += 1; }; }, []);
  const [isDataMenuOpen, setIsDataMenuOpen] = useState(false);
  const dataMenuRef = useRef<HTMLDetailsElement>(null);
  const materialsGuard = useRef<(() => boolean) | null>(null);
  const registerMaterialsGuard = useCallback((guard: (() => boolean) | null) => { materialsGuard.current = guard; }, []);
  const [materialRepository] = useState(() => createMaterialRepository(initialAppState.isPreviewMode ? {
    open: (name: string, version?: number) => globalThis.indexedDB.open(`${name}-preview`, version)
  } as IDBFactory : undefined));
  const materials = useMaterials(materialRepository);
  const [workspaceStore] = useState<WorkspaceStore>(() => ({
    read() {
      const storage = getBrowserStorage();
      if (!storage) throw new Error('本地存储不可用');
      const scoped = initialAppState.isPreviewMode ? {
        getItem: (key: string) => storage.getItem(`${key}:preview`),
        setItem: (key: string, value: string) => storage.setItem(`${key}:preview`, value),
        removeItem: (key: string) => storage.removeItem(`${key}:preview`),
      } : storage;
      return readPersonalWorkspace(scoped, initialAppState.workspace);
    },
    async write(data) {
      const storage = getBrowserStorage();
      if (!storage) throw new Error('本地存储不可用');
      writePersonalWorkspace(initialAppState.isPreviewMode ? {
        getItem: (key: string) => storage.getItem(`${key}:preview`),
        setItem: (key: string, value: string) => storage.setItem(`${key}:preview`, value),
        removeItem: (key: string) => storage.removeItem(`${key}:preview`),
      } : storage, data);
    },
  }));
  const saveWorkspace = useCallback(async (update: (current: typeof workspaceData) => typeof workspaceData) => {
    const expected = contentRevision;
    const base = workspaceSnapshot.current;
    try {
      if (!mounted.current || blocked.current || expected !== revision.current) throw new Error('数据正在更新');
      await getMaterialDraftQueue(materialRepository).run(async () => {
        if (!mounted.current || blocked.current || expected !== revision.current) throw new Error('数据正在更新');
        const next = mergeWorkspaceEdit(base, update(base), workspaceStore.read());
        await workspaceStore.write(next);
        workspaceSnapshot.current = next; setWorkspaceData(next); setDataError('');
      });
    } catch (error) { setDataError(error instanceof WorkspaceConflictError ? error.message : '保存失败，当前修改尚未保存，请重试'); throw error; }
  }, [contentRevision, materialRepository, workspaceStore]);
  const handleFlowDraftSaveStarted = useCallback(() => saveWorkspace(current => current), [saveWorkspace]);
  const maintain = useCallback(async (operation: () => Promise<void>, nextView?: AppView) => {
    blocked.current = true; revision.current += 1; setMaintaining(true); setContentRevision(revision.current);
    // Unmount editors and abort generation before entering the shared queue.
    await new Promise<void>(resolve => setTimeout(resolve, 0));
    if (!mounted.current) return;
    try {
      await operation();
      if (!mounted.current) return;
      const stored = workspaceStore.read(); workspaceSnapshot.current = stored; setWorkspaceData(stored);
      await materials.refresh();
      if (nextView) setView(nextView);
      setDataError(''); setRecoveryNeeded(false); setJournalState('ready'); blocked.current = false; setMaintaining(false);
    } catch { setDataError('数据操作未完成，请重试恢复；当前数据不会被标记为已保存'); setRecoveryNeeded(true); setMaintaining(false); }
  }, [workspaceStore, materials.refresh]);
  const recover = useCallback(() => {
    try {
      const storage = getBrowserStorage(); if (!storage) throw new Error('storage unavailable');
      configureWorkspaceFence(materialRepository, storage, `ai-interview-growth-os${initialAppState.isPreviewMode ? ':preview' : ''}`);
      setJournalState('unknown');
      return maintain(() => resumePendingDeletions(materialRepository, workspaceStore, pending => setJournalState(pending ? 'pending' : 'ready')));
    } catch { setDataError('本地存储不可用，请重试'); setRecoveryNeeded(true); setMaintaining(false); return Promise.resolve(); }
  }, [materialRepository, workspaceStore, maintain, initialAppState.isPreviewMode]);
  useEffect(() => {
    void recover();
    try {
    const storage = getBrowserStorage(); if (!storage) return;
    const fence = configureWorkspaceFence(materialRepository, storage, `ai-interview-growth-os${initialAppState.isPreviewMode ? ':preview' : ''}`);
    return fence.subscribe(() => { void recover(); });
    } catch { setDataError('本地存储不可用，请重试'); }
  }, [recover, materialRepository, initialAppState.isPreviewMode]);

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

  function switchView(nextView: AppView) {
    setIsDataMenuOpen(false);
    if (nextView !== view && materialsGuard.current && !materialsGuard.current()) return;
    setView(nextView);
  }

  async function handleRestoreExample() {
    setIsDataMenuOpen(false);
    if (materialsGuard.current && !materialsGuard.current()) return;
    const confirmed = window.confirm(
      '恢复示例仅覆盖岗位、面试、复盘和回答；我的资料与资料草稿保留。是否继续？'
    );
    if (!confirmed) return;
    await maintain(() => getMaterialDraftQueue(materialRepository).run(async () => {
      invalidateWorkspaceEpoch(materialRepository);
      await workspaceStore.write(createSampleWorkspaceData());
    }, { maintenance: true }), 'workspace');
  }

  async function handleClearLocalData() {
    setIsDataMenuOpen(false);
    if (materialsGuard.current && !materialsGuard.current()) return;
    const confirmed = window.confirm(
      '清空本地数据将删除资料、草稿、引用、岗位、面试、复盘和回答；已有备份无法撤回。是否继续？'
    );
    if (!confirmed) return;
    await maintain(() => clearAllUserData(materialRepository, workspaceStore), 'focus');
  }

  function handleSaveAsset(asset: AnswerAsset) {
    return saveWorkspace((current) => ({
      ...current,
      answerAssets: upsertAnswerAsset(current.answerAssets, asset),
      updatedAt: new Date().toISOString()
    }));
  }

  function handleSelectJob(jobId: string) {
    return saveWorkspace((current) => ({
      ...current,
      selectedJobId: jobId,
      updatedAt: new Date().toISOString()
    })).catch(() => {});
  }

  function handleCreateJob(draft: NewJobDraft) {
    return saveWorkspace((current) => {
      const nextJob = createJobFileFromDraft(draft, current.jobFiles.length);
      return {
        ...current,
        jobFiles: upsertJobFile(current.jobFiles, nextJob),
        selectedJobId: nextJob.id,
        updatedAt: new Date().toISOString()
      };
    });
  }

  function handleUpdateJob(nextJob: JobFile, original?: JobFile) {
    return saveWorkspace((current) => {
      if (original && JSON.stringify(current.jobFiles.find(job => job.id === original.id)) !== JSON.stringify(original)) throw new WorkspaceConflictError();
      return ({
      ...current,
      jobFiles: upsertJobFile(current.jobFiles, nextJob),
      updatedAt: new Date().toISOString()
    }); });
  }

  function handleDeleteJob(jobId: string) {
    return saveWorkspace((current) => {
      if (current.jobFiles.length <= 1) return current;
      return removeJobFile(current, jobId);
    });
  }

  function handleSaveInterviewRecord(
    session: InterviewSession,
    review: ReviewReport
  ) {
    return saveWorkspace((current) => ({
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
    return saveWorkspace((current) => removeInterviewRecord(current, sessionId));
  }

  async function exportBackup() {
    if (blocked.current || exporting) return;
    setExporting(true);
    let url: string | undefined;
    try {
      const backup = await readUserBackup(materialRepository, workspaceStore, { recoverPending: false });
      url = URL.createObjectURL(new Blob([JSON.stringify(backup)], { type: 'application/json' }));
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'interview-backup.json'; anchor.click(); URL.revokeObjectURL(url);
      url = undefined;
      setDataError(current => current.startsWith('导出备份失败') ? '' : current);
    } catch { setDataError('导出备份失败，未保存的编辑仍保留，请重试'); }
    finally { if (url) URL.revokeObjectURL(url); setExporting(false); }
  }
  async function importBackup(file: File) {
    try {
      if (file.size > MAX_BACKUP_BYTES) throw new Error('too large');
      const backup = validateUserBackup(JSON.parse(await file.text()));
      if (!window.confirm('恢复备份会覆盖本地资料、草稿、岗位、面试和回答，是否继续？')) return;
      await maintain(() => restoreUserBackup(backup, materialRepository, workspaceStore), 'workspace');
    } catch { setDataError('备份无效或超过 20 MiB，当前数据未更改'); }
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
              <button type="button" className="ghost-action" disabled={maintaining || recoveryNeeded || exporting} onClick={() => { void exportBackup(); }}><Download size={16} />导出备份</button>
              <label className="ghost-action"><Upload size={16} />恢复备份<input aria-label="恢复备份" type="file" accept=".json,application/json" disabled={maintaining || recoveryNeeded} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void importBackup(file); }} /></label>
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
        {dataError && <p role="alert">{dataError}{(maintaining || recoveryNeeded) && <button type="button" onClick={() => { void recover(); }}>重试恢复</button>}</p>}
        {maintaining && <p role="status">正在检查本地数据</p>}
        {recoveryNeeded && <aside role="status">
          <p>{journalState === 'unknown' ? '日志状态未知：历史数据只读，原草稿与引用暂不写入。' : '存在未完成的数据操作：历史数据只读，等待恢复。'}</p>
          {!isolatedEditing && <button type="button" onClick={() => setIsolatedEditing(true)}>独立无参考编辑</button>}
        </aside>}
        {isolatedEditing && <section aria-label="临时无参考编辑">
          <p>临时未保存内容，不使用旧资料与草稿；本地恢复后仍需结束此编辑并重新整理保存。</p>
          <button type="button" onClick={() => { if (window.confirm('结束会丢弃临时未保存内容，是否继续？')) setIsolatedEditing(false); }}>结束临时编辑</button>
          <FocusFlowPage selectedJobId={isolatedWorkspace.selectedJobId} jobFiles={isolatedWorkspace.jobFiles}
            materialsError="临时无参考编辑未持久化，不能报告保存成功"
            onUpdateJob={async () => { throw new Error('临时内容未保存'); }}
            onSaveInterviewRecord={async () => { throw new Error('临时内容未保存'); }}
            onSaveAsset={async () => { throw new Error('临时内容未保存'); }} onFinish={() => {}} />
        </section>}
        <div key={contentRevision}>
        <fieldset style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }} disabled={recoveryNeeded}>
        {!maintaining && !recoveryNeeded && !isolatedEditing && view === 'focus' && (
          <FocusFlowPage
            onDraftSaveStarted={handleFlowDraftSaveStarted}
            repository={materialRepository}
            materialsLoading={materials.loading}
            materialsError={materials.error}
            onRetryMaterials={materials.refresh}
            materialChunks={materials.chunks}
            selectedJobId={workspaceData.selectedJobId}
            jobFiles={workspaceData.jobFiles}
            onUpdateJob={handleUpdateJob}
            onSaveInterviewRecord={handleSaveInterviewRecord}
            onSaveAsset={handleSaveAsset}
            onFinish={(target) => {
              setIsDataMenuOpen(false);
              setView(target);
            }}
          />
        )}
        {!maintaining && view === 'workspace' && (
          <WorkspaceHome
            data={workspaceData}
            onSelectJob={handleSelectJob}
            onOpenJob={() => switchView('job')}
            onOpenAssets={() => switchView('assets')}
            onOpenGrowth={() => switchView('growth')}
            onStartNew={() => switchView('focus')}
          />
        )}
        {!maintaining && view === 'job' && (
          <JobFileDetail
            onNavigationGuardChange={registerMaterialsGuard}
            materialChunks={materials.chunks}
            materialsLoading={materials.loading}
            materialsError={materials.error}
            onRetryMaterials={materials.refresh}
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
        {!maintaining && view === 'assets' && (
          <AssetsAndTraining
            answerAssets={workspaceData.answerAssets}
            interviewSessions={workspaceData.interviewSessions}
            jobFiles={workspaceData.jobFiles}
            onUpdateAsset={handleSaveAsset}
          />
        )}
        {!maintaining && view === 'growth' && (
          <GrowthDashboard
            answerAssets={workspaceData.answerAssets}
            jobFiles={workspaceData.jobFiles}
            reviewReports={workspaceData.reviewReports}
          />
        )}
        {!maintaining && view === 'materials' && <MyMaterials repository={materialRepository}
          onDeleteMaterial={async id => { await maintain(() => deleteMaterial(id, materialRepository, workspaceStore), 'materials'); if (blocked.current) throw new Error('删除未完成'); }}
          onPersistDocument={async (id, fromVersion, write) => {
            try {
              const result = fromVersion === null ? await getMaterialDraftQueue(materialRepository).run(write) : await persistMaterialUpdate(id, fromVersion, materialRepository, workspaceStore, write);
              const stored = workspaceStore.read(); workspaceSnapshot.current = stored; setWorkspaceData(stored); return result;
            } catch (error) { setDataError('资料保存未完成，编辑内容仍保留，请重试或恢复'); setRecoveryNeeded(true); throw error; }
          }}
          onMaterialsChanged={() => { void materials.refresh(); }} onNavigationGuardChange={registerMaterialsGuard} />}
        </fieldset>
        </div>
      </div>
    </main>
  );
}
