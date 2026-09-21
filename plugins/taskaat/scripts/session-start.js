#!/usr/bin/env node

/**
 * Taskaat SessionStart Hook (TDE-405)
 * Injects project orientation guidance so Claude Code immediately knows to check
 * Taskaat task status, project foundation, and the ready queue.
 *
 * Also warns when the injected MCP bearer token is close to expiring. Claude Code
 * cannot refresh a header-supplied token on its own, so the user needs a nudge to
 * re-run the installer before it lapses.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const STATE_FILE = path.join(os.homedir(), '.taskaat', 'auth.json');
const WARN_WITHIN_MS = 3 * 24 * 60 * 60 * 1000;
const RENEW_COMMAND =
  process.platform === 'win32'
    ? 'npx.cmd github:Xardoxis/taskaat-plugins claude'
    : 'npx github:Xardoxis/taskaat-plugins claude';

const BASE_MESSAGE =
  'Taskaat is active in this workspace. Call __init_tasker_session and get_my_attention to check project status, gates, and the ready work queue before executing new tasks.';

/**
 * Returns a warning string when the token is expired or expiring soon, else null.
 * Silent when no state file exists — the plugin may be installed without the CLI.
 */
function expiryWarning() {
  let state;
  try {
    state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return null;
  }

  const expiresAt = Number(state && state.expiresAt);
  if (!Number.isFinite(expiresAt) || expiresAt <= 0) return null;

  const remaining = expiresAt - Date.now();
  if (remaining > WARN_WITHIN_MS) return null;

  if (remaining <= 0) {
    return `Taskaat access has expired. Taskaat tools will fail until you re-authorize: run \`${RENEW_COMMAND}\`, then restart this session.`;
  }

  const days = Math.max(1, Math.ceil(remaining / (24 * 60 * 60 * 1000)));
  return `Taskaat access expires in ${days} day${days === 1 ? '' : 's'}. Renew with \`${RENEW_COMMAND}\` to avoid interruption.`;
}

try {
  const warning = expiryWarning();

  const output = {
    continue: true,
    suppressOutput: false,
    systemMessage: warning ? `${BASE_MESSAGE}\n\n${warning}` : BASE_MESSAGE,
  };

  process.stdout.write(JSON.stringify(output) + '\n');
  process.exit(0);
} catch (err) {
  // Never crash or block session startup on hook failure
  process.stdout.write(JSON.stringify({ continue: true }) + '\n');
  process.exit(0);
}
