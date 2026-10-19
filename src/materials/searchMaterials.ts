import type { MaterialChunk } from '../domain/materialTypes';

function tokens(text: string): Set<string> {
  const normalized = text.normalize('NFKC').toLowerCase();
  const result = new Set(normalized.match(/[a-z0-9]+(?:[+#][+#]?)?/g) ?? []);
  for (const run of normalized.match(/\p{Script=Han}+/gu) ?? []) {
    const characters = Array.from(run);
    for (let i = 0; i < characters.length - 1; i++) result.add(characters[i] + characters[i + 1]);
  }
  return result;
}

export function searchMaterials(chunks: MaterialChunk[], query: string, limit = 6): MaterialChunk[] {
  const count = Number.isFinite(limit) ? Math.max(0, Math.min(6, Math.floor(limit))) : 0;
  const queryTokens = tokens(query);
  if (!count || !queryTokens.size) return [];
  return chunks.map(chunk => {
    const body = tokens(chunk.text);
    const tags = tokens(chunk.tags.join(' '));
    let score = 0;
    for (const token of queryTokens) score += (body.has(token) ? 1 : 0) + (tags.has(token) ? 3 : 0);
    return { chunk, score };
  }).filter(match => match.score > 0)
    .sort((a, b) => b.score - a.score || (a.chunk.id < b.chunk.id ? -1 : a.chunk.id > b.chunk.id ? 1 : 0))
    .slice(0, count).map(match => match.chunk);
}

const tagRules: Array<[string, RegExp]> = [
  ['React', /\breact\b/i], ['TypeScript', /\btypescript\b/i], ['JavaScript', /\bjavascript\b/i],
  ['Python', /\bpython\b/i], ['SQL', /\bsql\b/i],
  ['用户研究', /用户研究|用户调研|用户访谈/], ['数据分析', /数据分析|\bdata analysis\b/i],
  ['项目管理', /项目管理|\bproject management\b/i], ['团队协作', /团队协作|跨团队/],
];

export function suggestMaterialTags(text: string): string[] {
  return tagRules.filter(([, pattern]) => pattern.test(text)).map(([tag]) => tag).slice(0, 6);
}
