import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/firebase/middleware';
import { adminDb } from '@/lib/firebase/admin';
import { COLLECTIONS } from '@/lib/firebase/schema';
import { createServerLogger } from '@/lib/server-logger';

const log = createServerLogger('RecentInsightsApi');

type InsightType = 'all' | 'anomaly' | 'trend' | 'milestone' | 'opportunity' | 'risk';
const INSIGHT_TYPES: InsightType[] = ['all', 'anomaly', 'trend', 'milestone', 'opportunity', 'risk'];

function normalizeType(value: string | null): InsightType {
  const raw = (value || 'all').toLowerCase();
  return INSIGHT_TYPES.includes(raw as InsightType) ? (raw as InsightType) : 'all';
}

function normalizeLimit(value: string | null): number {
  const parsed = Number(value || '50');
  if (!Number.isFinite(parsed)) return 50;
  return Math.max(1, Math.min(Math.floor(parsed), 100));
}

type InsightDoc = {
  id: string;
  insight_type?: string;
  is_dismissed?: boolean;
  is_read?: boolean;
  generated_at?: string;
  [key: string]: unknown;
};

function filterAndSortInsights(
  docs: InsightDoc[],
  type: InsightType,
  unreadOnly: boolean,
  limit: number
) {
  return docs
    .filter((insight) => insight.is_dismissed !== true)
    .filter((insight) => (type === 'all' ? true : insight.insight_type === type))
    .filter((insight) => (unreadOnly ? insight.is_read === false : true))
    .sort((left, right) => {
      const leftTime = left.generated_at ? new Date(left.generated_at).getTime() : 0;
      const rightTime = right.generated_at ? new Date(right.generated_at).getTime() : 0;
      return rightTime - leftTime;
    })
    .slice(0, limit);
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) {
      return auth.error;
    }

    const searchParams = request.nextUrl.searchParams;
    const type = normalizeType(searchParams.get('type'));
    const unreadOnly = searchParams.get('unreadOnly') === 'true';
    const limit = normalizeLimit(searchParams.get('limit'));

    let query: FirebaseFirestore.Query = adminDb
      .collection(COLLECTIONS.INSIGHTS)
      .where('user_id', '==', auth.user.uid)
      .where('is_dismissed', '==', false);

    if (type !== 'all') {
      query = query.where('insight_type', '==', type);
    }

    if (unreadOnly) {
      query = query.where('is_read', '==', false);
    }

    try {
      const snapshot = await query.orderBy('generated_at', 'desc').limit(limit).get();

      const insights = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      return NextResponse.json({
        ok: true,
        insights,
      });
    } catch (primaryQueryError) {
      log.warn('Primary insights query failed, using fallback:', primaryQueryError);

      const fallbackSnapshot = await adminDb
        .collection(COLLECTIONS.INSIGHTS)
        .where('user_id', '==', auth.user.uid)
        .limit(Math.max(limit * 5, 250))
        .get();

      const fallbackDocs = fallbackSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Record<string, unknown>),
      })) as InsightDoc[];

      const insights = filterAndSortInsights(fallbackDocs, type, unreadOnly, limit);

      return NextResponse.json({
        ok: true,
        insights,
        usedFallback: true,
      });
    }
  } catch (error) {
    log.error('Error loading insights via API:', error);

    return NextResponse.json(
      {
        ok: false,
        error: 'Failed to load insights',
        insights: [],
      },
      { status: 500 }
    );
  }
}
