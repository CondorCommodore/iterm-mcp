# iterm-mcp

MCP server exposing iTerm2 tab control as native tools for the conductor pattern.

## Tools

| Tool | What it does |
|---|---|
| `tabs_list` | Enumerate iTerm tabs with runtime detection (claude/codex/ssh/shell) and resume-UUID extraction |
| `tabs_peek` | Read tab contents, optionally tail-limited to last N lines |
| `tabs_dispatch` | Write text into a tab with 3-tier submit escalation (CR+LF → keystroke → file-drop) |
| `tabs_focus` | Bring a tab to the foreground |
| `tabs_send_keystroke` | Send a raw `return` / `tab` / `escape` / `backspace` / `space` keystroke via accessibility |
| `iterm_ping` | Sanity check that the server is reachable |

## Three-tier dispatch escalation

1. **Tier 1 — `crlf`**: AppleScript `write text` + CR + LF. Works for short text into local claude tabs.
2. **Tier 2 — `keystroke`**: Focus tab + System Events `keystroke return`. Required for codex tabs and remote ssh tabs (Tier 1 unreliably submits there).
3. **Tier 3 — `fallback`**: Write the intended dispatch to `~/.claude/plans/pending-dispatches/<ts>-w<W>t<T>.md` for manual recovery.

`escalation: "auto"` (default) tries Tier 1, falls through to Tier 2 on failure, drops to Tier 3 if both fail.

## Refuse-self

`tabs_dispatch` reads `~/.claude/plans/inter-agent-sync/conductor-active.txt` and refuses dispatch to the conductor's own tab (window/tab match) or any tab whose resume UUID is in `also_refuse_self_for_resume_uuids`.

## Install

```bash
cd ~/code/iterm-mcp
npm install
npm run build
claude mcp add iterm-mcp -s user -- node $(pwd)/dist/server.js
```

## Test

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"smoke","version":"0"}}}' | node dist/server.js
```
