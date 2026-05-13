const { spawn, exec } = require('child_process');
const path = require('path');
const os = require('os');

// Allowed base commands
const ALLOWED_COMMANDS = new Set([
  'npm', 'npx', 'node', 'git', 'python', 'py', 'pip'
]);

// Prevent command injection operators
const DANGEROUS_CHARS = /[&|;<>\\]/;

const activeProcesses = new Map();

function validateCommand(cmdStr) {
  if (!cmdStr) return { valid: false, error: 'Command is empty' };
  
  const args = cmdStr.trim().split(/\s+/);
  const baseCmd = args[0].toLowerCase();
  
  if (!ALLOWED_COMMANDS.has(baseCmd)) {
    return { valid: false, error: `Command not allowed. Allowed commands: ${Array.from(ALLOWED_COMMANDS).join(', ')}` };
  }
  
  for (const arg of args) {
    if (DANGEROUS_CHARS.test(arg)) {
      return { valid: false, error: `Dangerous character detected in arguments.` };
    }
  }
  
  return { valid: true, baseCmd, args };
}

function setupTerminalIPC(ipcMain, mainWindow) {
  console.log('[TerminalService] Setting up terminal IPC handlers');

  ipcMain.handle('desktop:terminal:run', async (event, options) => {
    try {
      const { command, cwd = process.cwd() } = options;
      
      const validation = validateCommand(command);
      if (!validation.valid) {
        throw new Error(validation.error);
      }
      
      const processId = `pid_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      console.log(`[TerminalService] Starting process ${processId}: ${command}`);
      
      mainWindow.webContents.send('desktop:terminal:status', {
        id: processId,
        status: 'starting'
      });
      
      // Spawn in PowerShell on Windows
      const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], {
        cwd,
        env: { ...process.env, FORCE_COLOR: '1' }
      });
      
      activeProcesses.set(processId, child);
      
      mainWindow.webContents.send('desktop:terminal:status', {
        id: processId,
        status: 'running'
      });
      
      child.stdout.on('data', (data) => {
        if (!mainWindow.isDestroyed()) {
          mainWindow.webContents.send('desktop:terminal:output', {
            id: processId,
            type: 'stdout',
            data: data.toString()
          });
        }
      });
      
      child.stderr.on('data', (data) => {
        if (!mainWindow.isDestroyed()) {
          mainWindow.webContents.send('desktop:terminal:output', {
            id: processId,
            type: 'stderr',
            data: data.toString()
          });
        }
      });
      
      child.on('close', (code) => {
        activeProcesses.delete(processId);
        if (!mainWindow.isDestroyed()) {
          mainWindow.webContents.send('desktop:terminal:status', {
            id: processId,
            status: 'stopped',
            code
          });
        }
      });
      
      child.on('error', (error) => {
        activeProcesses.delete(processId);
        if (!mainWindow.isDestroyed()) {
          mainWindow.webContents.send('desktop:terminal:output', {
            id: processId,
            type: 'error',
            data: error.message
          });
          mainWindow.webContents.send('desktop:terminal:status', {
            id: processId,
            status: 'error',
            code: -1
          });
        }
      });
      
      // Timeout protection (e.g. 10 minutes)
      setTimeout(() => {
        if (activeProcesses.has(processId)) {
          console.log(`[TerminalService] Timeout reached for ${processId}, killing...`);
          try {
            process.kill(child.pid, 'SIGTERM');
          } catch (e) {
            console.error('Failed to kill timed out process:', e);
          }
        }
      }, 10 * 60 * 1000);
      
      return { success: true, processId };
    } catch (error) {
      console.error('[TerminalService] Error starting command:', error);
      return { success: false, error: error.message };
    }
  });
  
  ipcMain.handle('desktop:terminal:stop', async (event, processId) => {
    try {
      const child = activeProcesses.get(processId);
      if (child) {
        console.log(`[TerminalService] Stopping process ${processId}`);
        // Windows tree-kill equivalent or direct kill
        if (os.platform() === 'win32') {
          exec(`taskkill /pid ${child.pid} /T /F`, (err) => {
             if (err) {
               console.error(`Error killing process tree: ${err}`);
               // Fallback to standard kill
               try { child.kill('SIGKILL'); } catch (e) {}
             }
          });
        } else {
           child.kill('SIGKILL');
        }
        return { success: true };
      }
      return { success: false, error: 'Process not found or already stopped' };
    } catch (error) {
      console.error('[TerminalService] Error stopping command:', error);
      return { success: false, error: error.message };
    }
  });
  
  ipcMain.handle('desktop:terminal:open-external', async (event, targetPath) => {
    try {
      const dirPath = targetPath || process.cwd();
      console.log(`[TerminalService] Opening external terminal at ${dirPath}`);
      
      if (os.platform() === 'win32') {
        spawn('cmd.exe', ['/c', 'start', 'powershell.exe', '-NoExit', '-Command', `cd '${dirPath}'`], {
          detached: true,
          stdio: 'ignore'
        }).unref();
      } else if (os.platform() === 'darwin') {
        spawn('open', ['-a', 'Terminal', dirPath], {
          detached: true,
          stdio: 'ignore'
        }).unref();
      } else {
        // basic linux fallback
        spawn('x-terminal-emulator', ['--working-directory', dirPath], {
          detached: true,
          stdio: 'ignore'
        }).unref();
      }
      
      return { success: true };
    } catch (error) {
      console.error('[TerminalService] Error opening external terminal:', error);
      return { success: false, error: error.message };
    }
  });

  // Cleanup on app exit
  const { app } = require('electron');
  app.on('before-quit', () => {
    for (const [id, child] of activeProcesses.entries()) {
      try {
        if (os.platform() === 'win32') {
          exec(`taskkill /pid ${child.pid} /T /F`);
        } else {
          child.kill('SIGKILL');
        }
      } catch (e) {
        console.error(`Failed to cleanup process ${id}:`, e);
      }
    }
    activeProcesses.clear();
  });
}

module.exports = {
  setupTerminalIPC
};
