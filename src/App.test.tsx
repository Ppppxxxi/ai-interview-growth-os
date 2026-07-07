import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import App from './App';

describe('App', () => {
  it('creates the app component element', () => {
    expect(createElement(App)).toBeTruthy();
  });
});
