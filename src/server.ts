#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { listTabs } from './tabs/list.js';
import { peekTab } from './tabs/peek.js';
import { dispatchToTab } from './tabs/dispatch.js';
import { focusTab } from './tabs/focus.js';
import { sendKeystroke, KeystrokeKey } from './tabs/keystroke.js';

const server = new McpServer({
  name: 'iterm-mcp',
  version: '0.1.0',
});

// `registerTool` in @modelcontextprotocol/sdk ^1.29 has extremely deep generic inference
// over Zod schemas. Combined with zod ^3.25, tsc hits TS2589 ("type instantiation is
// excessively deep and possibly infinite") and refuses to compile. This wrapper erases
// the SDK's generics at the call site — runtime behavior is identical, only the
// compile-time check is short-circuited. Retire when the SDK ships shallower overloads.
const reg: (name: string, config: any, cb: any) => void = (n, c, h) => {
  (server as any).registerTool(n, c, h);
};

reg(
  'iterm_ping',
  {
    description: 'Verify iTerm MCP server is responding',
    inputSchema: { message: z.string().optional().describe('Optional echo message') },
  },
  async ({ message }: { message?: string }) => ({
    content: [{ type: 'text', text: `pong${message ? ': ' + message : ''}` }],
  }),
);

reg(
  'tabs_list',
  {
    description: 'Enumerate all iTerm2 tabs with runtime detection (claude/codex/ssh/shell)',
    inputSchema: {},
  },
  async () => {
    const tabs = await listTabs();
    return { content: [{ type: 'text', text: JSON.stringify(tabs, null, 2) }] };
  },
);

reg(
  'tabs_peek',
  {
    description: 'Read iTerm tab contents. Optional tailLines truncates to last N lines.',
    inputSchema: {
      window: z.number().int().positive().describe('iTerm window index (1-based)'),
      tab: z.number().int().positive().describe('iTerm tab index (1-based)'),
      tailLines: z.number().int().positive().optional().describe('If set, return only the last N lines'),
    },
  },
  async ({ window, tab, tailLines }: { window: number; tab: number; tailLines?: number }) => {
    const result = await peekTab(window, tab, tailLines);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  },
);

reg(
  'tabs_dispatch',
  {
    description: 'Write text into an iTerm tab and submit. 3-tier escalation: CR+LF → keystroke → file-drop.',
    inputSchema: {
      window: z.number().int().positive(),
      tab: z.number().int().positive(),
      text: z.string().describe('Text to type into the tab'),
      submit: z.boolean().default(true).describe('If true, append submit keystroke'),
      escalation: z.enum(['auto', 'crlf', 'keystroke', 'fallback']).default('auto')
        .describe('Force a tier; auto tries crlf then keystroke then file-drop'),
    },
  },
  async ({ window, tab, text, submit, escalation }: { window: number; tab: number; text: string; submit: boolean; escalation: 'auto' | 'crlf' | 'keystroke' | 'fallback' }) => {
    const result = await dispatchToTab({ window, tab, text, submit, escalation });
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
  },
);

reg(
  'tabs_focus',
  {
    description: 'Bring an iTerm2 tab to the foreground',
    inputSchema: {
      window: z.number().int().positive(),
      tab: z.number().int().positive(),
    },
  },
  async ({ window, tab }: { window: number; tab: number }) => {
    const r = await focusTab(window, tab);
    return { content: [{ type: 'text', text: JSON.stringify(r) }] };
  },
);

reg(
  'tabs_send_keystroke',
  {
    description: 'Send a raw keystroke (return/tab/escape/backspace/space) to a tab via accessibility',
    inputSchema: {
      window: z.number().int().positive(),
      tab: z.number().int().positive(),
      key: z.enum(['return', 'tab', 'escape', 'backspace', 'space']),
    },
  },
  async ({ window, tab, key }: { window: number; tab: number; key: KeystrokeKey }) => {
    const r = await sendKeystroke(window, tab, key);
    return { content: [{ type: 'text', text: JSON.stringify(r) }] };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);

console.error('[iterm-mcp] server ready');
