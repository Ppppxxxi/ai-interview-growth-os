import { useCallback, useEffect, useRef, useState } from 'react';
import { FileText, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import type { MaterialDocument, MaterialDraft, MaterialKind } from '../domain/materialTypes';
import { LLM_LIMITS } from '../domain/llmContracts';
import { MaterialEditor } from '../components/materials/MaterialEditor';
import { importDocument, type PageText } from '../materials/importDocument';
import type { MaterialRepository } from '../materials/repository';
import { useMaterials } from '../materials/useMaterials';
import { getMaterialDraftQueue } from '../materials/draftQueue';

type Props = {
  repository: MaterialRepository;
  onMaterialsChanged?: () => void;
  onDeleteMaterial?: (documentId: string) => Promise<void>;
  onPersistDocument?: <T>(documentId: string, fromVersion: number | null, write: () => Promise<T>) => Promise<T>;
  onNavigationGuardChange?: (guard: (() => boolean) | null) => void;
};
type Editing = { draft: MaterialDraft; original?: MaterialDocument; dirty: boolean; restored: boolean; pages?: PageText[]; textEdited?: boolean };
export function MyMaterials({ repository, onMaterialsChanged, onDeleteMaterial, onPersistDocument, onNavigationGuardChange }: Props) {
  const materials = useMaterials(repository);
  const [kind, setKind] = useState<MaterialKind>('experience');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState('');
  const [editing, setEditing] = useState<Editing>();
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [drafts, setDrafts] = useState<MaterialDraft[]>([]);
  const [draftError, setDraftError] = useState('');
  const alive = useRef(true);
  const draftQueue = getMaterialDraftQueue(repository);
  const draftRequest = useRef(0);
  const current = useRef({ editing, busy }); current.current = { editing, busy };
  const loadDrafts = useCallback(async () => {
    const request = ++draftRequest.current;
    try {
      const items = await draftQueue.run(() => repository.listDrafts());
      if (alive.current && request === draftRequest.current) { setDrafts(items.filter(item => !item.questionId)); setDraftError(''); }
    }
    catch { if (alive.current && request === draftRequest.current) setDraftError('草稿加载失败'); }
  }, [repository, draftQueue]);
  useEffect(() => { alive.current = true; void loadDrafts(); return () => { alive.current = false; }; }, [loadDrafts]);
  const canLeave = useCallback(() => !current.current.busy && (!current.current.editing?.dirty || window.confirm('有未保存修改，是否离开？')), []);
  useEffect(() => {
    onNavigationGuardChange?.(canLeave);
    const unload = (event: BeforeUnloadEvent) => {
      if (current.current.editing?.dirty || current.current.busy) { event.preventDefault(); event.returnValue = ''; }
    };
    window.addEventListener('beforeunload', unload);
    return () => { onNavigationGuardChange?.(null); window.removeEventListener('beforeunload', unload); };
  }, [canLeave, onNavigationGuardChange]);
  function enqueueDraft(draft: MaterialDraft) {
    if (!alive.current) return;
    void draftQueue.run(() => repository.saveDraft(draft)).then(() => {
      if (alive.current) setDraftError('');
    }).catch(() => { if (alive.current) setDraftError('草稿保存失败，请重试'); });
  }
  function changeDraft(draft: MaterialDraft) {
    if (!editing) return;
    if (draft.text !== editing.draft.text) setConfirmed(false);
    // Once text changes, discard import pages even if the user subsequently types the original text.
    setEditing({ ...editing, draft, dirty: true, textEdited: editing.textEdited || draft.text !== editing.draft.text, pages: draft.text === editing.draft.text ? editing.pages : undefined });
    enqueueDraft(draft);
  }
  function start(document?: MaterialDocument) {
    if (!canLeave()) return;
    const draft: MaterialDraft = document ? { ...document, id: `material-editor:${document.id}`, documentId: document.id,
      documentVersion: document.version, selectedChunks: [] } : { id: crypto.randomUUID(), kind, title: '', text: '', tags: [], sourceFormat: 'paste', selectedChunks: [], updatedAt: new Date().toISOString() };
    setEditing({ draft, original: document, dirty: false, restored: false }); setConfirmed(false); setError('');
  }
  async function restore(draft: MaterialDraft) {
    if (!canLeave()) return;
    setBusy(true);
    try {
      const restored = await draftQueue.run(async () => {
        const latest = (await repository.listDrafts()).find(item => item.id === draft.id);
        if (!latest) throw new Error('missing draft');
        const original = latest.documentId ? await repository.getDocument(latest.documentId) : undefined;
        return { draft: latest, original };
      });
      draft = restored.draft;
      const { original } = restored;
      if (draft.documentId && (!original || original.version !== draft.documentVersion)) throw new Error('conflict');
      setKind(draft.kind); setEditing({ draft, original, dirty: true, restored: true, textEdited: true }); setConfirmed(false); setError('');
    } catch { setError('草稿对应资料已变更，请重新打开资料'); }
    finally { setBusy(false); }
  }
  async function upload(file: File) {
    if (!editing) return;
    setBusy(true); setError('');
    try {
      const imported = await importDocument(file);
      if (!alive.current) return;
      const draft = { ...editing.draft, text: imported.text, sourceFormat: imported.format, sourceFileName: imported.sourceFileName,
        title: editing.draft.title || file.name, updatedAt: new Date().toISOString() };
      setEditing({ ...editing, draft, dirty: true, pages: imported.pages, textEdited: true }); setConfirmed(false); enqueueDraft(draft);
    } catch (failure) { setError(failure instanceof Error ? failure.message : '导入失败，请重试'); }
    finally { setBusy(false); }
  }
  async function save() {
    if (!editing || busy || !confirmed) return;
    const { draft, original, pages } = editing;
    if (!draft.title.trim() || draft.title.length > 500 || !draft.text.trim() || draft.text.length > LLM_LIMITS.maxExtractedCharacters ||
      draft.tags.length > 20 || draft.tags.some(tag => !tag.trim() || tag.length > 100) ||
      [draft.project, draft.responsibility, draft.action, draft.result].some(value => value && value.length > LLM_LIMITS.maxExtractedCharacters)) {
      setError('内容超出上限或为空，请调整'); return;
    }
    const now = new Date().toISOString();
    const document: MaterialDocument = {
      id: original?.id ?? draft.id, kind: draft.kind, title: draft.title, text: draft.text, tags: draft.tags,
      sourceFormat: draft.sourceFormat, sourceFileName: draft.sourceFileName, version: (original?.version ?? 0) + 1,
      createdAt: original?.createdAt ?? now, updatedAt: now,
      project: draft.project, responsibility: draft.responsibility, action: draft.action, result: draft.result,
    };
    setBusy(true); setError('');
    try {
      const write = async () => {
        const saved = await materials.saveDocument(document, original?.version ?? null, pages, !editing.textEdited);
        try { await repository.deleteDraft(draft.id); return { saved, cleanupFailed: false }; }
        catch { return { saved, cleanupFailed: true }; }
      };
      const { saved, cleanupFailed } = await (onPersistDocument ? onPersistDocument(document.id, original?.version ?? null, write) : draftQueue.run(write));
      if (!alive.current) return;
      setEditing(undefined); setSelected(saved.id);
      if (cleanupFailed) setDraftError('资料已保存，草稿清理失败');
      else await loadDrafts();
      onMaterialsChanged?.();
    } catch { setError('保存失败，请重试'); }
    finally { setBusy(false); }
  }
  async function remove(document: MaterialDocument) {
    if (!onDeleteMaterial || !canLeave() || !window.confirm('删除资料正文、片段及所有版本的引用摘录，回答正文保留。正文仍可能含已采用的经历，请自行修改或删除回答；已有备份无法撤回。是否继续？')) return;
    setBusy(true); setError('');
    try { await onDeleteMaterial(document.id); setSelected(''); await materials.refresh(); onMaterialsChanged?.(); }
    catch { setError('删除失败，请重试'); } finally { setBusy(false); }
  }
  const documents = materials.documents.filter(document => document.kind === kind &&
    `${document.title}\n${document.text}\n${document.tags.join(' ')}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const active = documents.find(document => document.id === selected);
  return <section className="materials-page">
    <header className="materials-heading"><h1>我的资料</h1><div className="materials-tools"><label className="materials-search"><Search size={17} /><input aria-label="搜索资料" placeholder="搜索资料" value={query} onChange={event => setQuery(event.target.value)} /></label>
      <button type="button" className="primary-action" aria-label="添加资料" title="添加资料" disabled={busy || materials.loading || !!materials.error} onClick={() => start()}><Plus size={17} />添加</button></div></header>
    <div className="materials-tabs" role="tablist">{(['experience', 'knowledge'] as const).map(value => <button key={value} type="button" role="tab" aria-selected={kind === value} onClick={() => {
      if (value !== kind && canLeave()) { setKind(value); setSelected(''); setEditing(undefined); setError(''); void loadDrafts(); }
    }}>{value === 'experience' ? '我的经历' : '知识笔记'}</button>)}</div>
    {materials.loading && <p role="status">加载中</p>}
    {materials.error && <div role="alert" className="material-error">{materials.error}<button type="button" onClick={() => { void materials.refresh(); void loadDrafts(); }}>重试加载</button></div>}
    {draftError && <div role="alert" className="material-error">{draftError}<button type="button" onClick={() => {
      if (editing?.dirty) enqueueDraft(editing.draft); else void loadDrafts();
    }}>重试草稿</button></div>}
    {drafts.filter(draft => draft.kind === kind && draft.id !== editing?.draft.id).map(draft => <button className="material-draft-row" type="button" disabled={busy} key={draft.id} onClick={() => { void restore(draft); }}>未保存草稿 · {draft.title || '无标题'}</button>)}
    <div className="materials-layout"><div className="materials-list" aria-label="资料列表">
      {!materials.loading && !materials.error && documents.length === 0 && <p className="material-empty">{query ? '没有匹配资料' : '暂无资料'}</p>}
      {documents.map(document => <button type="button" className={`material-list-item${selected === document.id ? ' is-selected' : ''}`} key={document.id} onClick={() => {
        if (canLeave()) { setSelected(document.id); setEditing(undefined); setError(''); void loadDrafts(); }
      }}><FileText size={18} /><span><strong>{document.title}</strong><small>{document.tags.join(' · ') || document.text.slice(0, 60)}</small></span></button>)}
    </div><div className="materials-detail">
      {editing ? <MaterialEditor key={editing.draft.id} draft={editing.draft} confirmed={confirmed} busy={busy} restored={editing.restored} error={error} onChange={changeDraft} onConfirm={setConfirmed} onImport={file => { void upload(file); }} onSave={() => { void save(); }} onClose={() => { if (canLeave()) { setEditing(undefined); void loadDrafts(); } }} /> : active ? <article>
        <div className="material-detail-heading"><h2>{active.title}</h2><div><button type="button" className="material-icon" aria-label="编辑资料" title="编辑资料" disabled={busy} onClick={() => start(active)}><Pencil size={17} /></button>
          <button type="button" className="material-icon" aria-label="删除资料" title="删除资料" disabled={!onDeleteMaterial || busy} onClick={() => { void remove(active); }}><Trash2 size={17} /></button></div></div>
        <div className="material-tags">{active.tags.map(tag => <span key={tag}>{tag}</span>)}</div><p className="material-body">{active.text}</p>
        {active.kind === 'experience' && <dl className="material-summary">{(['project', 'responsibility', 'action', 'result'] as const).map((field, index) => active[field] && <div key={field}><dt>{['项目', '职责', '行动', '成果'][index]}</dt><dd>{active[field]}</dd></div>)}</dl>}
      </article> : null}
      {!editing && error && <p role="alert" className="material-error">{error}</p>}
    </div></div>
  </section>;
}
