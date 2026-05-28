import { runOsascript, runShell } from '../applescript.js';
import { detectRuntimeFromCmdline, Runtime } from '../runtime-detect.js';

const ENUMERATE = `
tell application "iTerm2"
  set output to ""
  repeat with w from 1 to count of windows
    set theWindow to window w
    repeat with t from 1 to count of tabs of theWindow
      set theTab to tab t of theWindow
      set theSession to current session of theTab
      set output to output & w & "|" & t & "|" & (name of theSession) & "|" & (tty of theSession) & linefeed
    end repeat
  end repeat
  return output
end tell
`;

export interface TabRow {
  window: number;
  tab: number;
  label: string;
  tty: string;
  runtime: Runtime;
  resumeUuid: string | null;
}

export async function listTabs(): Promise<TabRow[]> {
  const enumResult = await runOsascript(ENUMERATE);
  if (enumResult.code !== 0) return [];

  const psResult = await runShell('ps', ['-axo', 'tty,command']);
  // Prefer the most informative cmdline per tty: claude > codex > ssh > anything-non-shell > shell
  const priority = (cmd: string): number => {
    const l = cmd.toLowerCase();
    if (l.includes('claude')) return 5;
    if (l.includes('codex')) return 4;
    if (/^\s*ssh\b/.test(cmd)) return 3;
    if (/(zsh|bash|sh|fish)\b/.test(l)) return 1;
    return 2;
  };
  const byTty = new Map<string, string>();
  for (const line of psResult.stdout.split('\n').slice(1)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const space = trimmed.indexOf(' ');
    if (space < 0) continue;
    const ttyShort = trimmed.slice(0, space);
    const cmd = trimmed.slice(space + 1);
    const existing = byTty.get(ttyShort);
    if (!existing || priority(cmd) > priority(existing)) {
      byTty.set(ttyShort, cmd);
    }
  }

  const tabs: TabRow[] = [];
  for (const row of enumResult.stdout.split('\n')) {
    if (!row.trim()) continue;
    const parts = row.split('|');
    if (parts.length < 4) continue;
    const window = parseInt(parts[0], 10);
    const tab = parseInt(parts[1], 10);
    const label = parts[2];
    const tty = parts[3];
    const ttyShort = tty.replace('/dev/', '');
    const cmd = byTty.get(ttyShort) ?? '';
    const { runtime, resumeUuid } = detectRuntimeFromCmdline(cmd);
    tabs.push({ window, tab, label, tty, runtime, resumeUuid });
  }
  return tabs;
}
