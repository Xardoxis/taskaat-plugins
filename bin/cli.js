#!/usr/bin/env node

/**
 * Taskaat Universal Setup & Login CLI
 * One-command setup for Claude Code and Google Antigravity.
 *
 * Both targets share a single browser OAuth flow: authenticate once, then the
 * resulting token is written into whichever assistants were selected. Neither
 * target requires the user to click an "authenticate" button afterwards.
 */

const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec, execSync } = require('child_process');
const readline = require('readline');

const BASE_URL = 'https://app.taskaat.dev';
const MCP_ENDPOINT = 'https://app.taskaat.dev/api/mcp?profile=core';
const MARKETPLACE = 'Xardoxis/taskaat-plugins';
const SERVER_NAME = 'taskaat';

// Where we record token expiry so the SessionStart hook can nudge before it lapses.
const STATE_DIR = path.join(os.homedir(), '.taskaat');
const STATE_FILE = path.join(STATE_DIR, 'auth.json');

// Claude Code's own OAuth store. We only ever delete Taskaat's own orphaned
// entries from it; everything else in the file is left untouched.
const CLAUDE_CREDENTIALS = path.join(os.homedir(), '.claude', '.credentials.json');
const ORPHANED_OAUTH_PREFIX = 'plugin:taskaat:taskaat|';

function openBrowser(url) {
  const platform = process.platform;
  let cmd;
  if (platform === 'win32') {
    cmd = `start "" "${url}"`;
  } else if (platform === 'darwin') {
    cmd = `open "${url}"`;
  } else {
    cmd = `xdg-open "${url}"`;
  }
  exec(cmd, (err) => {
    if (err) {
      console.log('\nCould not automatically open browser. Please open this URL:');
      console.log(`  ${url}\n`);
    }
  });
}

function prompt(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Browser OAuth (RFC 7591 registration + RFC 7636 PKCE + RFC 6749 code exchange).
 *
 * `clientName` is what the user sees on the Taskaat consent screen, so it must
 * name the assistant actually being connected.
 */
async function authenticate(clientName) {
  console.log(`\n--- Authorizing Taskaat for ${clientName} ---`);

  // Find an available local port
  const server = http.createServer();
  await new Promise((resolve) => server.listen(0, 'localhost', resolve));
  const port = server.address().port;
  const redirectUri = `http://localhost:${port}/callback`;

  // 1. Dynamic Client Registration (RFC 7591)
  console.log('Registering client with Taskaat...');
  const regRes = await fetch(`${BASE_URL}/api/oauth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_name: clientName,
      redirect_uris: [redirectUri],
    }),
  });

  if (!regRes.ok) {
    server.close();
    throw new Error(`Client registration failed: ${regRes.statusText}`);
  }
  const regData = await regRes.json();
  const clientId = regData.client_id;

  // 2. PKCE Setup (RFC 7636)
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
  const state = crypto.randomBytes(16).toString('base64url');

  const authUrl = `${BASE_URL}/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&code_challenge=${codeChallenge}&code_challenge_method=S256&state=${state}&resource=${encodeURIComponent('https://app.taskaat.dev/api/mcp')}`;

  console.log('Opening browser for Taskaat authorization...');
  console.log(`If the browser does not open automatically, visit:\n  ${authUrl}\n`);
  openBrowser(authUrl);

  // 3. Await Callback
  const authCode = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      server.close();
      reject(new Error('Authentication timed out waiting for browser authorization.'));
    }, 120000);

    server.on('request', async (req, res) => {
      const parsedUrl = new URL(req.url, `http://localhost:${port}`);
      if (parsedUrl.pathname === '/callback') {
        const error = parsedUrl.searchParams.get('error');
        const code = parsedUrl.searchParams.get('code');
        const reqState = parsedUrl.searchParams.get('state');

        if (error) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end('<h1>Authorization Failed</h1><p>You may close this window and try again.</p>');
          clearTimeout(timeout);
          server.close();
          return reject(new Error(`OAuth error: ${error}`));
        }

        if (reqState !== state || !code) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end('<h1>Invalid Request</h1><p>State mismatch or missing code.</p>');
          clearTimeout(timeout);
          server.close();
          return reject(new Error('OAuth state mismatch.'));
        }

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Taskaat Connected</title>
              <style>
                body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #0b0f19; color: #f3f4f6; }
                .card { background: #111827; border: 1px solid #1f2937; padding: 2.5rem; border-radius: 1rem; text-align: center; max-width: 420px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
                h1 { font-size: 1.5rem; margin-bottom: 0.5rem; color: #10b981; }
                p { color: #9ca3af; line-height: 1.5; margin-bottom: 1.5rem; }
                .badge { display: inline-block; background: #064e3b; color: #34d399; font-weight: 600; padding: 0.35rem 0.85rem; border-radius: 9999px; font-size: 0.875rem; }
              </style>
            </head>
            <body>
              <div class="card">
                <span class="badge">&#10003; Connected</span>
                <h1>Authorization Successful</h1>
                <p>Taskaat is now connected to ${clientName}. You can close this window and return to your terminal.</p>
              </div>
            </body>
          </html>
        `);

        clearTimeout(timeout);
        server.close();
        resolve(code);
      }
    });
  });

  // 4. Exchange Code for Token (RFC 6749)
  console.log('Exchanging authorization code for access token...');
  const tokenRes = await fetch(`${BASE_URL}/api/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code: authCode,
      redirect_uri: redirectUri,
      client_id: clientId,
      code_verifier: codeVerifier,
    }),
  });

  if (!tokenRes.ok) {
    throw new Error(`Token exchange failed: ${tokenRes.statusText}`);
  }
  const tokenData = await tokenRes.json();

  if (!tokenData.access_token) {
    throw new Error('Token endpoint did not return an access token.');
  }

  return {
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token || null,
    clientId,
    // expires_in is seconds from now; absent means we simply don't nudge.
    expiresAt: tokenData.expires_in
      ? Date.now() + Number(tokenData.expires_in) * 1000
      : null,
  };
}

/**
 * Record non-MCP auth metadata so the plugin's SessionStart hook can warn the
 * user before the injected bearer token expires.
 */
function saveAuthState(auth, targets) {
  try {
    fs.mkdirSync(STATE_DIR, { recursive: true });

    const state = {
      expiresAt: auth.expiresAt,
      refreshToken: auth.refreshToken,
      clientId: auth.clientId,
      targets,
      updatedAt: Date.now(),
    };

    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), { encoding: 'utf8', mode: 0o600 });
  } catch (err) {
    // Non-fatal: the nudge is a convenience, not part of the connection.
    console.log(`Note: could not record token expiry (${err.message}).`);
  }
}

