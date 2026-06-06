import { describe, it, expect, vi, beforeEach } from 'vitest';

const runOsascript = vi.fn();
vi.mock('../../src/applescript.js', () => ({
  runOsascript: (...a: unknown[]) => runOsascript(...a),
  runShell: vi.fn(),
}));

import { peekInputRegion, peekTab } from '../../src/tabs/peek.js';

beforeEach(() => runOsascript.mockReset());

describe('peekTab', () => {
  it('returns full contents and counts lines (ignoring trailing newline)', async () => {
    runOsascript.mockResolvedValueOnce({
      stdout: 'a\nb\nc\n',
      stderr: '',
      code: 0,
      timedOut: false,
    });
    const r = await peekTab(2, 3);
    expect(r.contents).toBe('a\nb\nc\n');
    expect(r.lineCount).toBe(3);

    const script = runOsascript.mock.calls[0][0] as string;
    expect(script).toContain('tab 3 of window 2');
    expect(script).toContain('contents of current session');
  });

  it('truncates to tailLines when set', async () => {
    runOsascript.mockResolvedValueOnce({
      stdout: 'a\nb\nc\nd\ne\n',
      stderr: '',
      code: 0,
      timedOut: false,
    });
    const r = await peekTab(1, 1, 2);
    expect(r.lineCount).toBe(5);
    expect(r.contents.split('\n').filter(Boolean)).toEqual(['d', 'e']);
  });

  it('returns empty result when AppleScript errors', async () => {
    runOsascript.mockResolvedValueOnce({ stdout: '', stderr: 'x', code: 1, timedOut: false });
    expect(await peekTab(1, 1)).toEqual({ contents: '', lineCount: 0 });
  });

  it('peekInputRegion returns the last paragraph for prompt-area reads', async () => {
    runOsascript.mockResolvedValueOnce({
      stdout: 'current prompt text',
      stderr: '',
      code: 0,
      timedOut: false,
    });

    await expect(peekInputRegion(3, 2)).resolves.toBe('current prompt text');
    const script = runOsascript.mock.calls[0][0] as string;
    expect(script).toContain('tell session of (tab 2 of window 3)');
    expect(script).toContain('last paragraph of c');
  });
});
