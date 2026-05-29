import { describe, it, expect, vi, beforeEach } from 'vitest';

const runOsascript = vi.fn();
vi.mock('../../src/applescript.js', () => ({
  runOsascript: (...a: unknown[]) => runOsascript(...a),
  runShell: vi.fn(),
}));

import { searchTab } from '../../src/tabs/search.js';

beforeEach(() => runOsascript.mockReset());

const ok = (stdout: string) => ({ stdout, stderr: '', code: 0, timedOut: false });

describe('searchTab', () => {
  it('returns substring matches with source line numbers', async () => {
    runOsascript.mockResolvedValueOnce(ok('alpha\nneedle one\nbeta\nneedle two\n'));

    const r = await searchTab({ window: 1, tab: 2, pattern: 'needle' });

    expect(r.matches).toEqual([
      { lineNumber: 2, text: 'needle one' },
      { lineNumber: 4, text: 'needle two' },
    ]);
    expect(r.error).toBeUndefined();
    const script = runOsascript.mock.calls[0][0] as string;
    expect(script).toContain('tab 2 of window 1');
    expect(script).toContain('contents of current session');
  });

  it('returns regex matches', async () => {
    runOsascript.mockResolvedValueOnce(ok('build ok\nERROR failed\nwarn\n'));

    const r = await searchTab({ window: 1, tab: 1, pattern: '^(ERROR|WARN)', regex: true });

    expect(r.matches).toEqual([{ lineNumber: 2, text: 'ERROR failed' }]);
  });

  it('returns an empty match array when no lines match', async () => {
    runOsascript.mockResolvedValueOnce(ok('alpha\nbeta\n'));

    const r = await searchTab({ window: 1, tab: 1, pattern: 'needle' });

    expect(r.matches).toEqual([]);
    expect(r.searchedLineCount).toBe(2);
  });

  it('bounds searching to tailLines while preserving source line numbers', async () => {
    runOsascript.mockResolvedValueOnce(ok('needle old\nkeep\nneedle recent\nlast\n'));

    const r = await searchTab({ window: 1, tab: 1, pattern: 'needle', tailLines: 2 });

    expect(r.matches).toEqual([{ lineNumber: 3, text: 'needle recent' }]);
    expect(r.lineCount).toBe(4);
    expect(r.searchedLineCount).toBe(2);
  });

  it('returns malformed regex errors gracefully', async () => {
    runOsascript.mockResolvedValueOnce(ok('alpha\nbeta\n'));

    const r = await searchTab({ window: 1, tab: 1, pattern: '[', regex: true });

    expect(r.matches).toEqual([]);
    expect(r.error).toMatch(/invalid regex/i);
  });
});
