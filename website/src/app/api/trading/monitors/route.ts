/**
 * Trading Monitors API - Create & List
 * POST /api/trading/monitors - Create new monitor
 * GET /api/trading/monitors - List monitors for chat
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/firebase/middleware';
import { adminDb } from '@/lib/firebase/admin';
import { TradingAction, TradingMonitor } from '@/types/trading';

const TRADING_MONITORS_COLLECTION = 'trading_monitors';

/**
 * POST /api/trading/monitors
 * Create a new monitor for an active trading opinion
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Require authentication
     const auth = await requireAuth(request);
     if (auth.error) {
       return auth.error;
     }
     const userId = auth.user.uid;

    // 2. Parse request body
    const body = await request.json();
    const { chatId, symbol, timeframe, entry, stopLoss, takeProfit, action, confidence, reason } = body;

    // 3. Validate required fields
    if (!chatId || !symbol || !timeframe) {
      return NextResponse.json(
        { error: 'Missing required fields: chatId, symbol, timeframe' },
        { status: 400 }
      );
    }

    const validActions: TradingAction[] = ['Buy', 'Sell', 'Hold'];
    if (!validActions.includes(action)) {
      return NextResponse.json(
        { error: 'Missing or invalid action. Must be Buy, Sell, or Hold.' },
        { status: 400 }
      );
    }

    if (action === 'Hold') {
      return NextResponse.json(
        { error: 'No valid reason to start a trade monitor: action is Hold.' },
        { status: 400 }
      );
    }

    if (typeof confidence !== 'number' || confidence <= 0 || confidence > 1) {
      return NextResponse.json(
        { error: 'Invalid confidence. Must be a number between 0 and 1 for actionable trades.' },
        { status: 400 }
      );
    }

    if (typeof reason !== 'string' || reason.trim().length < 12) {
      return NextResponse.json(
        { error: 'Missing valid reason for trade. Provide clear evidence-based reasoning.' },
        { status: 400 }
      );
    }

    // Validate timeframe
    const validTimeframes = ['M15', 'M30', 'H1', 'H4', 'D1', 'W1'];
    if (!validTimeframes.includes(timeframe)) {
      return NextResponse.json(
        { error: `Invalid timeframe. Must be one of: ${validTimeframes.join(', ')}` },
        { status: 400 }
      );
    }

    if (
      typeof entry !== 'number' ||
      typeof stopLoss !== 'number' ||
      typeof takeProfit !== 'number'
    ) {
      return NextResponse.json(
        { error: 'Actionable trades require numeric entry, stopLoss, and takeProfit levels.' },
        { status: 400 }
      );
    }

    // 4. Check per-user limit (3 active monitors max)
    const userTradingRef = adminDb.collection(`users/${userId}/${TRADING_MONITORS_COLLECTION}`);
    const activeSnapshot = await userTradingRef
      .where('isActive', '==', true)
      .get();

    if (activeSnapshot.size >= 3) {
      return NextResponse.json(
        {
          error: 'Maximum 3 active monitors allowed. Stop monitoring one trade before creating a new monitor.',
          activeCount: activeSnapshot.size,
        },
        { status: 429 }
      );
    }

    // 5. Create new monitor document
    const now = Date.now();
    const newMonitor: TradingMonitor = {
      id: '', // Will be set to doc ID
      user_id: userId,
      chat_id: chatId,
      symbol,
      timeframe,
      isActive: true,
      entry,
      stopLoss,
      takeProfit,
      lastAction: action,
      lastConfidence: confidence,
      lastUpdatedAt: now,
      nextPollAt: now + 30000, // 30s from now
      errorCount: 0,
      startedAt: now,
    };

    // 6. Add to Firestore
    const docRef = await userTradingRef.add(newMonitor);
    const monitorId = docRef.id;
    await docRef.update({ id: monitorId });

    console.info('[Trading Monitor] created', {
      userId,
      monitorId,
      chatId,
      symbol,
      timeframe,
      action,
      confidence,
      createdAt: now,
    });

    return NextResponse.json({
      monitorId,
      isActive: true,
      startedAt: now,
    });
  } catch (error) {
    console.error('Error creating monitor:', error);
    return NextResponse.json(
      { error: 'Failed to create monitor' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/trading/monitors
 * List monitors for a specific chat
 * Query params: chatId, activeOnly (optional)
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Require authentication
     const auth = await requireAuth(request);
     if (auth.error) {
       return auth.error;
     }
     const userId = auth.user.uid;

    // 2. Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const chatId = searchParams.get('chatId');
    const activeOnly = searchParams.get('activeOnly') === 'true';

    if (!chatId) {
      return NextResponse.json(
        { error: 'Missing required query parameter: chatId' },
        { status: 400 }
      );
    }

    // 3. Query monitors
    const userTradingRef = adminDb.collection(`users/${userId}/${TRADING_MONITORS_COLLECTION}`);
    let query = userTradingRef.where('chat_id', '==', chatId);

    if (activeOnly) {
      query = query.where('isActive', '==', true);
    }

    const snapshot = await query.get();
    const monitors = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({ monitors });
  } catch (error) {
    console.error('Error listing monitors:', error);
    return NextResponse.json(
      { error: 'Failed to list monitors' },
      { status: 500 }
    );
  }
}
