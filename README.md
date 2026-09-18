# Taskaat Plugins & Customizations

Official plugins and integrations for [Taskaat](https://taskaat.dev).

---

## 1. Claude Code Plugin

Add the marketplace and install the plugin directly in Claude Code:

```bash
/plugin marketplace add Xardoxis/taskaat-plugins
/plugin install taskaat@taskaat
```

Authenticates seamlessly via browser OAuth (RFC 9728 DCR) without copying API keys.

---

## 2. Google Antigravity Plugin

Antigravity brings persistent memory, task management, and execution flows to Google Antigravity agents.

### Installation

Copy the `antigravity/taskaat` plugin folder to your global Antigravity plugins directory:

```powershell
# Windows PowerShell
Copy-Item -Recurse "antigravity\taskaat" "$env:USERPROFILE\.gemini\config\plugins\"

# macOS / Linux
cp -r antigravity/taskaat ~/.gemini/config/plugins/
```

Or install it for a specific repository under `.agents/plugins/taskaat`.

---

## Documentation

Visit [https://taskaat.dev](https://taskaat.dev) for documentation, guides, and platform updates.
