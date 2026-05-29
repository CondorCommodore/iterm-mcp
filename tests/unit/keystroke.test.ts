import { describe, it, expect, vi, beforeEach } from 'vitest';

const runOsascript = vi.fn();
vi.mock('../../src/applescript.js', () => ({
  runOsascript: (...a: unknown[]) => runOsascript(...a),
  runShell: vi.fn(),
}));

import { sendKeystroke } from '../../src/tabs/keystroke.js';

beforeEach(() => runOsascript.mockReset());

describe('sendKeystroke', () => {
  it('emits "keystroke return" for the return key', async () => {
    runOsascript.mockResolvedValueOnce({ stdout: '', stderr: '', code: 0, timedOut: false });
    const r = await sendKeystroke(1, 1, 'return');
    expect(r).toEqual({ sent: true });
    const script = runOsascript.mock.calls[0][0] as string;
    expect(script).toContain('keystroke return');
    expect(script).toContain('tell window 1 to select tab 1');
  });

  it('emits "key code 48" for tab', async () => {
    runOsascript.mockResolvedValueOnce({ stdout: '', stderr: '', code: 0, timedOut: false });
    await sendKeystroke(2, 4, 'tab');
    expect(runOsascript.mock.calls[0][0]).toContain('key code 48');
  });

  it('emits "key code 53" for escape', async () => {
    runOsascript.mockResolvedValueOnce({ stdout: '', stderr: '', code: 0, timedOut: false });
    await sendKeystroke(1, 1, 'escape');
    expect(runOsascript.mock.calls[0][0]).toContain('key code 53');
  });

  it('emits "key code 51" for backspace', async () => {
    runOsascript.mockResolvedValueOnce({ stdout: '', stderr: '', code: 0, timedOut: false });
    await sendKeystroke(1, 1, 'backspace');
    expect(runOsascript.mock.calls[0][0]).toContain('key code 51');
  });

  it('emits "key code 49" for space', async () => {
    runOsascript.mockResolvedValueOnce({ stdout: '', stderr: '', code: 0, timedOut: false });
    await sendKeystroke(1, 1, 'space');
    expect(runOsascript.mock.calls[0][0]).toContain('key code 49');
  });

  it('returns failure reason on AppleScript error', async () => {
    runOsascript.mockResolvedValueOnce({
      stdout: '',
      stderr: 'denied',
      code: 1,
      timedOut: false,
    });
    const r = await sendKeystroke(1, 1, 'return');
    expect(r).toEqual({ sent: false, reason: 'denied' });
  });
});
