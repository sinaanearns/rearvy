/**
 * Trading Monitors Control API - Stop/Resume Monitor
 * PATCH /api/trading/monitors/[monitorId]
 */

import { NextRequest, NextResponse } from 'next/server';
import { isRequestBodyError, readJsonRecord } from '@/lib/api/request-body';
import { requireAuth } from '@/lib/firebase/middleware';
import { adminDb } from '@/lib/firebase/admin';
import { createServerLogger } from '@/lib/server-logger';

const TRADING_MONITORS_COLLECTION = 'trading_monitors';
const log = createServerLogger('TradingMonitorRoute');

/**
 * PATCH /api/trading/monitors/[monitorId]
 * Stop (isActive: false) or resume (isActive: true) a monitor
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ monitorId: string }> }
) {
  try {
    // 1. Require authentication
    const auth = await requireAuth(request);
    if (auth.error) {
      return auth.error;
    }
    const userId = auth.user.uid;
    const { monitorId } = await params;

    // 2. Parse request body
    const body = await readJsonRecord(request);
    const { isActive } = body;

    if (typeof isActive !== 'boolean') {
      return NextResponse.json(
        { error: 'Request body must contain boolean isActive field' },
        { status: 400 }
      );
    }

    // 3. Get monitor reference
    const monitorRef = adminDb.collection(`users/${userId}/${TRADING_MONITORS_COLLECTION}`).doc(monitorId);
    const monitorDoc = await monitorRef.get();

    if (!monitorDoc.exists) {
      return NextResponse.json(
        { error: 'Monitor not found' },
        { status: 404 }
      );
    }

    // 4. Update atomically
    await monitorRef.update({
      isActive,
      lastUpdatedAt: Date.now(),
    });

    log.info('state_changed', {
      userId,
      monitorId,
      isActive,
      changedAt: Date.now(),
    });

    return NextResponse.json({
      monitorId,
      isActive,
      updated: true,
    });
  } catch (error) {
    if (isRequestBodyError(error)) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    log.error('Error updating monitor:', error);
    return NextResponse.json(
      { error: 'Failed to update monitor' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/trading/monitors/[monitorId]
 * Peek at monitor details for debugging
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ monitorId: string }> }
) {
  try {
    // 1. Require authentication
    const auth = await requireAuth(request);
    if (auth.error) {
      return auth.error;
    }
    const userId = auth.user.uid;
    const { monitorId } = await params;

    // 2. Get monitor
    const monitorRef = adminDb.collection(`users/${userId}/${TRADING_MONITORS_COLLECTION}`).doc(monitorId);
    const monitorDoc = await monitorRef.get();

    if (!monitorDoc.exists) {
      return NextResponse.json(
        { error: 'Monitor not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      monitor: {
        id: monitorDoc.id,
        ...monitorDoc.data(),
      },
    });
  } catch (error) {
    log.error('Error fetching monitor:', error);
    return NextResponse.json(
      { error: 'Failed to fetch monitor' },
      { status: 500 }
    );
  }
}
