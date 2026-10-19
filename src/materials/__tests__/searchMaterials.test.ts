import { describe, expect, it } from 'vitest';
import type { MaterialChunk } from '../../domain/materialTypes';
import { searchMaterials, suggestMaterialTags } from '../searchMaterials';

const chunk = (id: string, text: string, tags: string[] = []): MaterialChunk => ({
  id, text, tags, documentId: 'synthetic', documentVersion: 1, kind: 'experience', title: 'Synthetic',
  locator: { type: 'paragraph', paragraphIndex: 0 },
});
describe('local material search', () => {
  it('matches Chinese bigrams and English words case-insensitively', () => {
    const chunks = [chunk('b', '用户调研与沟通'), chunk('a', 'React caching performance'), chunk('c', 'reaction')];
    expect(searchMaterials(chunks, '用户研究').map(c => c.id)).toEqual(['b']);
    expect(searchMaterials(chunks, 'REACT').map(c => c.id)).toEqual(['a']);
  });
  it('weighs tags above body matches and uses stable IDs for ties', () => {
    const chunks = [chunk('c', 'React'), chunk('b', 'unrelated', ['React']), chunk('a', 'React')];
    expect(searchMaterials(chunks, 'react').map(c => c.id)).toEqual(['b', 'a', 'c']);
    expect(searchMaterials([...chunks].reverse(), 'react').map(c => c.id)).toEqual(['b', 'a', 'c']);
    expect(chunks.map(c => c.id)).toEqual(['c', 'b', 'a']);
  });
  it('returns empty without effective overlap; never automatically selects chunks', () => {
    const chunks = [chunk('a', 'Synthetic React experience')];
    for (const query of ['', '  ', '!!!', '用', 'unmatched']) expect(searchMaterials(chunks, query)).toEqual([]);
    expect(chunks[0]).not.toHaveProperty('selected');
  });
  it('caps results at six and honors smaller limits', () => {
    const chunks = Array.from({ length: 9 }, (_, i) => chunk(`c${i}`, 'React'));
    expect(searchMaterials(chunks, 'react')).toHaveLength(6);
    expect(searchMaterials(chunks, 'react', 99)).toHaveLength(6);
    expect(searchMaterials(chunks, 'react', 2)).toHaveLength(2);
    expect(searchMaterials(chunks, 'react', 0)).toEqual([]);
    expect(searchMaterials(chunks, 'react', NaN)).toEqual([]);
  });
  it('suggests conservative topic tags without inventing experiences', () => {
    expect(suggestMaterialTags('React 与 TypeScript，用户调研和数据分析')).toEqual(['React', 'TypeScript', '用户研究', '数据分析']);
    expect(suggestMaterialTags('unrelated fictional prose')).toEqual([]);
    expect(suggestMaterialTags('reaction')).toEqual([]);
  });
});
