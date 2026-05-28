const RESUME_UUID = /(?:--resume|-r)\s+([0-9a-f-]{36})/;

export type Runtime = 'claude' | 'codex' | 'ssh' | 'shell' | 'unknown';

export function detectRuntimeFromCmdline(cmd: string): { runtime: Runtime; resumeUuid: string | null } {
  if (!cmd) return { runtime: 'unknown', resumeUuid: null };
  const lower = cmd.toLowerCase();
  if (lower.includes('claude')) {
    const m = cmd.match(RESUME_UUID);
    return { runtime: 'claude', resumeUuid: m ? m[1] : null };
  }
  if (lower.includes('codex')) return { runtime: 'codex', resumeUuid: null };
  if (/^\s*ssh\b/.test(cmd) || lower.startsWith('ssh ')) return { runtime: 'ssh', resumeUuid: null };
  if (/(^|[\s\-/])(zsh|bash|sh|fish)\b/.test(lower)) return { runtime: 'shell', resumeUuid: null };
  return { runtime: 'unknown', resumeUuid: null };
}
