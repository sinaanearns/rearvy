/**
 * Internal Trading Monitor Runner Endpoint
 * POST /api/internal/trading/monitor-jobs/run
 *
 * Protected by X-Internal-Token header (must match INTERNAL_API_SECRET env var)
 * Called by Cloud Scheduler / Cloud Functions on schedule (every 1 minute)
 * Processes all active monitors due for polling
 */

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { adminDb } from '@/lib/firebase/admin';
import { runMonitorCycle } from '@/lib/trading/monitor-jobs';

/**
 * Validate internal API token
 */
function validateInternalToken(request: NextRequest): boolean {
  const token = request.headers.get('x-internal-token');
  const expectedToken = process.env.INTERNAL_API_SECRET;

  if (!expectedToken) {
    console.error('INTERNAL_API_SECRET not configured');
    return false;
  }

  if (!token) {
    console.warn('Missing x-internal-token header');
    return false;
  }

  // Constant-time comparison to prevent timing attacks
  const providedBuffer = Buffer.from(token);
  const expectedBuffer = Buffer.from(expectedToken);

  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(providedBuffer, expectedBuffer);
}

/**
 * POST /api/internal/trading/monitor-jobs/run
 * Main entry point for monitor polling cycle
 *
 * This endpoint validates the internal token and can trigger monitor processing.
 * For production deployment, use Google Cloud Functions directly.
 *
 * Response:
 * {
 *   status: "ok" | "processing",
 *   timestamp: number,
 *   message: string
 * }
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // 1. Validate internal token
    if (!validateInternalToken(request)) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid or missing x-internal-token' },
        { status: 401 }
      );
    }

    // 2. Log successful trigger
    console.log(`[Monitor Runner] Polling cycle triggered at ${new Date(startTime).toISOString()}`);

    // 3. Execute monitor polling cycle
    const cycleResult = await runMonitorCycle(adminDb);
    const durationMs = Date.now() - startTime;

    return NextResponse.json(
      {
        status: 'ok',
        timestamp: Date.now(),
        durationMs,
        result: cycleResult,
      },
      { status: 200 }
    );
  } catch (error) {
    const duration = Date.now() - startTime;

    console.error('[Monitor Runner] Error during cycle:', error);

    return NextResponse.json(
      {
        error: 'Monitor runner cycle failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        duration,
        timestamp: Date.now(),
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/internal/trading/monitor-jobs/run
 * Health check endpoint
 * Useful for monitoring / uptime checks
 */
export async function GET(request: NextRequest) {
  // Quick health check - verify internal token but don't process jobs
    // Validate internal token
    if (!validateInternalToken(request)) {
    return NextResponse.json(
      { error: 'Unauthorized: Invalid or missing x-internal-token' },
      { status: 401 }
    );
  }

  return NextResponse.json(
    {
      status: 'ok',
      timestamp: Date.now(),
      message: 'Internal monitor runner endpoint is operational',
    },
    { status: 200 }
  );
}

