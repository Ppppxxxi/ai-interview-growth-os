import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { WorkspaceHome } from './WorkspaceHome';
import { createEmptyPersonalWorkspaceData } from '../workflow/personalWorkspace';

describe('WorkspaceHome', () => {
  it('does not show the role and direction subtitle under the company', () => {
    const html = renderToStaticMarkup(createElement(WorkspaceHome, {
      data: createEmptyPersonalWorkspaceData(),
      onSelectJob: vi.fn(),
      onOpenJob: vi.fn(),
      onOpenAssets: vi.fn(),
      onOpenGrowth: vi.fn(),
      onStartNew: vi.fn()
    }));

    expect(html).toContain('我的目标公司');
    expect(html).not.toContain('AI 产品经理');
  });
});
