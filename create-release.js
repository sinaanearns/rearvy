#!/usr/bin/env node
const { Octokit } = require('octokit');

const token = process.env.GITHUB_TOKEN;
if (!token) {
  console.error('Error: GITHUB_TOKEN environment variable not set');
  process.exit(1);
}

const octokit = new Octokit({ auth: token });

const releaseData = {
  owner: 'mutalvita-cyber',
  repo: 'rearvy2.0',
  tag_name: 'v0.1.1',
  name: 'Desktop Command Center',
  body: `## What's New in v0.1.1

### 🎯 Dedicated Desktop Workspace
- New \`/desktop\` route with a complete command center UI
- Dark theme with 3-column layout: left rail (navigation), center (chat), right panel (status)
- Electron now opens directly to the desktop workspace instead of the generic dashboard

### 🔧 Features
- **Left Rail**: Quick actions (new chat, check updates, terminal), recent chats list, projects panel
- **Center Workspace**: Full ChatContainer with chat and message history
- **Docked Terminal**: Integrated TerminalPanel for command execution
- **Right Status Panels**:
  - Bridge health (runtime, bridge version, local API, terminal, Clicky status)
  - Automation state and bridge info
  - Update controls (check, download, install & restart)
  - Shell status indicators

### 🚀 Improvements
- Route-aware chat navigation: chats created in desktop stay on \`/desktop/chat/[chatId]\`
- Electron defaults: \`http://localhost:3000/desktop\` (dev) → \`https://www.rearvy.com/desktop\` (production)
- Desktop shell reuses existing bridge capabilities (no new IPC)
- Website dashboard \`/chat\` routes remain unchanged

### ✅ Verified
- \`npm run build:web\` passes with new route group
- \`npm run dev:both\` launches Electron through desktop path
- Chat routing, terminal panel, and bridge status fully functional

Built with Next.js App Router, TypeScript, and Electron IPC bridge.`,
  draft: false,
};

octokit.rest.repos.createRelease(releaseData)
  .then((response) => {
    console.log('Release created successfully!');
    console.log(response.data.html_url);
  })
  .catch((error) => {
    console.error('Error creating release:', error.message);
    process.exit(1);
  });
