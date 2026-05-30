import { describe, it, expect, vi, beforeEach } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const runOsascript = vi.fn();
const readConductorInfo = vi.fn();
const listTabs = vi.fn();

vi.mock('../../src/applescript.js', () => ({
  runOsascript: (...a: unknown[]) => runOsascript(...a),
  runShell: vi.fn(),
}));

vi.mock('../../src/refuse-self.js', async () => {
  const actual: any = await vi.importActual('../../src/refuse-self.js');
  return {
    ...actual,
    readConductorInfo: (...a: unknown[]) => readConductorInfo(...a),
  };
});

vi.mock('../../src/tabs/list.js', () => ({
  listTabs: (...a: unknown[]) => listTabs(...a),
}));

import { dispatchToTab } from '../../src/tabs/dispatch.js';

const NEUTRAL_INFO = { window: null, tab: null, sessionId: null, alsoRefuseUuids: [] };

beforeEach(() => {
  runOsascript.mockReset();
  readConductorInfo.mockReset().mockResolvedValue(NEUTRAL_INFO);
  listTabs.mockReset().mockResolvedValue([]);
});

const ok = { stdout: '', stderr: '', code: 0, timedOut: false };
const fail = (reason: string) => ({ stdout: '', stderr: reason, code: 1, timedOut: false });

