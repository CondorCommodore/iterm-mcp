# iterm-mcp

![version](https://img.shields.io/badge/version-0.2.0-blue) ![node](https://img.shields.io/badge/node-%E2%89%A520-brightgreen) ![platform](https://img.shields.io/badge/platform-macOS-lightgrey)

An [MCP](https://modelcontextprotocol.io/) server that exposes iTerm2 tab control as native tools — designed for the **conductor pattern** where one Claude/Codex session drives sibling tabs.

## Tools

| Tool | What it does |
|---|---|
| `iterm_ping` | Sanity check that the server is reachable |
| `tabs_list` | Enumerate iTerm tabs with runtime detection (claude / codex / ssh / shell) and resume-UUID extraction |
| `tabs_peek` | Read tab contents, optionally tail-limited to last N lines |
| `tabs_dispatch` | Write text into a tab with 3-tier submit escalation (CR+LF → keystroke → file-drop) |
| `tabs_focus` | Bring a tab to the foreground |
| `tabs_send_keystroke` | Send a raw `return` / `tab` / `escape` / `backspace` / `space` keystroke via Accessibility |

## Three-tier dispatch escalation

`tabs_dispatch` is the workhorse. Submitting text reliably across local-shell, claude, codex, and SSH-into-remote tabs needs different mechanisms, so the tool escalates:

1. **Tier 1 — `crlf`**: AppleScript `write text` + CR + LF. Fast and quiet; works for short text into local claude tabs.
2. **Tier 2 — `keystroke`**: Focus the tab, then have System Events deliver `keystroke return`. Required for codex tabs and remote ssh sessions where Tier 1 unreliably submits.
3. **Tier 3 — `fallback`**: Write the intended dispatch to `~/.claude/plans/pending-dispatches/<ts>-w<W>t<T>.md`. Operator-recoverable.

`escalation: "auto"` (default) tries Tier 1, falls through to Tier 2 on failure, drops to Tier 3 if both fail. You can also force a tier explicitly: `crlf`, `keystroke`, or `fallback`.

## Refuse-self

`tabs_dispatch` reads `~/.claude/plans/inter-agent-sync/conductor-active.txt` and refuses dispatch when:

- target window/tab matches the conductor's own tab, or
- target tab's resume UUID is in `also_refuse_self_for_resume_uuids`, or
- target tab's resume UUID equals the conductor's `session_id`.

This prevents the conductor from ever dispatching into itself (which would cause a feedback loop).

## Screenshot

> _(placeholder — drop a screenshot of `tabs_list` output in a claude session here)_

## Install

```bash
git clone https://github.com/CondorCommodore/iterm-mcp.git
cd iterm-mcp
npm install
npm run build
claude mcp add iterm-mcp -s user -- node $(pwd)/dist/server.js
```

On first dispatch, macOS will prompt to grant **Accessibility** permission to your terminal / Claude Code app so that System Events can deliver keystrokes. Grant it in System Settings → Privacy & Security → Accessibility.

## Smoke test

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"smoke","version":"0"}}}' | node dist/server.js
```

You should see a JSON-RPC `initialize` result on stdout and `[iterm-mcp] server ready` on stderr.

## Test

```bash
npm test           # vitest run tests/unit
npm run test:watch # vitest watch
```

Unit tests mock `osascript` / `ps` invocation and verify both the AppleScript shape we send and our result parsing.

## Troubleshooting

### `error TS2589: Type instantiation is excessively deep and possibly infinite`

The MCP SDK's `McpServer.registerTool` uses extremely deep generic inference over Zod schemas. With `zod ^3.25` and `@modelcontextprotocol/sdk ^1.29` together, TypeScript hits its instantiation-depth ceiling and refuses to compile.

We work around it in `src/server.ts` with a thin wrapper that erases the SDK's generics:

```ts
const reg: (name: string, config: any, cb: any) => void = (n, c, h) => {
  (server as any).registerTool(n, c, h);
};
```

Runtime behavior is identical — only the compile-time type check is short-circuited. When the SDK ships a less-recursive overload, the wrapper can be retired.

### `osascript: command not found`

iterm-mcp only runs on macOS. AppleScript and System Events are macOS-only.

### Dispatch silently no-ops on a codex or ssh tab

That's Tier 1 (`crlf`) being unreliable on those runtimes. Either let `escalation: "auto"` fall through to Tier 2, or pin `escalation: "keystroke"` directly.

### "Not authorized to send keystrokes"

System Events needs Accessibility permission for the *parent* process that spawns `osascript` (your terminal, or Claude Code itself). Grant it under System Settings → Privacy & Security → Accessibility.

### Refuse-self firing on the wrong tab

Check that `~/.claude/plans/inter-agent-sync/conductor-active.txt` reflects the conductor's actual window/tab. The file is `key=value` lines: `conductor_window`, `conductor_tab`, `session_id`, `also_refuse_self_for_resume_uuids` (comma-separated).

## License

MIT
