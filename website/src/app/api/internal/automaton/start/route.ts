import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase/admin';
import { spawn } from 'child_process';
import path from 'path';

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
    const cwd = path.join(process.cwd(), '..', 'automaton');
    const runnerPath = path.join('scripts', 'rearvy-runner.js');

    const env = {
      ...process.env,
      REARVY_USER_ID: userId,
      REARVY_CHAT_ID: chatId,
    };

    // For production (packaged app), use conhost.exe which is more reliable
    // For development, use node directly with detached process
    const isProduction = !process.env.NEXT_PUBLIC_DEV_MODE;
    
    let child;
    if (isProduction) {
      // In production, use conhost.exe to open a terminal window
      try {
        child = spawn('conhost.exe', ['node', runnerPath], {
          cwd,
          env,
          detached: true,
          stdio: 'ignore',
          windowsHide: false,
        });
      } catch (e) {
        // Fallback to direct spawn if conhost fails
        console.warn('[Automaton] conhost.exe failed, using direct spawn:', e);
        child = spawn('node', [runnerPath], {
          cwd,
          env,
          detached: true,
          stdio: 'ignore',
        });
      }
    } else {
      // In development, use cmd.exe with explicit terminal
      child = spawn('cmd.exe', ['/c', 'start', 'cmd.exe', '/k', 'node', runnerPath], {
        cwd,
        env,
        detached: true,
        stdio: 'ignore',
      });
    }

    child.unref(); // Allow the parent (Next.js) to exit independently of the child

    return NextResponse.json({ success: true, pid: child.pid });
  } catch (error) {
    console.error('[Automaton Start API] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
