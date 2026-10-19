import type { MaterialChunk } from '../../domain/materialTypes';
import { searchMaterials } from '../../materials/searchMaterials';

type Props = { chunks: MaterialChunk[]; query: string; selectedChunkIds: string[]; onChange: (ids: string[]) => void };
export function MaterialReferencePicker({ chunks, query, selectedChunkIds, onChange }: Props) {
  const matches = searchMaterials(chunks, query);
  const matchedIds = new Set(matches.map(chunk => chunk.id));
  const ranked = [...matches, ...chunks.filter(chunk => !matchedIds.has(chunk.id))];
  return <details className="focus-references">
    <summary>参考资料 · 已选 {selectedChunkIds.length} / 6</summary>
    {ranked.map(chunk => <label className="focus-reference-option" key={chunk.id}>
      <input type="checkbox" checked={selectedChunkIds.includes(chunk.id)}
        disabled={!selectedChunkIds.includes(chunk.id) && selectedChunkIds.length >= 6}
        onChange={() => onChange(selectedChunkIds.includes(chunk.id) ? selectedChunkIds.filter(id => id !== chunk.id) : [...selectedChunkIds, chunk.id])} />
      <span>{chunk.title} · {chunk.kind === 'knowledge' ? '知识笔记' : '项目经历'}<small>{chunk.text}</small></span>
    </label>)}
  </details>;
}
