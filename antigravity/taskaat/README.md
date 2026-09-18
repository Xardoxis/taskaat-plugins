# Taskaat Antigravity Plugin

Official [Taskaat](https://taskaat.dev) plugin for Google Antigravity.

Brings persistent memory, execution flows, gate validation, and attention triage to Google Antigravity agents.

## Installation

### Option 1: Global Installation (Machine-wide)
Copy this `taskaat` directory to your Antigravity global plugins folder:

```powershell
# Windows
Copy-Item -Recurse "taskaat" "$env:USERPROFILE\.gemini\config\plugins\"

# macOS / Linux
cp -r taskaat ~/.gemini/config/plugins/
```

### Option 2: Project-Specific Installation
Place the directory inside your project's `.agents/plugins/`:

```powershell
Copy-Item -Recurse "taskaat" ".agents\plugins\"
```

## Configuration

In `mcp_config.json`, provide your Taskaat API key or set the `TASKAAT_API_KEY` environment variable:

```json
{
  "mcpServers": {
    "taskaat": {
      "url": "https://app.taskaat.dev/api/mcp?profile=core",
      "headers": {
        "Authorization": "Bearer ${TASKAAT_API_KEY}"
      }
    }
  }
}
```

Generate your API key in the Taskaat web application at [https://app.taskaat.dev](https://app.taskaat.dev).
