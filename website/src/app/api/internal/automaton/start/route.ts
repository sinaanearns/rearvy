import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase/admin';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

function resolveAutomatonCwd(): string | null {
  const runnerPath = path.join('scripts', 'rearvy-runner.js');
  const resourcesPath = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath;
  const envDirs = [
    process.env.REARVY_AUTOMATON_DIR,
    process.env.REARVY_AUTOMATION_DIR,
  ];
  const localCandidates = [
    path.join(process.cwd(), 'automaton'),
    path.join(process.cwd(), '..', 'automaton'),
  ];
  const packagedCandidates = [
    resourcesPath ? path.join(resourcesPath, 'automaton') : null,
    path.join(path.dirname(process.execPath), 'resources', 'automaton'),
  ];

  // Preferred order:
  // 1. Explicit env override
  // 2. Local repository `automaton/` (development)
  // 3. Packaged app resourcesPath (production)
  const seen = new Set<string>();
  const candidates = [...envDirs, ...localCandidates, ...packagedCandidates]
    .filter(Boolean)
    .map((candidate) => path.resolve(candidate as string))
    .filter((candidate) => {
      const key = process.platform === 'win32' ? candidate.toLowerCase() : candidate;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });

  for (const candidate of candidates) {
    // Ignore common placeholder used in some packaging environments
    if (typeof candidate === 'string' && candidate.startsWith('/var/task')) {
      continue;
    }

    if (fs.existsSync(candidate) && fs.existsSync(path.join(candidate, runnerPath))) {
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
            'Automaton is not available in this deployment. See AUTO-START-AUTOMATON.md in the project root for troubleshooting or set REARVY_AUTOMATON_DIR to a valid path.',
          helpDoc: 'AUTO-START-AUTOMATON.md',
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
    
    const child = spawn(nodeBinary, [absoluteRunnerPath], {
      cwd,
      env: {
        ...env,
        ELECTRON_RUN_AS_NODE: '1',
      },
      detached: true,
      stdio: 'ignore',
      windowsHide: process.platform === 'win32',
    });

    child.unref(); // Allow the parent (Next.js) to exit independently of the child
    return NextResponse.json({ success: true, pid: child.pid });
  } catch (error) {
    console.error('[Automaton Start API] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
