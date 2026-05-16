const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

function resolveAutomatonCwd() {
  const envDir = process.env.REARVY_AUTOMATON_DIR;
  const localRepoDir = path.join(__dirname, "..", "..", "automaton");
  const resourcesDir = path.join(process.resourcesPath || "", "automaton");

  // Preferred order:
  // 1. Explicit env override
  // 2. Local repository `automaton/` (development)
  // 3. Packaged app resourcesPath (production)
  const candidates = [envDir, localRepoDir, resourcesDir].filter(Boolean);

  for (const candidate of candidates) {
    // Ignore common placeholder used in some packaging environments
    if (typeof candidate === 'string' && candidate.startsWith('/var/task')) {
      continue;
    }

    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  // If nothing exists, prefer the local repo path as a sensible default for dev
  return localRepoDir;
}

/**
 * Handler for automaton-related local API calls
 */
async function automatonHandler(req, res) {
  const { chatId } = req.body;
  const userId = req.headers['x-rearvy-user-id'] || 'default-user';

  if (req.path === '/start') {
    try {
      console.log(`[Local API] Starting automaton for chat ${chatId}`);

      const automatonCwd = resolveAutomatonCwd();
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

      console.log(`[Local API] Spawning automaton from ${automatonCwd} (runner: ${absoluteRunnerPath})`);

      const child = spawn(nodeBinary, [absoluteRunnerPath], {
        cwd: automatonCwd,
        env,
        detached: true,
        stdio: 'ignore',
      });

      // If spawn succeeded, detach so it survives as background process
      try {
        if (child && typeof child.unref === 'function') child.unref();
      } catch (e) {
        // ignore unref errors
      }

      return res.json({ success: true, pid: child && child.pid ? child.pid : null });
    } catch (error) {
      console.error('[Local API] Error starting automaton:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  // Handle other automaton routes if needed
  res.status(404).json({ error: 'Not Found' });
}

module.exports = automatonHandler;
