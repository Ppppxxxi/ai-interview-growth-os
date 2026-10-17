import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import App from './App';

describe('App', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('creates the app component element', () => {
    expect(createElement(App)).toBeTruthy();
  });

  it('keeps the focused import flow as the first screen without local data', () => {
    vi.stubGlobal('window', {
      location: { search: '' },
      localStorage: {
        getItem: () => null,
        setItem: vi.fn(),
        removeItem: vi.fn()
      }
    });

    const html = renderToString(createElement(App));

    expect(html).toContain('开始新面试');
    expect(html).toContain('正在检查本地数据');
    expect(html).toContain('主导航');
    expect(html).toContain('恢复示例');
    expect(html).not.toContain('填入示例');
    expect(html).not.toContain('查看完整示例');
    expect(html).not.toContain('AI 产品经理');
    expect(html).not.toContain('workspace-home-current');
  });

  it('starts preview links in the same empty flow as cleared local data', () => {
    vi.stubGlobal('window', {
      location: { search: '?preview=workspace' },
      localStorage: {
        getItem: () => null,
        setItem: vi.fn(),
        removeItem: vi.fn()
      }
    });

    const html = renderToString(createElement(App));

    expect(html).toContain('正在检查本地数据');
    expect(html).not.toContain('workspace-home-current');
    expect(html).not.toContain('星河智能');
    expect(html).toContain('我的回答库');
  });
});
