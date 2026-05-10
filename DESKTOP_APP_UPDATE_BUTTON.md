# Rearvy Desktop App Update Button Implementation

## Overview
Added a prominent, visible update button to the Rearvy desktop application that automatically checks for updates and allows users to download and install them with a single click.

## Features Implemented

### 1. **Visible Update Checker Component** ✓
- Created `/website/src/components/layout/update-checker.tsx`
- Shows different states with appropriate UI feedback:
  - **Checking**: Loading spinner while checking for updates
  - **Update Available**: Blue download button
  - **Downloading**: Progress bar with percentage
  - **Downloaded**: Green "Install Update" button with pulse animation
  - **Error State**: Retry button with warning styling
  - **No Updates**: Gray "Check Updates" button

### 2. **Integrated into Topbar** ✓
- Update checker displays in the main navigation bar
- Visible on desktop (hidden on mobile to save space)
- Positioned before the profile dropdown for easy access
- Non-intrusive but always visible when needed

### 3. **Update Lifecycle**
The following flow is implemented:

```
User sees "Check Updates" button
         ↓
User clicks or auto-check runs
         ↓
System checks for updates (electron-updater)
         ↓
If update found:
  - Button changes to "Download Update"
  - Auto-downloads when update is available
         ↓
If downloading:
  - Shows progress with percentage
  - User can monitor download status
         ↓
If download complete:
  - Button changes to green "Install Update" with pulse
  - Ready for installation
         ↓
User clicks "Install Update"
         ↓
App restarts and installs update
```

### 4. **Backend Integration** ✓
The following were already in place and utilized:
- `electron-updater` configured in `desktop-app/package.json`
- Update state management in `desktop-app/main.cjs`
- IPC handlers for:
  - `desktop:update:get-state` - Retrieve current update state
  - `desktop:update:check` - Check for new updates
  - `desktop:update:download` - Download available updates
  - `desktop:update:install` - Install and restart
- Preload script exposing `window.electron.updater` API

### 5. **Toast Notifications** ✓
User feedback via toast messages:
- "Checking for updates..." - When check starts
- "Downloading update..." - When download begins
- Error messages if something fails

## Component API

The `UpdateChecker` component exports a single component with no required props:

```tsx
import { UpdateChecker } from "@/components/layout/update-checker";

// Usage in topbar
<UpdateChecker />
```

## Configuration

### Update Check Interval
- Auto-checks every 6 hours (defined in `desktop-app/main.cjs`)
- `UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000`

### Update Source
Updates are fetched from the public downloads folder:
- `public/downloads/latest.json` - Contains version metadata
- `public/downloads/Rearvy-win-x64.exe` - The installer
- `public/downloads/Rearvy-win-x64.exe.blockmap` - Delta update file

### Auto-Download
- When an update is detected, it automatically downloads
- User is notified via button state change
- Download happens in the background

### Auto-Install
- When download completes, a dialog appears asking to restart
- User can click "Install Update and Restart" or defer
- Changes are applied on next app start if user chooses "Later"

## Files Modified

1. **website/src/components/layout/update-checker.tsx** (NEW)
   - Complete update checker component
   - Handles all update states and user interactions

2. **website/src/components/layout/topbar.tsx**
   - Added import for `UpdateChecker` component
   - Added `<UpdateChecker />` to topbar UI
   - Hidden on mobile, visible on desktop

## States and UI

| State | Button | Action | Auto? |
|-------|--------|--------|-------|
| Supported | Check Updates | Check for updates | Manual |
| Checking | Checking... (spinner) | Wait | Auto |
| Update Available | Download Update | Download available | Manual |
| Downloading | Downloading (% progress) | Monitor | Auto |
| Downloaded | Install Update (green pulse) | Install & Restart | Manual |
| Error | Retry | Retry check | Manual |
| No Updates | Check Updates | Nothing new | - |

## How Users Interact

1. **Automatic Check**
   - App automatically checks every 6 hours in background
   - If update found, button changes color automatically

2. **Manual Check**
   - Click "Check Updates" button anytime
   - Checks immediately

3. **Download**
   - When available, click "Download Update"
   - Downloads automatically in background
   - Shows progress percentage

4. **Install**
   - When download complete, green "Install Update" button appears
   - Click to install and restart
   - Or defer with "Later" button in dialog

## Testing

To test locally:

```bash
# Build website
npm run build:web

# Start development
npm run dev:desktop

# Or build desktop app and create release
cd desktop-app
npm run build:win

# The app will check for updates and show the UI
```

## Version Information

The update checker also displays version information in the profile dropdown:
- Current version (e.g., "0.1.0")
- Available version (e.g., "0.1.0 -> 0.2.0") when new version detected

## Error Handling

- Network errors: "Update check failed" toast + Retry button
- Download errors: "Update download failed" toast + option to retry
- Installation errors: "Update installation failed" toast
- All errors logged to console for debugging

## Benefits

✅ Users always see latest app version
✅ Automatic background checks reduce manual effort
✅ Clear visual feedback for all states
✅ One-click install when updates ready
✅ Non-intrusive but always accessible
✅ Progress monitoring during download
✅ Error recovery with retry options
