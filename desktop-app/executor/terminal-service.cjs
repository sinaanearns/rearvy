const { spawn, exec } = require('child_process');
const path = require('path');
const os = require('os');
const { createLogger } = require('../lib/logger.cjs');

const activeProcesses = new Map();
const log = createLogger('TerminalService');

function ignoreExpectedTerminalFallbackError(error) {
  void error;
}

function getDefaultTerminalCwd() {
  try {
    const { app } = require('electron');
    return app.isPackaged ? os.homedir() : process.cwd();
  } catch (error) {
    ignoreExpectedTerminalFallbackError(error);
    return process.cwd();
  }
}

function setupTerminalIPC(ipcMain, mainWindow) {
  log.debug('Setting up terminal IPC handlers');

  ipcMain.handle('desktop:terminal:run', async (event, options) => {
    try {
      const { command, cwd = getDefaultTerminalCwd() } = options;
      
      const processId = `pid_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      log.info(`Starting process ${processId}: ${command}`);
      
      event.sender.send('desktop:terminal:status', {
        id: processId,
        status: 'starting'
      });
      
      // Spawn in PowerShell on Windows
      const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], {
        cwd,
        env: { ...process.env, FORCE_COLOR: '1' }
      });
      
      activeProcesses.set(processId, child);
      
      event.sender.send('desktop:terminal:status', {
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
        if (!event.sender.isDestroyed()) {
          event.sender.send('desktop:terminal:output', {
            id: processId,
            type: 'stderr',
            data: data.toString()
          });
        }
      });
      
      child.on('close', (code) => {
        activeProcesses.delete(processId);
        if (!event.sender.isDestroyed()) {
          event.sender.send('desktop:terminal:status', {
            id: processId,
            status: 'stopped',
            code
          });
        }
      });
      
      child.on('error', (error) => {
        activeProcesses.delete(processId);
        if (!event.sender.isDestroyed()) {
          event.sender.send('desktop:terminal:output', {
            id: processId,
            type: 'error',
            data: error.message
          });
          event.sender.send('desktop:terminal:status', {
            id: processId,
            status: 'error',
            code: -1
          });
        }
      });
      
      // Timeout protection (e.g. 10 minutes)
      setTimeout(() => {
        if (activeProcesses.has(processId)) {
          log.warn(`Timeout reached for ${processId}, killing...`);
          try {
            process.kill(child.pid, 'SIGTERM');
          } catch (e) {
            log.error('Failed to kill timed out process:', e);
          }
        }
      }, 10 * 60 * 1000);
      
      return { success: true, processId };
    } catch (error) {
      log.error('Error starting command:', error);
      return { success: false, error: error.message };
    }
  });
  
  ipcMain.handle('desktop:terminal:stop', async (event, processId) => {
    try {
      const child = activeProcesses.get(processId);
      if (child) {
        log.info(`Stopping process ${processId}`);
        // Windows tree-kill equivalent or direct kill
        if (os.platform() === 'win32') {
          exec(`taskkill /pid ${child.pid} /T /F`, (err) => {
             if (err) {
               log.error(`Error killing process tree: ${err}`);
               // Fallback to standard kill
               try {
                 child.kill('SIGKILL');
               } catch (error) {
                 ignoreExpectedTerminalFallbackError(error);
               }
             }
          });
        } else {
           child.kill('SIGKILL');
        }
        return { success: true };
      }
      return { success: false, error: 'Process not found or already stopped' };
    } catch (error) {
      log.error('Error stopping command:', error);
      return { success: false, error: error.message };
    }
  });
  
  ipcMain.handle('desktop:terminal:open-external', async (event, targetPath) => {
    try {
      const dirPath =
        typeof targetPath === 'string' && targetPath.trim()
          ? path.resolve(targetPath)
          : getDefaultTerminalCwd();
      log.info(`Opening external terminal at ${dirPath}`);
      
      if (os.platform() === 'win32') {
        spawn('powershell.exe', ['-NoExit'], {
          cwd: dirPath,
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
      log.error('Error opening external terminal:', error);
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
      } catch (error) {
        log.error(`Failed to cleanup process ${id}:`, error);
      }
    }
    activeProcesses.clear();
  });
}

module.exports = {
  setupTerminalIPC
};
