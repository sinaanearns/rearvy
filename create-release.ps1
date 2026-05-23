$token = $env:GITHUB_TOKEN
if (-not $token) {
    Write-Error "GITHUB_TOKEN environment variable not set"
    exit 1
}

$owner = "mutalvita-cyber"
$repo = "rearvy-desktop-releases"
$tagName = "v0.1.1"
$releaseName = "Desktop Command Center"
$releaseBody = @"
## What's New in v0.1.1

### 🎯 Dedicated Desktop Workspace
- New `/desktop` route with a complete command center UI
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
- Route-aware chat navigation: chats created in desktop stay on `/desktop/chat/[chatId]`
- Electron defaults: `http://localhost:3000/desktop` (dev) → `https://www.rearvy.com/desktop` (production)
- Desktop shell reuses existing bridge capabilities (no new IPC)
- Website dashboard `/chat` routes remain unchanged

### ✅ Verified
- `npm run build:web` passes with new route group
- `npm run dev:both` launches Electron through desktop path
- Chat routing, terminal panel, and bridge status fully functional

Built with Next.js App Router, TypeScript, and Electron IPC bridge.
"@

$body = @{
    tag_name = $tagName
    name = $releaseName
    body = $releaseBody
    draft = $false
} | ConvertTo-Json

$headers = @{
    "Authorization" = "token $token"
    "Accept" = "application/vnd.github+json"
    "Content-Type" = "application/json"
}

$uri = "https://api.github.com/repos/$owner/$repo/releases"

try {
    $response = Invoke-RestMethod -Uri $uri -Method Post -Headers $headers -Body $body
    Write-Output $response.html_url
}
catch {
    Write-Error "Error creating release: $_"
    exit 1
}
