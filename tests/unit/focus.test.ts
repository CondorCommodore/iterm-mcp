import { describe, it, expect, vi, beforeEach } from 'vitest';

const runOsascript = vi.fn();
vi.mock('../../src/applescript.js', () => ({
  runOsascript: (...a: unknown[]) => runOsascript(...a),
  runShell: vi.fn(),
}));

import { focusTab } from '../../src/tabs/focus.js';

beforeEach(() => runOsascript.mockReset());

describe('focusTab', () => {
  it('builds an activate + select-tab script', async () => {
    runOsascript.mockResolvedValueOnce({ stdout: '', stderr: '', code: 0, timedOut: false });
    const r = await focusTab(3, 5);
    expect(r).toEqual({ focused: true });
    const script = runOsascript.mock.calls[0][0] as string;
    expect(script).toContain('activate');
    expect(script).toContain('tell window 3 to select tab 5');
  });

  it('returns failure reason from stderr', async () => {
    runOsascript.mockResolvedValueOnce({
      stdout: '',
      stderr: 'no such window',
      code: 1,
      timedOut: false,
    });
    const r = await focusTab(9, 9);
    expect(r.focused).toBe(false);
    expect(r.reason).toBe('no such window');
  });
});