/**
 * Remove OAuth entries Claude Code created for the plugin-provided MCP server.
 *
 * The plugin no longer ships a .mcp.json, so any `plugin:taskaat:taskaat|...`
 * entries left in the store are orphans from an older install. Every other
 * credential in the file is preserved.
 */
function cleanupOrphanedClaudeCredentials() {
  try {
    if (!fs.existsSync(CLAUDE_CREDENTIALS)) return;

    const raw = fs.readFileSync(CLAUDE_CREDENTIALS, 'utf8');
    const creds = JSON.parse(raw);
    if (!creds || typeof creds.mcpOAuth !== 'object' || creds.mcpOAuth === null) return;

    const orphans = Object.keys(creds.mcpOAuth).filter((key) => key.startsWith(ORPHANED_OAUTH_PREFIX));
    if (orphans.length === 0) return;

    fs.writeFileSync(`${CLAUDE_CREDENTIALS}.taskaat-backup`, raw, { encoding: 'utf8', mode: 0o600 });
    for (const key of orphans) delete creds.mcpOAuth[key];
    fs.writeFileSync(CLAUDE_CREDENTIALS, JSON.stringify(creds, null, 2), { encoding: 'utf8', mode: 0o600 });

    console.log(`  Removed ${orphans.length} orphaned plugin OAuth entr${orphans.length === 1 ? 'y' : 'ies'} (backup written alongside).`);
  } catch (err) {
    console.log(`  Note: could not clean old OAuth entries (${err.message}).`);
  }
}

/**
 * Prefer a `claude` already on PATH; fall back to npx for fresh machines.
 */
function resolveClaudeCommand() {
  const isWindows = process.platform === 'win32';
  const direct = isWindows ? 'claude.cmd' : 'claude';

  try {
    execSync(`${direct} --version`, { stdio: 'ignore' });
    return direct;
  } catch {
    return isWindows ? 'npx.cmd @anthropic-ai/claude-code' : 'npx @anthropic-ai/claude-code';
  }
}

