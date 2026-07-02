import { describe, expect, it } from 'vitest';
import App from './App';

describe('App', () => {
  it('creates the initial app shell element', () => {
    expect(App()).toBeTruthy();
  });
});
