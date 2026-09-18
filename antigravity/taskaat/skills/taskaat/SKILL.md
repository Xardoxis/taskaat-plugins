---
name: taskaat
description: AI-native task management, execution flows, and project memory for Taskaat (https://taskaat.dev). Use this skill when managing tasks, inspecting project status, running execution flows, checking gates, creating tasks, or triaging ready work with Taskaat MCP.
---

# Taskaat Skill for Antigravity

Taskaat provides persistent memory, goal-oriented execution flows, gate checks, and attention triage for AI pair-programming agents.

## Core Workflows

### 1. Starting a Session
At the start of a session, orient yourself with the project context:
- Call `__init_tasker_session` to fetch behavioral preferences and the directive playbook.
- Call `get_my_attention` to triage what needs attention (reviews, human guidance, stalled flows).

### 2. Finding & Starting Work
- Call `list_projects` or `get_project` to inspect the project boundaries.
- Call `get_ready_work` to find open tasks whose dependencies are fully satisfied.
- Call `get_task` to pull the task description, acceptance criteria, and milestones.

### 3. Execution Flows & Multi-Step Work
For larger features or refactors with multiple interdependent steps:
- Call `run_flow` to load the step-by-step DAG playbook.
- Check input contracts and blockers with `get_task_connections`.
- Produce artifacts and register them with `store_artifact`.
- Call `validate_output` to check acceptance criteria against output contracts.

### 4. Completing Work
- Ensure all milestone criteria are checked.
- Append a result entry to the session ledger via `append_session_activity`.
- Call `complete_task` when the work is verifiably done.
