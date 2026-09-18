#!/usr/bin/env node

/**
 * Taskaat Universal Setup & Login CLI
 * One-command setup for Claude Code and Google Antigravity.
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

async function loginAntigravity() {
  console.log('\n--- Connecting Taskaat to Google Antigravity ---');

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
      client_name: 'Google Antigravity',
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
                <span class="badge">✓ Connected</span>
                <h1>Authorization Successful</h1>
                <p>Taskaat is now connected to Google Antigravity. You can close this window and return to your terminal.</p>
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
  const accessToken = tokenData.access_token;

  // 5. Update Antigravity MCP configuration (~/.gemini/config/mcp_config.json)
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

  mcpConfig.mcpServers.taskaat = {
    url: MCP_ENDPOINT,
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  };

  fs.writeFileSync(mcpConfigFile, JSON.stringify(mcpConfig, null, 2), 'utf8');
  console.log(`✓ Updated Antigravity MCP config: ${mcpConfigFile}`);

  // 6. Install Antigravity plugin
  const pluginDir = path.join(geminiConfigDir, 'plugins', 'taskaat');
  const sourcePluginDir = path.join(__dirname, '..', 'antigravity', 'taskaat');

  if (fs.existsSync(sourcePluginDir)) {
    fs.cpSync(sourcePluginDir, pluginDir, { recursive: true, force: true });
    console.log(`✓ Installed Taskaat plugin to Antigravity: ${pluginDir}`);
  }

  console.log('\n🎉 Successfully connected Taskaat to Google Antigravity!');
}

async function setupClaudeCode() {
  console.log('\n--- Setting up Taskaat for Claude Code ---');

  const isWindows = process.platform === 'win32';
  const claudeCmd = isWindows ? 'npx.cmd @anthropic-ai/claude-code' : 'npx @anthropic-ai/claude-code';

  console.log('1. Adding marketplace: Xardoxis/taskaat-plugins...');
  try {
    execSync(`${claudeCmd} plugin marketplace add Xardoxis/taskaat-plugins`, { stdio: 'inherit' });
  } catch {
    console.log('Note: If marketplace was already added, continuing to install...');
  }

  console.log('\n2. Installing plugin: taskaat@taskaat...');
  try {
    execSync(`${claudeCmd} plugin install taskaat@taskaat`, { stdio: 'inherit' });
  } catch (err) {
    console.error('Plugin install encountered an error:', err.message);
  }

  console.log('\n✓ Taskaat plugin installed in Claude Code!');
  console.log('Next: When you launch Claude Code, run `/mcp` or prompt Claude to authorize in your browser.');
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'setup';

  console.log(`
╔══════════════════════════════════════════════╗
║               TASKAAT INSTALLER              ║
║   AI-Native Task Management for Pair Coding  ║
╚══════════════════════════════════════════════╝
`);

  if (command === 'antigravity' || args.includes('--antigravity')) {
    await loginAntigravity();
    return;
  }

  if (command === 'claude' || args.includes('--claude')) {
    await setupClaudeCode();
    return;
  }

  // Interactive menu
  console.log('Which AI coding assistant would you like to set up?');
  console.log('  [1] Both Google Antigravity & Claude Code (Recommended)');
  console.log('  [2] Google Antigravity only (Browser OAuth)');
  console.log('  [3] Claude Code only');
  console.log('  [4] Exit\n');

  const choice = await prompt('Enter choice [1-4] (default: 1): ');

  if (choice === '2') {
    await loginAntigravity();
  } else if (choice === '3') {
    await setupClaudeCode();
  } else if (choice === '4') {
    console.log('Exiting.');
    process.exit(0);
  } else {
    // Default 1
    await loginAntigravity();
    await setupClaudeCode();
  }

  console.log('\nAll done! Welcome to Taskaat (https://taskaat.dev)\n');
}

main().catch((err) => {
  console.error('\n❌ Setup failed:', err.message);
  process.exit(1);
});
