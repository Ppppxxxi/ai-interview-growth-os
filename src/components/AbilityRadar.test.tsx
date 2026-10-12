import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AbilityRadar } from './AbilityRadar';

describe('AbilityRadar', () => {
  it('keeps missing dimensions unscored instead of inventing a complete profile', () => {
    const html = renderToStaticMarkup(
      createElement(AbilityRadar, { scores: { dataMetrics: 2.5 } })
    );
    expect(html).toContain('数据与指标：2.5');
    expect(html).toContain('岗位理解：暂无评分');
    expect(html).not.toContain('fill="#78b9a044"');
    expect(html.match(/<circle/g)).toHaveLength(1);
  });

  it('only fills the profile when all six dimensions have evidence', () => {
    const html = renderToStaticMarkup(
      createElement(AbilityRadar, {
        scores: {
          roleUnderstanding: 3,
          productAnalysis: 4,
          aiProductThinking: 3,
          dataMetrics: 2.5,
          projectStorytelling: 4,
          structuredCommunication: 3.5
        }
      })
    );
    expect(html).toContain('fill="#78b9a044"');
    expect(html.match(/<circle/g)).toHaveLength(6);
  });
});
