import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase/admin';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

function resolveAutomatonCwd(): string | null {
  const envDir = process.env.REARVY_AUTOMATON_DIR;
  const localRepoDir = path.join(process.cwd(), '..', 'automaton');
  const resourcesPath = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath;
  const resourcesDir = resourcesPath ? path.join(resourcesPath, 'automaton') : undefined;

  // Preferred order:
  // 1. Explicit env override
  // 2. Local repository `automaton/` (development)
  // 3. Packaged app resourcesPath (production)
  const candidates = [envDir, localRepoDir, resourcesDir].filter(Boolean) as string[];

  for (const candidate of candidates) {
    // Ignore common placeholder used in some packaging environments
    if (typeof candidate === 'string' && candidate.startsWith('/var/task')) {
      continue;
    }

    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(token);
    } catch (e) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    const userId = decodedToken.uid;

    const body = await request.json();
    const { chatId } = body;

    if (!chatId) {
      return NextResponse.json({ error: 'Missing chatId' }, { status: 400 });
    }

    // Spawn the automaton background process
    const cwd = resolveAutomatonCwd();
    const runnerPath = path.join('scripts', 'rearvy-runner.js');

    if (!cwd) {
      return NextResponse.json(
        {
          error:
            'Automaton is not available in this deployment. Use the desktop app, or set REARVY_AUTOMATON_DIR to a valid path.',
        },
        { status: 501 }
      );
    }

    const env = {
      ...process.env,
      REARVY_USER_ID: userId,
      REARVY_CHAT_ID: chatId,
    };

    const nodeBinary = process.execPath;

    // Validate paths before spawning
    if (!fs.existsSync(cwd)) {
      console.error(`[Automaton] Directory not found: ${cwd}`);
      return NextResponse.json({ error: `Automaton directory not found at ${cwd}` }, { status: 500 });
    }

    const absoluteRunnerPath = path.join(cwd, runnerPath);
    if (!fs.existsSync(absoluteRunnerPath)) {
      console.error(`[Automaton] Runner script not found: ${absoluteRunnerPath}`);
      return NextResponse.json({ error: `Runner script not found at ${absoluteRunnerPath}` }, { status: 500 });
    }

    console.log(`[Automaton] Starting from ${cwd}, runner: ${runnerPath}, node: ${nodeBinary}`);
    
    let child;
    if (process.platform === 'win32') {
      // cmd.exe start syntax on Windows is: start "" <command> <arg1> ...
      // Use an empty title and absolute paths to prevent cmd from mis-parsing.
      const spawnArgs = ['/c', 'start', '""', nodeBinary, absoluteRunnerPath];
      
      try {
        child = spawn('cmd.exe', spawnArgs, {
          cwd,
          env,
          detached: true,
          stdio: 'ignore',
        });
      } catch (e) {
        console.error('[Automaton] Failed to spawn via cmd.exe:', e);
        // Fallback to direct spawn
        child = spawn(nodeBinary, [absoluteRunnerPath], {
          cwd,
          env,
          detached: true,
          stdio: 'ignore',
        });
      }
    } else {
      // Non-Windows fallback
      child = spawn(nodeBinary, [absoluteRunnerPath], {
        cwd,
        env,
        detached: true,
        stdio: 'ignore',
      });
    }

    if (child) {
      child.unref(); // Allow the parent (Next.js) to exit independently of the child
      return NextResponse.json({ success: true, pid: child.pid });
    } else {
      return NextResponse.json({ error: 'Failed to spawn child process' }, { status: 500 });
    }
  } catch (error) {
    console.error('[Automaton Start API] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
