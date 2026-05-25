#!/usr/bin/env node
// Start the web dev server, wait for the actual port it chooses, then start Electron.
/* eslint-disable @typescript-eslint/no-require-imports */
const { spawn } = require('child_process');
const http = require('http');
const https = require('https');

if (process.env.VERCEL) {
  console.log('Skipping desktop dev on Vercel');
  process.exit(0);
}

const DEFAULT_START_PATH = '/chat/new';
const START_PATH = normalizeRoutePath(process.env.REARVY_DESKTOP_START_PATH || DEFAULT_START_PATH);
const WAIT_TIMEOUT_MS = 300000;
const EXISTING_SERVER_WAIT_TIMEOUT_MS = 12000;

let webChild = null;
let desktopChild = null;
let shuttingDown = false;
let desktopStarted = false;
let desktopStartTimer = null;
let desktopStartOrigin = null;
let desktopWaitId = 0;
let desktopWaitOrigin = null;
let webOutputBuffer = '';
let discoveredWebOrigin = null;
let webReady = false;
let usingExistingWebServer = false;
let existingWebServerPid = null;

console.log('[dev:both] checking for existing web server');
findExistingWebServer()
  .then((origin) => {
    if (shuttingDown) {
      return;
    }

    if (origin) {
      usingExistingWebServer = true;
      discoveredWebOrigin = origin;
      webReady = true;
      console.log(`[dev:both] reusing already-running web server: ${origin}`);
      scheduleDesktopStart(origin, 0, { replace: true });
      return;
    }

    startWebServer();
  })
  .catch((error) => {
    console.warn('[dev:both] existing web server check failed:', error?.message || error);
    startWebServer();
  });

process.on('SIGINT', () => shutdown(130));
process.on('SIGTERM', () => shutdown(143));

function startWebServer() {
  console.log('[dev:both] starting web server');
  webChild = spawnNpmScript('dev:web', {
    cwd: process.cwd(),
    env: process.env,
  });

  pipeChildOutput(webChild, 'web', handleWebOutput);

  webChild.on('exit', (code, signal) => {
    if (shuttingDown) {
      return;
    }

    const existingServer = extractExistingNextServer(webOutputBuffer);
    if (existingServer) {
      usingExistingWebServer = true;
      existingWebServerPid = existingServer.pid;
      scheduleDesktopStart(existingServer.origin, 0, { replace: true });
      return;
    }

    if (usingExistingWebServer && (desktopStarted || desktopStartTimer)) {
      return;
    }

    const exitCode = typeof code === 'number' ? code : signal ? 1 : 0;
    console.error(`[dev:both] web server exited before shutdown (code ${exitCode})`);
    shutdown(exitCode || 1);
  });
}

function handleWebOutput(chunk) {
  webOutputBuffer = `${webOutputBuffer}${chunk}`.slice(-8000);

  const existingServer = extractExistingNextServer(webOutputBuffer);
  if (existingServer) {
    usingExistingWebServer = true;
    existingWebServerPid = existingServer.pid;
    discoveredWebOrigin = existingServer.origin;
    webReady = true;
    scheduleDesktopStart(existingServer.origin, 0, { replace: true });
    return;
  }

  const origin = extractLocalOrigin(webOutputBuffer);
  if (origin) {
    discoveredWebOrigin = origin;
  }

  if (/Ready in/i.test(webOutputBuffer)) {
    webReady = true;
  }

  if (discoveredWebOrigin && webReady) {
    scheduleDesktopStart(discoveredWebOrigin, 750);
  }
}

function scheduleDesktopStart(origin, delayMs, options = {}) {
  if (desktopStarted || shuttingDown) {
    return;
  }

  if (options.replace && (desktopStartOrigin === origin || desktopWaitOrigin === origin)) {
    return;
  }

  if (!options.replace && (desktopStartOrigin || desktopWaitOrigin)) {
    return;
  }

  if (desktopStartTimer) {
    clearTimeout(desktopStartTimer);
  }

  if (options.replace && desktopWaitOrigin) {
    desktopWaitId += 1;
    desktopWaitOrigin = null;
  }

  desktopStartOrigin = origin;
  desktopStartTimer = setTimeout(() => {
    desktopStartTimer = null;
    desktopStartOrigin = null;
    startDesktopAfterWebReady(origin);
  }, delayMs);
}

function startDesktopAfterWebReady(origin) {
  if (desktopStarted || shuttingDown) {
    return;
  }

  const waitId = (desktopWaitId += 1);
  desktopWaitOrigin = origin;
  if (usingExistingWebServer) {
    console.log(`[dev:both] using already-running web server: ${origin}`);
  }
  console.log(`[dev:both] waiting for web app: ${origin}`);

  const timeout = usingExistingWebServer ? EXISTING_SERVER_WAIT_TIMEOUT_MS : WAIT_TIMEOUT_MS;
  waitForHttp(origin, timeout)
    .then(() => {
      if (waitId !== desktopWaitId || desktopStarted || shuttingDown) {
        return;
      }

      desktopWaitOrigin = null;

      const desktopUrl = new URL(START_PATH, `${origin}/`).toString();
      console.log(`[dev:both] web server available - launching desktop at ${desktopUrl}`);

      desktopStarted = true;
      desktopChild = spawnNpmScript('dev:desktop', {
        cwd: process.cwd(),
        env: {
          ...process.env,
          REARVY_DESKTOP_AUTO_START_WEBSITE: '0',
          REARVY_DESKTOP_DEV_URL: desktopUrl,
          REARVY_DESKTOP_START_PATH: START_PATH,
        },
      });

      pipeChildOutput(desktopChild, 'desktop');

      desktopChild.on('exit', (code, signal) => {
        if (shuttingDown) {
          return;
        }

        const exitCode = typeof code === 'number' ? code : signal ? 1 : 0;
        console.log(`[dev:both] desktop exited (code ${exitCode})`);
        shutdown(exitCode);
      });
    })
    .catch((err) => {
      if (waitId !== desktopWaitId || desktopStarted || shuttingDown) {
        return;
      }

      desktopWaitOrigin = null;

      if (usingExistingWebServer && existingWebServerPid) {
        console.error(`[dev:both] existing web server at ${origin} did not respond.`);
        console.error(`[dev:both] stop it with: taskkill /PID ${existingWebServerPid} /F`);
      }
      console.error('[dev:both] wait error:', err);
      shutdown(1);
    });
}

