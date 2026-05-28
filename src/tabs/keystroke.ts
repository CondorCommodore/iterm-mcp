import { runOsascript } from '../applescript.js';

const KEY_CODE: Record<string, number | 'return'> = {
  return: 'return',
  tab: 48,
  escape: 53,
  backspace: 51,
  space: 49,
};

export type KeystrokeKey = keyof typeof KEY_CODE;

export async function sendKeystroke(window: number, tab: number, key: KeystrokeKey): Promise<{ sent: boolean; reason?: string }> {
  const target = KEY_CODE[key];
  if (target === undefined) return { sent: false, reason: 'unknown key' };

  const keyExpr = target === 'return' ? 'keystroke return' : `key code ${target}`;
  const script = `
tell application "iTerm2"
  activate
  tell window ${window} to select tab ${tab}
end tell
delay 0.3
tell application "System Events"
  tell process "iTerm2"
    set frontmost to true
    delay 0.2
    ${keyExpr}
  end tell
end tell
`;
  const r = await runOsascript(script);
  return r.code === 0 ? { sent: true } : { sent: false, reason: r.stderr.trim() };
}
