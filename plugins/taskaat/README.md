# Taskaat Claude Code Plugin

AI-native task management, execution flows, and project memory for [Claude Code](https://claude.ai/code).

Taskaat gives Claude Code persistent memory across sessions, structured goal-oriented execution flows, gate checks, and attention triage so coding agents stay aligned and productive without getting lost in large codebases.

## Installation

Add the official marketplace and install the plugin in Claude Code:

```bash
/plugin marketplace add Xardoxis/taskaat-plugins
/plugin install taskaat@taskaat
```

## Authentication

Taskaat uses OAuth 2.0 with Dynamic Client Registration (RFC 9728). No API keys or manual configuration files needed!

When you first use Taskaat or run `/mcp`, Claude Code will automatically open your browser to authorize with your Taskaat account at [app.taskaat.dev](https://app.taskaat.dev). Once authorized, Claude Code securely manages your access tokens.

## Features

- **Project Foundation & Knowledge Base**: Retain project directives, architectural constraints, and decisions across all sessions.
- **Ready Work Queue**: Always know what needs to be worked on next with `get_ready_work` and `get_my_attention`.
- **Execution Flows**: Step-by-step verified execution traces for complex refactors and feature builds.
- **SessionStart Hook**: Automatically injects context on session startup so the agent starts every session oriented.
- **Curated MCP Surface**: Optimized for token efficiency (~76 core tools, ~16k tokens) to maximize remaining context for your code.

## Quickstart

Start a Claude Code session in any project workspace and ask:

```text
What are we working on in Taskaat?
```

Or trigger triage directly:
```text
Check get_my_attention in Taskaat
```

## Documentation

Visit [https://taskaat.dev](https://taskaat.dev) for full documentation, guides, and updates.
