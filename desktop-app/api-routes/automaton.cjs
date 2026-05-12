const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

/**
 * Handler for automaton-related local API calls
 */
async function automatonHandler(req, res) {
  const { chatId } = req.body;
  const userId = req.headers['x-rearvy-user-id'] || 'default-user';

  if (req.path === '/start') {
    try {
      console.log(`[Local API] Starting automaton for chat ${chatId}`);

      // The project root is two levels up from this file (desktop-app/api-routes/automaton.cjs)
      // or we can use a more reliable way if we know the app structure
      const projectRoot = path.join(__dirname, "..", "..");
      const automatonCwd = path.join(projectRoot, "automaton");
      const runnerPath = path.join("scripts", "rearvy-runner.js");

      if (!fs.existsSync(automatonCwd)) {
        console.error(`[Local API] Automaton directory not found: ${automatonCwd}`);
        return res.status(500).json({ error: `Automaton directory not found at ${automatonCwd}` });
      }

      const absoluteRunnerPath = path.join(automatonCwd, runnerPath);
      if (!fs.existsSync(absoluteRunnerPath)) {
        console.error(`[Local API] Runner script not found: ${absoluteRunnerPath}`);
        return res.status(500).json({ error: `Runner script not found at ${absoluteRunnerPath}` });
      }

      const env = {
        ...process.env,
        REARVY_USER_ID: userId,
        REARVY_CHAT_ID: chatId,
        REARVY_API_URL: `http://localhost:${process.env.REARVY_LOCAL_API_PORT || 4000}`,
      };

      const nodeBinary = process.execPath;
      
      console.log(`[Local API] Spawning automaton from ${automatonCwd}`);
      
      let child;
      if (process.platform === 'win32') {
        // Use 'start' to open a new terminal window
        const spawnArgs = ['/c', 'start', 'Rearvy Automaton', nodeBinary, runnerPath];
        child = spawn('cmd.exe', spawnArgs, {
          cwd: automatonCwd,
          env,
          detached: true,
          stdio: 'ignore',
        });
      } else {
        // Fallback for other platforms
        child = spawn(nodeBinary, [runnerPath], {
          cwd: automatonCwd,
          env,
          detached: true,
          stdio: 'ignore',
        });
      }

      child.unref();

      return res.json({ success: true, pid: child.pid });
    } catch (error) {
      console.error('[Local API] Error starting automaton:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  // Handle other automaton routes if needed
  res.status(404).json({ error: 'Not Found' });
}

module.exports = automatonHandler;