async function waitForHttp(resourceUrl, timeoutMs) {
  const deadline = Date.now() + timeoutMs;

  while (!shuttingDown && Date.now() < deadline) {
    if (await canReachHttp(resourceUrl)) {
      return;
    }

    await sleep(500);
  }

  throw new Error(`Timed out waiting for ${resourceUrl}`);
}

async function findExistingWebServer() {
  const candidates = [];
  for (const value of [
    process.env.REARVY_DESKTOP_DEV_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    'http://localhost:3000',
  ]) {
    const origin = normalizeLocalOrigin(value);
    if (origin && !candidates.includes(origin)) {
      candidates.push(origin);
    }
  }

  for (const origin of candidates) {
    if (await canReachHttp(origin)) {
      return origin;
    }
  }

  return null;
}

function normalizeLocalOrigin(value) {
  if (!value) {
    return null;
  }

  try {
    const parsed = new URL(value);
    if (
      parsed.protocol !== 'http:' ||
      (parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1')
    ) {
      return null;
    }

    return parsed.origin;
  } catch {
    return null;
  }
}

function canReachHttp(resourceUrl) {
  return new Promise((resolve) => {
    let parsed;
    try {
      parsed = new URL(resourceUrl);
    } catch {
      resolve(false);
      return;
    }

    const client = parsed.protocol === 'https:' ? https : http;
    const request = client.request(
      parsed,
      {
        method: 'HEAD',
        timeout: 5000,
      },
      (response) => {
        response.resume();
        resolve(Boolean(response.statusCode && response.statusCode < 500));
      },
    );

    request.on('timeout', () => {
      request.destroy();
      resolve(false);
    });

    request.on('error', () => resolve(false));
    request.end();
  });
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function spawnNpmScript(scriptName, options) {
  const command = process.platform === 'win32' ? process.env.ComSpec || 'cmd.exe' : 'npm';
  const args =
    process.platform === 'win32'
      ? ['/d', '/s', '/c', `npm run ${scriptName}`]
      : ['run', scriptName];

  return spawn(command, args, {
    cwd: options.cwd,
    env: options.env,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
}

function pipeChildOutput(child, label, onChunk) {
  child.stdout.on('data', (chunk) => {
    const text = chunk.toString();
    writePrefixed(label, text, process.stdout);
    if (onChunk) {
      onChunk(text);
    }
  });

  child.stderr.on('data', (chunk) => {
    const text = chunk.toString();
    writePrefixed(label, text, process.stderr);
    if (onChunk) {
      onChunk(text);
    }
  });
}

function writePrefixed(label, text, stream) {
  for (const line of text.split(/\r?\n/)) {
    if (line.length > 0) {
      stream.write(`[${label}] ${line}\n`);
    }
  }
}

function extractLocalOrigin(text) {
  const match = text.match(/https?:\/\/localhost:\d+/i);
  if (!match) {
    return null;
  }

  return new URL(match[0]).origin;
}

function extractExistingNextServer(text) {
  const conflictIndex = text.search(/Another next dev server is already running/i);
  if (conflictIndex === -1) {
    return null;
  }

  const conflictText = text.slice(conflictIndex);
  const originMatch = conflictText.match(/-\s*Local:\s*(https?:\/\/localhost:\d+)/i);
  if (!originMatch) {
    return null;
  }

  const pidMatch = conflictText.match(/-\s*PID:\s*(\d+)/i);
  return {
    origin: new URL(originMatch[1]).origin,
    pid: pidMatch ? pidMatch[1] : null,
  };
}

function normalizeRoutePath(value) {
  if (!value) {
    return '/';
  }

  try {
    const parsed = new URL(value);
    return `${parsed.pathname}${parsed.search}${parsed.hash}` || '/';
  } catch {
    return value.startsWith('/') ? value : `/${value}`;
  }
}

function shutdown(code) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  desktopWaitId += 1;
  if (desktopStartTimer) {
    clearTimeout(desktopStartTimer);
    desktopStartTimer = null;
  }
  desktopStartOrigin = null;
  desktopWaitOrigin = null;
  stopChild(desktopChild);
  stopChild(webChild);

  setTimeout(() => process.exit(code), 100).unref();
}

function stopChild(child) {
  if (!child || child.exitCode !== null || child.killed) {
    return;
  }

  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
        stdio: 'ignore',
        windowsHide: true,
      });
      return;
    }

    child.kill('SIGTERM');
  } catch {
    // Best-effort dev process cleanup.
  }
}
