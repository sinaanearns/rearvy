#!/usr/bin/env node
/**
 * Start Rearvy Desktop with Blender MCP Bridge
 * Launches both the blender-mcp bridge and the desktop app concurrently
 */

/* eslint-disable @typescript-eslint/no-require-imports */
const { spawn } = require('child_process');
const path = require('path');

console.log('[desktop:blender] Starting Blender MCP bridge and desktop app...\n');

// Start blender-mcp-bridge as background process
const bridgeProcess = spawn('npm', ['run', 'blender:mcp-bridge'], {
  cwd: path.resolve(__dirname, '..'),
  stdio: 'inherit',
  detached: false,
});

bridgeProcess.on('error', (error) => {
  console.error('[desktop:blender] Failed to start blender bridge:', error);
  process.exit(1);
});

// Wait a moment for bridge to initialize, then start desktop
setTimeout(() => {
  console.log('[desktop:blender] Launching desktop app...\n');
  
  const desktopProcess = spawn('npm', ['run', 'dev:desktop'], {
    cwd: path.resolve(__dirname, '..'),
    stdio: 'inherit',
    detached: false,
  });

  desktopProcess.on('error', (error) => {
    console.error('[desktop:blender] Failed to start desktop:', error);
    bridgeProcess.kill();
    process.exit(1);
  });

  // Forward signals to child processes
  process.on('SIGINT', () => {
    console.log('\n[desktop:blender] Shutting down...');
    desktopProcess.kill();
    bridgeProcess.kill();
    process.exit(0);
  });
}, 2000);

bridgeProcess.on('exit', (code) => {
  if (code !== null && code !== 0) {
    console.warn(`[desktop:blender] Bridge process exited with code ${code}`);
  }
});
