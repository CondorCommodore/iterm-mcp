import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { runOsascript } from '../applescript.js';
import { readConductorInfo, isSelfDispatch } from '../refuse-self.js';
import { listTabs } from './list.js';

const PENDING_DIR = path.join(os.homedir(), '.claude/plans/pending-dispatches');

export interface DispatchInput {
  window: number;
  tab: number;
  text: string;
  submit: boolean;
  escalation?: 'auto' | 'crlf' | 'keystroke' | 'fallback';
  conductorTabHint?: { window: number; tab: number };
}

export interface DispatchResult {
  dispatched: boolean;
  tierUsed: 'crlf' | 'keystroke' | 'fallback' | 'refused';
  fallbackPath?: string;
  reason?: string;
}

function escapeForApplescript(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function buildScript(window: number, tab: number, text: string, submit: boolean): string {
  const safe = escapeForApplescript(text);
  const submitLines = submit
    ? `\n        write text (character id 13) without newline\n        write text (character id 10) without newline`
    : '';
  return `
    tell application "iTerm2"
      tell session of (tab ${tab} of window ${window})
        write text "${safe}" without newline${submitLines}
      end tell
    end tell
  `;
}

const FOCUS_AND_KEYSTROKE_RETURN = (w: number, t: number) => `
tell application "iTerm2"
  activate
  tell window ${w} to select tab ${t}
end tell
delay 0.3
tell application "System Events"
  tell process "iTerm2"
    set frontmost to true
    delay 0.2
    keystroke return
  end tell
end tell
`;

const RESTORE_FOCUS = (w: number, t: number) => `
tell application "iTerm2"
  tell window ${w} to select tab ${t}
end tell
`;

async function tier2Keystroke(input: DispatchInput): Promise<DispatchResult> {
  if (input.text) {
    const writeScript = buildScript(input.window, input.tab, input.text, false);
    const w = await runOsascript(writeScript);
    if (w.code !== 0) {
      return { dispatched: false, tierUsed: 'keystroke', reason: 'write phase failed: ' + w.stderr.trim() };
    }
  }
  const r = await runOsascript(FOCUS_AND_KEYSTROKE_RETURN(input.window, input.tab));
  if (input.conductorTabHint) {
    await runOsascript(RESTORE_FOCUS(input.conductorTabHint.window, input.conductorTabHint.tab));
  }
  if (r.code !== 0) {
    return { dispatched: false, tierUsed: 'keystroke', reason: r.stderr.trim() };
  }
  return { dispatched: true, tierUsed: 'keystroke' };
}

async function tier3Fallback(input: DispatchInput, reason: string): Promise<DispatchResult> {
  await fs.mkdir(PENDING_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${ts}-w${input.window}t${input.tab}.md`;
  const filepath = path.join(PENDING_DIR, filename);
  const body = `# Pending dispatch — ${ts}

- window: ${input.window}
- tab: ${input.tab}
- submit: ${input.submit}
- reason: ${reason}

## Text

\`\`\`
${input.text}
\`\`\`
`;
  await fs.writeFile(filepath, body, 'utf-8');
  return { dispatched: false, tierUsed: 'fallback', fallbackPath: filepath, reason };
}

export async function dispatchToTab(input: DispatchInput): Promise<DispatchResult> {
  const escalation = input.escalation ?? 'auto';

  // Refuse-self gate (skipped in fallback-only mode, since the target may not even exist)
  if (escalation !== 'fallback') {
    const info = await readConductorInfo();
    let targetUuid: string | null = null;
    try {
      const tabs = await listTabs();
      const target = tabs.find(t => t.window === input.window && t.tab === input.tab);
      targetUuid = target?.resumeUuid ?? null;
    } catch {
      // ignore; refuse only by window/tab
    }
    if (isSelfDispatch({ window: input.window, tab: input.tab }, targetUuid, info)) {
      return {
        dispatched: false,
        tierUsed: 'refused',
        reason: `target w${input.window}/t${input.tab} matches conductor self or refuse-list`,
      };
    }
  }

  if (escalation === 'fallback') {
    return tier3Fallback(input, 'forced fallback');
  }

  if (escalation === 'keystroke') {
    return tier2Keystroke(input);
  }

  // crlf or auto: try Tier 1
  const script = buildScript(input.window, input.tab, input.text, input.submit);
  const r = await runOsascript(script);
  if (r.code !== 0) {
    if (escalation === 'crlf') {
      return { dispatched: false, tierUsed: 'crlf', reason: r.stderr.trim() };
    }
    // auto: escalate to Tier 2
    const t2 = await tier2Keystroke(input);
    if (t2.dispatched) return t2;
    // Tier 2 failed too — drop fallback
    return tier3Fallback(input, `tier1: ${r.stderr.trim()}; tier2: ${t2.reason ?? 'unknown'}`);
  }

  return { dispatched: true, tierUsed: 'crlf' };
}
