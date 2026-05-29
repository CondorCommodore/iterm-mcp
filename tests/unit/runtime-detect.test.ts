import { describe, it, expect } from 'vitest';
import { detectRuntimeFromCmdline } from '../../src/runtime-detect.js';

describe('detectRuntimeFromCmdline', () => {
  it('detects claude with --resume UUID', () => {
    const r = detectRuntimeFromCmdline(
      'node /usr/local/bin/claude --resume 12345678-1234-1234-1234-123456789abc',
    );
    expect(r.runtime).toBe('claude');
    expect(r.resumeUuid).toBe('12345678-1234-1234-1234-123456789abc');
  });

  it('detects claude with -r short flag', () => {
    const r = detectRuntimeFromCmdline('claude -r 12345678-1234-1234-1234-123456789abc');
    expect(r.runtime).toBe('claude');
    expect(r.resumeUuid).toBe('12345678-1234-1234-1234-123456789abc');
  });

  it('detects claude without resume UUID', () => {
    const r = detectRuntimeFromCmdline('node claude');
    expect(r.runtime).toBe('claude');
    expect(r.resumeUuid).toBeNull();
  });

  it('detects codex', () => {
    const r = detectRuntimeFromCmdline('codex --some-flag');
    expect(r.runtime).toBe('codex');
    expect(r.resumeUuid).toBeNull();
  });

  it('detects ssh', () => {
    const r = detectRuntimeFromCmdline('ssh forge@100.110.142.92');
    expect(r.runtime).toBe('ssh');
  });

  it('detects shell', () => {
    expect(detectRuntimeFromCmdline('-zsh').runtime).toBe('shell');
    expect(detectRuntimeFromCmdline('/bin/bash').runtime).toBe('shell');
  });

  it('returns unknown for empty cmd', () => {
    expect(detectRuntimeFromCmdline('').runtime).toBe('unknown');
  });
});
