import type { AnswerEvidence as Evidence } from '../domain/materialTypes';
const labels = { validated: '已核对引用', 'needs-review': '待核对', 'source-updated': '来源已更新', 'source-deleted': '来源已删除' };
export function AnswerEvidence({ evidence = [], missingFacts = [] }: { evidence?: Evidence[]; missingFacts?: string[] }) {
  if (!evidence.length && !missingFacts.length) return null;
  return <details className="focus-evidence"><summary>回答依据 · {evidence.length} 处引用</summary>
    {evidence.map((entry, index) => <div key={`${entry.chunkId}:${index}`}>
      <strong>{entry.titleSnapshot}</strong> · {entry.kind === 'knowledge' ? '知识笔记' : '项目经历'} · {labels[entry.status]}
      <small>回答第 {entry.answerParagraphIndex + 1} 段{entry.locatorSnapshot?.type === 'page' ? ` · 来源第 ${entry.locatorSnapshot.pageNumber} 页` : entry.locatorSnapshot ? ` · 来源第 ${entry.locatorSnapshot.paragraphIndex + 1} 段` : ''}</small>
      {entry.status !== 'source-deleted' && <blockquote>{entry.quote}</blockquote>}
    </div>)}
    {missingFacts.length > 0 && <><strong>待补充</strong><ul>{missingFacts.map(fact => <li key={fact}>{fact}</li>)}</ul></>}
  </details>;
}
