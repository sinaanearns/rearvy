#!/usr/bin/env node
// Wait for the dev web server and then start the desktop app.
const waitOn = require('wait-on');
const { execSync } = require('child_process');

const resources = [process.env.REARVY_DESKTOP_DEV_URL || 'http://localhost:3000'];

if (process.env.VERCEL) {
  console.log('Skipping desktop dev on Vercel');
  process.exit(0);
}

console.log('[dev:both] waiting for:', resources[0]);

waitOn({ resources, timeout: 300000 }, (err) => {
  if (err) {
    console.error('[dev:both] wait-on error:', err);
    process.exit(1);
  }

  console.log('[dev:both] web server available — launching desktop');

  try {
    execSync('npm run dev:desktop', { stdio: 'inherit' });
  } catch (e) {
    console.error('[dev:both] failed to start desktop:', e && e.message ? e.message : e);
    process.exit(e.status || 1);
  }
});
