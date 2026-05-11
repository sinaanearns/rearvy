import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, chatId, log } = body;

    if (!userId || !chatId || !log) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    // Only log significant events to chat to avoid spam
    if (log.level !== 'info' && log.level !== 'warn' && log.level !== 'error') {
      return NextResponse.json({ success: true, skipped: true });
    }

    const text = `🤖 **Automaton Update**: ${log.message}`;

    await adminDb
      .collection('users')
      .doc(userId)
      .collection('chats')
      .doc(chatId)
      .collection('messages')
      .add({
        role: 'assistant',
        parts: [
          {
            type: 'text',
            text: text,
          }
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Automaton API] Error processing log:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
