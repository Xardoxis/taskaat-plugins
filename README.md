# Taskaat Plugins & Customizations

Official plugins and integrations for [Taskaat](https://taskaat.dev).

---

## 🚀 1-Step Universal Setup

Configure Taskaat for Claude Code and Google Antigravity with a single command (no cloning, no npm install):

```bash
npx github:Xardoxis/taskaat-plugins
```

*(Or in Windows PowerShell: `npx.cmd github:Xardoxis/taskaat-plugins`)*.

This automatically:
- Opens your browser once for Taskaat authorization (zero manual API keys).
- Connects **both** Claude Code and Google Antigravity using that single sign-in.
- Installs the plugin for each assistant.

No `/mcp` step and no "authenticate" button — both assistants are connected by the
time the command finishes. Restart any running Claude Code session to pick up the
new server.

### Non-interactive

```bash
npx github:Xardoxis/taskaat-plugins claude        # Claude Code only
npx github:Xardoxis/taskaat-plugins antigravity   # Antigravity only
```

---

## Renewing access

The installer registers Taskaat with an access token that eventually expires.
Claude Code shows an in-session reminder a few days beforehand; renew at any time
by re-running the installer:

```bash
npx github:Xardoxis/taskaat-plugins claude
```

---

## Manual Installation

### Claude Code

The plugin provides the SessionStart hook and skills; the MCP connection is set up
by the installer above. To install the plugin by itself:

```bash
/plugin marketplace add Xardoxis/taskaat-plugins
/plugin install taskaat@taskaat
```

Then connect the MCP server (replace `<token>` with a Taskaat access token):

```bash
claude mcp add --transport http --scope user taskaat \
  "https://app.taskaat.dev/api/mcp?profile=core" \
  --header "Authorization: Bearer <token>"
```

Running `npx github:Xardoxis/taskaat-plugins claude` does both steps for you and
obtains the token via browser sign-in.

### Google Antigravity

Copy `antigravity/taskaat` into your global plugins directory:

```powershell
# Windows PowerShell
Copy-Item -Recurse "antigravity\taskaat" "$env:USERPROFILE\.gemini\config\plugins\"

# macOS / Linux
cp -r antigravity/taskaat ~/.gemini/config/plugins/
```

Then add your token to `~/.gemini/config/mcp_config.json`, or just run
`npx github:Xardoxis/taskaat-plugins antigravity`.

---

## Documentation

Visit [https://taskaat.dev](https://taskaat.dev) for documentation, guides, and platform updates.
