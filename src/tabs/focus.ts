import { runOsascript } from '../applescript.js';

const FOCUS = (w: number, t: number) => `
tell application "iTerm2"
  activate
  tell window ${w} to select tab ${t}
end tell
`;

export interface FocusResult { focused: boolean; reason?: string; }

export async function focusTab(window: number, tab: number): Promise<FocusResult> {
  const r = await runOsascript(FOCUS(window, tab));
  return r.code === 0 ? { focused: true } : { focused: false, reason: r.stderr.trim() };
}
