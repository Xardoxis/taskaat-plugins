#!/usr/bin/env node

/**
 * Taskaat SessionStart Hook (TDE-405)
 * Injects project orientation guidance so Claude Code immediately knows to check
 * Taskaat task status, project foundation, and the ready queue.
 */

try {
  const output = {
    continue: true,
    suppressOutput: false,
    systemMessage: "Taskaat is active in this workspace. Call __init_tasker_session and get_my_attention to check project status, gates, and the ready work queue before executing new tasks."
  };

  process.stdout.write(JSON.stringify(output) + "\n");
  process.exit(0);
} catch (err) {
  // Never crash or block session startup on hook failure
  process.stdout.write(JSON.stringify({ continue: true }) + "\n");
  process.exit(0);
}