function runQuiet(cmd) {
  try {
    execSync(cmd, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

async function configureAntigravity(auth) {
  console.log('\n--- Configuring Google Antigravity ---');

  const geminiConfigDir = path.join(os.homedir(), '.gemini', 'config');
  const mcpConfigFile = path.join(geminiConfigDir, 'mcp_config.json');

  if (!fs.existsSync(geminiConfigDir)) {
    fs.mkdirSync(geminiConfigDir, { recursive: true });
  }

  let mcpConfig = { mcpServers: {} };
  if (fs.existsSync(mcpConfigFile)) {
    try {
      mcpConfig = JSON.parse(fs.readFileSync(mcpConfigFile, 'utf8'));
      if (!mcpConfig.mcpServers) mcpConfig.mcpServers = {};
    } catch {
      mcpConfig = { mcpServers: {} };
    }
  }

  mcpConfig.mcpServers[SERVER_NAME] = {
    url: MCP_ENDPOINT,
    headers: {
      Authorization: `Bearer ${auth.accessToken}`,
    },
  };

  fs.writeFileSync(mcpConfigFile, JSON.stringify(mcpConfig, null, 2), 'utf8');
  console.log(`  Updated Antigravity MCP config: ${mcpConfigFile}`);

  // Install Antigravity plugin
  const pluginDir = path.join(geminiConfigDir, 'plugins', 'taskaat');
  const sourcePluginDir = path.join(__dirname, '..', 'antigravity', 'taskaat');

  if (fs.existsSync(sourcePluginDir)) {
    fs.cpSync(sourcePluginDir, pluginDir, { recursive: true, force: true });
    console.log(`  Installed Taskaat plugin: ${pluginDir}`);
  }

  console.log('  Antigravity is connected.');
}

/**
 * Install the plugin (hooks + skills) and register the MCP server with the
 * token already attached, so Claude Code never shows an auth prompt.
 */
async function configureClaudeCode(auth) {
  console.log('\n--- Configuring Claude Code ---');

  const claudeCmd = resolveClaudeCommand();

  console.log(`  Adding marketplace: ${MARKETPLACE}...`);
  runQuiet(`${claudeCmd} plugin marketplace add ${MARKETPLACE}`);

  console.log('  Installing plugin: taskaat@taskaat...');
  if (!runQuiet(`${claudeCmd} plugin install taskaat@taskaat`)) {
    console.log('  Note: plugin install reported an error (it may already be installed).');
  }

  // Replace any previous registration so re-running the installer refreshes the token.
  runQuiet(`${claudeCmd} mcp remove ${SERVER_NAME}`);

  console.log('  Registering authenticated MCP server...');
  const addCmd = `${claudeCmd} mcp add --transport http --scope user ${SERVER_NAME} "${MCP_ENDPOINT}" --header "Authorization: Bearer ${auth.accessToken}"`;

  try {
    execSync(addCmd, { stdio: 'ignore' });
  } catch (err) {
    throw new Error(`Failed to register Taskaat with Claude Code: ${err.message}`);
  }

  cleanupOrphanedClaudeCredentials();

  console.log('  Claude Code is connected. No /mcp step required.');
}

function reportExpiry(auth) {
  if (!auth.expiresAt) return;
  const days = Math.max(0, Math.round((auth.expiresAt - Date.now()) / 86400000));
  console.log(`\nAccess token valid for ~${days} day${days === 1 ? '' : 's'}.`);
  console.log('Taskaat will remind you in-session before it lapses; re-run this installer to renew.');
}

async function setup(targets) {
  // One consent screen covers both assistants when both are selected.
  const clientName =
    targets.length > 1
      ? 'Taskaat (Claude Code + Google Antigravity)'
      : targets[0] === 'claude-code'
        ? 'Claude Code'
        : 'Google Antigravity';

  const auth = await authenticate(clientName);

  if (targets.includes('antigravity')) await configureAntigravity(auth);
  if (targets.includes('claude-code')) await configureClaudeCode(auth);

  saveAuthState(auth, targets);
  reportExpiry(auth);

  console.log('\nSuccessfully connected Taskaat.');
  if (targets.includes('claude-code')) {
    console.log('Restart any running Claude Code session to pick up the new server.');
  }
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'setup';

  console.log(`
+----------------------------------------------+
|               TASKAAT INSTALLER              |
|   AI-Native Task Management for Pair Coding  |
+----------------------------------------------+
`);

  if (command === 'antigravity' || args.includes('--antigravity')) {
    await setup(['antigravity']);
    return;
  }

  if (command === 'claude' || args.includes('--claude')) {
    await setup(['claude-code']);
    return;
  }

  // Interactive menu
  console.log('Which AI coding assistant would you like to set up?');
  console.log('  [1] Both Google Antigravity & Claude Code (Recommended)');
  console.log('  [2] Google Antigravity only');
  console.log('  [3] Claude Code only');
  console.log('  [4] Exit\n');

  const choice = await prompt('Enter choice [1-4] (default: 1): ');

  if (choice === '2') {
    await setup(['antigravity']);
  } else if (choice === '3') {
    await setup(['claude-code']);
  } else if (choice === '4') {
    console.log('Exiting.');
    process.exit(0);
  } else {
    await setup(['antigravity', 'claude-code']);
  }

  console.log('\nAll done! Welcome to Taskaat (https://taskaat.dev)\n');
}

if (require.main === module) {
  main().catch((err) => {
    console.error('\nSetup failed:', err.message);
    process.exit(1);
  });
}

module.exports = {
  authenticate,
  configureAntigravity,
  configureClaudeCode,
  cleanupOrphanedClaudeCredentials,
  resolveClaudeCommand,
  saveAuthState,
};