describe('dispatchToTab', () => {
  it('tier 1 (crlf): single AppleScript with write text + CR + LF when submit=true', async () => {
    runOsascript.mockResolvedValueOnce(ok);
    const r = await dispatchToTab({ window: 2, tab: 3, text: 'hello', submit: true });
    expect(r).toEqual({ dispatched: true, tierUsed: 'crlf' });
    expect(runOsascript).toHaveBeenCalledTimes(1);
    const script = runOsascript.mock.calls[0][0] as string;
    expect(script).toContain('tab 3 of window 2');
    expect(script).toContain('write text "hello" without newline');
    expect(script).toContain('character id 13');
    expect(script).toContain('character id 10');
  });

  it('tier 1 omits CR/LF when submit=false', async () => {
    runOsascript.mockResolvedValueOnce(ok);
    await dispatchToTab({ window: 1, tab: 1, text: 'x', submit: false });
    const script = runOsascript.mock.calls[0][0] as string;
    expect(script).not.toContain('character id 13');
  });

  it('escalation: "crlf" reports the tier 1 error without falling back', async () => {
    runOsascript.mockResolvedValueOnce(fail('tab missing'));

    const r = await dispatchToTab({
      window: 1,
      tab: 9,
      text: 'hi',
      submit: true,
      escalation: 'crlf',
    });

    expect(r).toEqual({ dispatched: false, tierUsed: 'crlf', reason: 'tab missing' });
    expect(runOsascript).toHaveBeenCalledTimes(1);
  });

  it('escapes backslashes and double-quotes in the payload', async () => {
    runOsascript.mockResolvedValueOnce(ok);
    await dispatchToTab({ window: 1, tab: 1, text: 'a"b\\c', submit: false });
    const script = runOsascript.mock.calls[0][0] as string;
    expect(script).toContain('write text "a\\"b\\\\c" without newline');
  });

  it('auto: escalates to tier 2 (keystroke) when tier 1 fails', async () => {
    runOsascript
      .mockResolvedValueOnce(fail('tier1 broke')) // tier 1
      .mockResolvedValueOnce(ok) // tier 2 write phase
      .mockResolvedValueOnce(ok); // tier 2 focus + keystroke
    const r = await dispatchToTab({ window: 1, tab: 1, text: 'hi', submit: true });
    expect(r).toEqual({ dispatched: true, tierUsed: 'keystroke' });
    const focusScript = runOsascript.mock.calls[2][0] as string;
    expect(focusScript).toContain('tell window 1 to select tab 1');
    expect(focusScript).toContain('keystroke return');
    expect(focusScript).toContain('tell process "iTerm2"');
  });

  it('auto: drops to tier 3 fallback file when both tier 1 and tier 2 fail', async () => {
    runOsascript
      .mockResolvedValueOnce(fail('tier1 broke')) // tier 1
      .mockResolvedValueOnce(fail('write denied')); // tier 2 write phase
    const r = await dispatchToTab({ window: 7, tab: 9, text: 'recover me', submit: true });
    expect(r.dispatched).toBe(false);
    expect(r.tierUsed).toBe('fallback');
    expect(r.fallbackPath).toBeDefined();
    expect(r.fallbackPath).toContain(path.join(os.homedir(), '.claude/plans/pending-dispatches'));
    const body = await fs.readFile(r.fallbackPath!, 'utf-8');
    expect(body).toContain('window: 7');
    expect(body).toContain('tab: 9');
    expect(body).toContain('recover me');
    await fs.unlink(r.fallbackPath!).catch(() => {});
  });

  it('escalation: "fallback" forces a tier-3 file drop without calling osascript', async () => {
    const r = await dispatchToTab({
      window: 1,
      tab: 1,
      text: 'forced',
      submit: true,
      escalation: 'fallback',
    });
    expect(r.tierUsed).toBe('fallback');
    expect(runOsascript).not.toHaveBeenCalled();
    await fs.unlink(r.fallbackPath!).catch(() => {});
  });

  it('escalation: "keystroke" skips tier 1 and goes straight to tier 2', async () => {
    runOsascript
      .mockResolvedValueOnce(ok) // write
      .mockResolvedValueOnce(ok); // focus + keystroke
    const r = await dispatchToTab({
      window: 1,
      tab: 1,
      text: 'hi',
      submit: true,
      escalation: 'keystroke',
    });
    expect(r.tierUsed).toBe('keystroke');
    expect(runOsascript).toHaveBeenCalledTimes(2);
  });

  it('tier 2 sends only the focus/return script when text is empty', async () => {
    runOsascript.mockResolvedValueOnce(ok);

    const r = await dispatchToTab({
      window: 8,
      tab: 4,
      text: '',
      submit: true,
      escalation: 'keystroke',
    });

    expect(r).toEqual({ dispatched: true, tierUsed: 'keystroke' });
    expect(runOsascript).toHaveBeenCalledTimes(1);
    const script = runOsascript.mock.calls[0][0] as string;
    expect(script).toContain('tell window 8 to select tab 4');
    expect(script).toContain('keystroke return');
    expect(script).not.toContain('write text');
  });

  it('refuses self-dispatch when target window/tab matches conductor marker', async () => {
    readConductorInfo.mockResolvedValueOnce({
      window: 4,
      tab: 2,
      sessionId: null,
      alsoRefuseUuids: [],
    });
    const r = await dispatchToTab({ window: 4, tab: 2, text: 'oops', submit: true });
    expect(r.dispatched).toBe(false);
    expect(r.tierUsed).toBe('refused');
    expect(runOsascript).not.toHaveBeenCalled();
  });

  it('refuses self-dispatch when target resume UUID is in also_refuse list', async () => {
    readConductorInfo.mockResolvedValueOnce({
      window: 1,
      tab: 1,
      sessionId: null,
      alsoRefuseUuids: ['aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'],
    });
    listTabs.mockResolvedValueOnce([
      {
        window: 9,
        tab: 9,
        label: 't',
        tty: '/dev/ttys001',
        runtime: 'claude',
        resumeUuid: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      },
    ]);
    const r = await dispatchToTab({ window: 9, tab: 9, text: 'no', submit: true });
    expect(r.tierUsed).toBe('refused');
  });

  it('tier 2 restores focus to conductorTabHint after keystroke', async () => {
    runOsascript
      .mockResolvedValueOnce(ok) // write
      .mockResolvedValueOnce(ok) // focus+keystroke
      .mockResolvedValueOnce(ok); // restore
    await dispatchToTab({
      window: 1,
      tab: 1,
      text: 'hi',
      submit: true,
      escalation: 'keystroke',
      conductorTabHint: { window: 5, tab: 6 },
    });
    expect(runOsascript).toHaveBeenCalledTimes(3);
    expect(runOsascript.mock.calls[2][0]).toContain('tell window 5 to select tab 6');
  });
});
