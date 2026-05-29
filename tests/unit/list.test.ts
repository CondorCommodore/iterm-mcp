import { describe, it, expect, vi, beforeEach } from 'vitest';

const runOsascript = vi.fn();
const runShell = vi.fn();

vi.mock('../../src/applescript.js', () => ({
  runOsascript: (...args: unknown[]) => runOsascript(...args),
  runShell: (...args: unknown[]) => runShell(...args),
}));

import { listTabs } from '../../src/tabs/list.js';

beforeEach(() => {
  runOsascript.mockReset();
  runShell.mockReset();
});

describe('listTabs', () => {
  it('parses enumerate output and joins ps cmdlines per tty', async () => {
    runOsascript.mockResolvedValueOnce({
      stdout: '1|1|claude session|/dev/ttys001\n1|2|shell|/dev/ttys002\n',
      stderr: '',
      code: 0,
      timedOut: false,
    });
    runShell.mockResolvedValueOnce({
      stdout: [
        'TT       COMMAND',
        'ttys001  node /usr/local/bin/claude --resume aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        'ttys002  -zsh',
      ].join('\n'),
      stderr: '',
      code: 0,
      timedOut: false,
    });

    const tabs = await listTabs();
    expect(tabs).toHaveLength(2);
    expect(tabs[0]).toEqual({
      window: 1,
      tab: 1,
      label: 'claude session',
      tty: '/dev/ttys001',
      runtime: 'claude',
      resumeUuid: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    });
    expect(tabs[1].runtime).toBe('shell');
    expect(tabs[1].resumeUuid).toBeNull();

    // Verify the AppleScript enumerate script was used (not the per-tab variants).
    const script = runOsascript.mock.calls[0][0] as string;
    expect(script).toContain('tell application "iTerm2"');
    expect(script).toContain('repeat with w from 1 to count of windows');

    // Verify ps argv shape.
    expect(runShell.mock.calls[0][0]).toBe('ps');
    expect(runShell.mock.calls[0][1]).toEqual(['-axo', 'tty,command']);
  });

  it('prefers claude > codex > ssh > shell when multiple processes share a tty', async () => {
    runOsascript.mockResolvedValueOnce({
      stdout: '1|1|t|/dev/ttys001\n',
      stderr: '',
      code: 0,
      timedOut: false,
    });
    runShell.mockResolvedValueOnce({
      stdout: [
        'TT       COMMAND',
        'ttys001  -zsh',
        'ttys001  node claude',
      ].join('\n'),
      stderr: '',
      code: 0,
      timedOut: false,
    });
    const tabs = await listTabs();
    expect(tabs[0].runtime).toBe('claude');
  });

  it('returns [] when AppleScript enumerate fails', async () => {
    runOsascript.mockResolvedValueOnce({ stdout: '', stderr: 'err', code: 1, timedOut: false });
    expect(await listTabs()).toEqual([]);
  });
});
