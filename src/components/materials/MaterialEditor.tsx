import { Save, Upload, X } from 'lucide-react';
import { useState } from 'react';
import type { MaterialDraft } from '../../domain/materialTypes';
import { LLM_LIMITS } from '../../domain/llmContracts';
import { suggestMaterialTags } from '../../materials/searchMaterials';

type Props = {
  draft: MaterialDraft;
  confirmed: boolean;
  busy: boolean;
  restored: boolean;
  error: string;
  onChange: (draft: MaterialDraft) => void;
  onConfirm: (confirmed: boolean) => void;
  onImport: (file: File) => void;
  onSave: () => void;
  onClose: () => void;
};

export function MaterialEditor({ draft, confirmed, busy, restored, error, onChange, onConfirm, onImport, onSave, onClose }: Props) {
  const [tagText, setTagText] = useState(draft.tags.join(', '));
  function change(field: keyof MaterialDraft, value: string | string[]) {
    onChange({ ...draft, [field]: value, updatedAt: new Date().toISOString() });
  }
  const tags = [...new Set([...draft.tags, ...suggestMaterialTags(draft.text)])];
  return <section className="material-editor" aria-label="编辑资料">
    <div className="material-editor-heading"><h2>编辑资料</h2>{restored && <strong className="material-draft-label">未保存草稿</strong>}
      <button type="button" className="material-icon" aria-label="关闭编辑" title="关闭编辑" disabled={busy} onClick={onClose}><X size={18} /></button>
    </div>
    <fieldset disabled={busy}>
      <label>标题<input value={draft.title} maxLength={500} placeholder="资料标题" onChange={event => change('title', event.target.value)} /></label>
      <div className="material-import-row"><label className="material-upload" title="导入文件"><Upload size={16} />导入文件
        <input aria-label="导入文件" type="file" accept=".txt,.md,.markdown,.docx,.pdf" onChange={event => {
          const file = event.target.files?.[0]; event.target.value = ''; if (file) onImport(file);
        }} /></label>{draft.sourceFileName && <span>{draft.sourceFileName}</span>}</div>
      <label>正文<textarea aria-label="正文" value={draft.text} rows={12} placeholder="粘贴或输入正文" onChange={event => change('text', event.target.value)} /></label>
      <label className="material-check"><input type="checkbox" checked={confirmed} onChange={event => onConfirm(event.target.checked)} />确认正文</label>
      {draft.kind === 'experience' && <details className="material-fields"><summary>经历要点</summary>
        <div>{(['project', 'responsibility', 'action', 'result'] as const).map((field, index) => <label key={field}>
          {['项目', '职责', '行动', '成果'][index]}<textarea rows={2} maxLength={LLM_LIMITS.maxExtractedCharacters} value={draft[field] ?? ''} placeholder="待补充" onChange={event => change(field, event.target.value)} />
        </label>)}</div>
      </details>}
      <label>标签<input aria-label="自定义标签" placeholder="用逗号分隔" value={tagText} onChange={event => {
        setTagText(event.target.value); change('tags', [...new Set(event.target.value.split(/[,，]/).map(tag => tag.trim()).filter(Boolean))]);
      }} /></label>
      {tags.length > 0 && <div className="material-tags">{tags.map(tag => <label className="material-check" key={tag}><input type="checkbox" checked={draft.tags.includes(tag)} onChange={event => {
        const next = event.target.checked ? [...draft.tags, tag] : draft.tags.filter(value => value !== tag);
        setTagText(next.join(', ')); change('tags', next);
      }} />{tag}</label>)}</div>}
    </fieldset>
    {error && <p role="alert" className="material-error">{error}</p>}
    <div className="material-editor-footer"><button type="button" className="primary-action" disabled={busy || !confirmed || !draft.title.trim() || !draft.text.trim()} onClick={onSave}><Save size={16} />{busy ? '处理中' : '保存资料'}</button></div>
  </section>;
}
