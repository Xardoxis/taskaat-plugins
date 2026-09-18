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
- Registers and connects Google Antigravity via browser OAuth (zero manual API keys).
- Adds the marketplace and installs the plugin for Claude Code.

---

## Individual Installation

### 1. Claude Code Plugin

In Claude Code, run:

```bash
/plugin marketplace add Xardoxis/taskaat-plugins
/plugin install taskaat@taskaat
```

Or type `/plugin` in Claude Code, choose **Marketplaces > Add Marketplace**, and paste `Xardoxis/taskaat-plugins`.

---

### 2. Google Antigravity Plugin

To log in or configure Antigravity directly via browser OAuth:

```bash
npx.cmd github:Xardoxis/taskaat-plugins login
```

Or manually copy `antigravity/taskaat` into your global plugins directory:

```powershell
# Windows PowerShell
Copy-Item -Recurse "antigravity\taskaat" "$env:USERPROFILE\.gemini\config\plugins\"

# macOS / Linux
cp -r antigravity/taskaat ~/.gemini/config/plugins/
```

---

## Documentation

Visit [https://taskaat.dev](https://taskaat.dev) for documentation, guides, and platform updates.
