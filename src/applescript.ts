import { execFile } from 'node:child_process';

export interface OsResult {
  stdout: string;
  stderr: string;
  code: number;
  timedOut: boolean;
}

export async function runOsascript(script: string, timeoutMs = 10_000): Promise<OsResult> {
  return new Promise((resolve) => {
    execFile('osascript', ['-e', script], { timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      const e = err as (Error & { code?: number | string; signal?: string }) | null;
      resolve({
        stdout: stdout.toString(),
        stderr: stderr.toString(),
        code: e ? (typeof e.code === 'number' ? e.code : 1) : 0,
        timedOut: e?.signal === 'SIGTERM',
      });
    });
  });
}

export async function runShell(cmd: string, args: string[], timeoutMs = 5_000): Promise<OsResult> {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      const e = err as (Error & { code?: number | string; signal?: string }) | null;
      resolve({
        stdout: stdout.toString(),
        stderr: stderr.toString(),
        code: e ? (typeof e.code === 'number' ? e.code : 1) : 0,
        timedOut: e?.signal === 'SIGTERM',
      });
    });
  });
}
