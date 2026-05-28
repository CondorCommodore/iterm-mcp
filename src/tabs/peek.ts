import { runOsascript } from '../applescript.js';

const PEEK_CONTENTS = (w: number, t: number) => `
tell application "iTerm2"
  set theTab to tab ${t} of window ${w}
  return contents of current session of theTab
end tell
`;

const PEEK_LAST_PARAGRAPH = (w: number, t: number) => `
tell application "iTerm2"
  tell session of (tab ${t} of window ${w})
    set c to contents
    return last paragraph of c
  end tell
end tell
`;

export interface PeekResult {
  contents: string;
  lineCount: number;
}

export async function peekTab(window: number, tab: number, tailLines?: number): Promise<PeekResult> {
  const r = await runOsascript(PEEK_CONTENTS(window, tab));
  if (r.code !== 0) return { contents: '', lineCount: 0 };
  const allLines = r.stdout.split('\n');
  const totalCount = allLines[allLines.length - 1] === '' ? allLines.length - 1 : allLines.length;
  if (tailLines !== undefined && tailLines > 0) {
    const tail = allLines.slice(-tailLines - 1).join('\n');
    return { contents: tail, lineCount: totalCount };
  }
  return { contents: r.stdout, lineCount: totalCount };
}

export async function peekInputRegion(window: number, tab: number): Promise<string> {
  const r = await runOsascript(PEEK_LAST_PARAGRAPH(window, tab));
  return r.code === 0 ? r.stdout : '';
}
