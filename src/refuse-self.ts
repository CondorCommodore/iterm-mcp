import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const DEFAULT_MARKER = path.join(os.homedir(), '.claude/plans/inter-agent-sync/conductor-active.txt');

export interface ConductorInfo {
  window: number | null;
  tab: number | null;
  sessionId: string | null;
  alsoRefuseUuids: string[];
}

export async function readConductorInfo(markerPath: string = DEFAULT_MARKER): Promise<ConductorInfo> {
  const fallback: ConductorInfo = { window: null, tab: null, sessionId: null, alsoRefuseUuids: [] };
  try {
    const txt = await fs.readFile(markerPath, 'utf-8');
    const info: ConductorInfo = { ...fallback };
    for (const line of txt.split('\n')) {
      const eq = line.indexOf('=');
      if (eq < 0) continue;
      const k = line.slice(0, eq).trim();
      const v = line.slice(eq + 1).trim();
      if (k === 'conductor_window') info.window = parseInt(v, 10) || null;
      else if (k === 'conductor_tab') info.tab = parseInt(v, 10) || null;
      else if (k === 'session_id') info.sessionId = v || null;
      else if (k === 'also_refuse_self_for_resume_uuids') {
        info.alsoRefuseUuids = v ? v.split(',').map(s => s.trim()).filter(Boolean) : [];
      }
    }
    return info;
  } catch {
    return fallback;
  }
}

export function isSelfDispatch(
  target: { window: number; tab: number },
  targetResumeUuid: string | null,
  info: ConductorInfo,
): boolean {
  if (info.window === target.window && info.tab === target.tab) return true;
  if (targetResumeUuid && info.alsoRefuseUuids.includes(targetResumeUuid)) return true;
  if (targetResumeUuid && info.sessionId && targetResumeUuid === info.sessionId) return true;
  return false;
}
