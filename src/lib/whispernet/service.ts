import { createHash } from "node:crypto";
import type { Firestore } from "firebase-admin/firestore";
import { COLLECTIONS } from "@/lib/firebase/schema";
import type {
  Integration,
  Order,
  Product,
  WhisperNetAlert,
  WhisperNetContentItem,
  WhisperNetForecast,
  WhisperNetMention,
  WhisperNetProcessingJob,
  WhisperNetWatcher,
} from "@/types/database";
import {
  computeWhisperNetForecast,
  detectMentionInContent,
  getAlertSeverityFromRisk,
  type WhisperNetContentInput,
  type WhisperNetSalesSignals,
} from "./core";

type TimestampLike = {
  toDate?: () => Date;
};

type WriteOperation = {
  collectionName: string;
  docId: string;
  data: Record<string, unknown>;
  merge?: boolean;
};

export type WhisperNetAvailableProduct = Pick<
  Product,
  "id" | "title" | "price" | "inventory_quantity" | "handle" | "status"
>;

export type WhisperNetDashboardMention = WhisperNetMention & {
  product_title: string;
  detection_label: string;
  source_title: string | null;
  source_url: string | null;
  creator_name: string | null;
  forecast: WhisperNetForecast | null;
};

export type WhisperNetDashboardAlert = WhisperNetAlert & {
  product_title: string;
  source_title: string | null;
};

export type WhisperNetSummary = {
  watchers: WhisperNetWatcher[];
  availableProducts: WhisperNetAvailableProduct[];
  mentions: WhisperNetDashboardMention[];
  alerts: WhisperNetDashboardAlert[];
  stats: {
    watchedProducts: number;
    activeWatchers: number;
    monitoredContent: number;
    mentionsLast48h: number;
    projectedRevenue48h: number;
    criticalAlerts: number;
  };
  integrations: {
    shopifyConnected: boolean;
    youtubeConnected: boolean;
    instagramConnected: boolean;
  };
  transcriptCoverage: {
    available: number;
    pending: number;
    unavailable: number;
  };
  lastRunAt: string | null;
};

export type WhisperNetRunResult = {
  jobId: string;
  stats: {
    watchedProducts: number;
    contentProcessed: number;
    mentionsDetected: number;
    alertsOpen: number;
    projectedRevenue48h: number;
    trigger: "manual" | "sync" | "internal";
    skippedReason?: string;
  };
  finishedAt: string;
};

type SourceCreatorMaps = {
  youtubeChannels: Map<string, string>;
  instagramAccounts: Map<string, string>;
};

function toIsoString(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object" && value !== null && "toDate" in value) {
    const candidate = (value as TimestampLike).toDate;
    if (typeof candidate === "function") {
      return candidate().toISOString();
    }
  }
  return null;
}

function toNumber(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function nowIso() {
  return new Date().toISOString();
}

function stableWhisperId(prefix: string, ...parts: Array<string | null | undefined>) {
  const hash = createHash("sha1")
    .update(parts.filter(Boolean).join("|"))
    .digest("hex")
    .slice(0, 24);
  return `${prefix}_${hash}`;
}

async function commitWriteOperations(db: Firestore, writes: WriteOperation[]) {
  const batchSize = 400;

  for (let index = 0; index < writes.length; index += batchSize) {
    const batch = db.batch();
    const chunk = writes.slice(index, index + batchSize);

    for (const write of chunk) {
      const ref = db.collection(write.collectionName).doc(write.docId);
      batch.set(ref, write.data, { merge: write.merge ?? true });
    }

    await batch.commit();
  }
}

async function getWatchersForUser(db: Firestore, userId: string) {
  const snapshot = await db
    .collection(COLLECTIONS.WHISPERNET_WATCHERS)
    .where("user_id", "==", userId)
    .get();

  return snapshot.docs
    .map(
      (doc) =>
        ({
          id: doc.id,
          ...doc.data(),
          last_scanned_at: toIsoString(doc.data().last_scanned_at),
          last_match_at: toIsoString(doc.data().last_match_at),
          created_at: toIsoString(doc.data().created_at) || nowIso(),
          updated_at: toIsoString(doc.data().updated_at) || nowIso(),
        }) as WhisperNetWatcher
    )
    .sort((left, right) => left.product_title.localeCompare(right.product_title));
}

async function getProductsForUser(db: Firestore, userId: string) {
  const snapshot = await db
    .collection(COLLECTIONS.PRODUCTS)
    .where("user_id", "==", userId)
    .get();

  return snapshot.docs.map(
    (doc) =>
      ({
        id: doc.id,
        ...doc.data(),
        synced_at: toIsoString(doc.data().synced_at),
        created_at: toIsoString(doc.data().created_at) || nowIso(),
        updated_at: toIsoString(doc.data().updated_at) || nowIso(),
      }) as Product
  );
}

async function getOrdersForUser(db: Firestore, userId: string) {
  const snapshot = await db
    .collection(COLLECTIONS.ORDERS)
    .where("user_id", "==", userId)
    .get();

  return snapshot.docs.map(
    (doc) =>
      ({
        id: doc.id,
        ...doc.data(),
        placed_at: toIsoString(doc.data().placed_at) || "",
        created_at: toIsoString(doc.data().created_at) || nowIso(),
      }) as Order
  );
}

async function getCreatorMapsForUser(db: Firestore, userId: string): Promise<SourceCreatorMaps> {
  const [youtubeChannelsSnapshot, instagramAccountsSnapshot] = await Promise.all([
    db.collection(COLLECTIONS.YOUTUBE_CHANNELS).where("user_id", "==", userId).get(),
    db.collection(COLLECTIONS.INSTAGRAM_ACCOUNTS).where("user_id", "==", userId).get(),
  ]);

  return {
    youtubeChannels: new Map(
      youtubeChannelsSnapshot.docs.map((doc) => [
        String(doc.data().channel_id || ""),
        String(doc.data().title || "YouTube creator"),
      ])
    ),
    instagramAccounts: new Map(
      instagramAccountsSnapshot.docs.map((doc) => [
        String(doc.data().integration_id || ""),
        String(doc.data().username || doc.data().name || "Instagram creator"),
      ])
    ),
  };
}

async function getRecentSourceContentForUser(
  db: Firestore,
  userId: string
): Promise<WhisperNetContentInput[]> {
  const [videosSnapshot, postsSnapshot, creatorMaps] = await Promise.all([
    db.collection(COLLECTIONS.YOUTUBE_VIDEOS).where("user_id", "==", userId).get(),
    db.collection(COLLECTIONS.INSTAGRAM_POSTS).where("user_id", "==", userId).get(),
    getCreatorMapsForUser(db, userId),
  ]);

  const recentCutoff = Date.now() - 45 * 24 * 60 * 60 * 1000;

  const videos = videosSnapshot.docs
    .map((doc) => {
      const data = doc.data();
      const publishedAt = toIsoString(data.published_at);
      const sourceId = String(data.video_id || doc.id);
      return {
        contentItemId: stableWhisperId("wnc", "youtube", sourceId),
        platform: "youtube" as const,
        sourceId,
        sourceUrl: `https://www.youtube.com/watch?v=${sourceId}`,
        creatorName: creatorMaps.youtubeChannels.get(String(data.channel_id || "")) || null,
        publishedAt,
        title: typeof data.title === "string" ? data.title : null,
        description: typeof data.description === "string" ? data.description : null,
        transcriptText: null,
        transcriptStatus: "unavailable" as const,
        metrics: {
          views: toNumber(data.view_count),
          likes: toNumber(data.like_count),
          comments: toNumber(data.comment_count),
        },
      };
    })
    .filter((item) => {
      if (!item.publishedAt) return true;
      return new Date(item.publishedAt).getTime() >= recentCutoff;
    })
    .sort((left, right) => {
      const leftTime = left.publishedAt ? new Date(left.publishedAt).getTime() : 0;
      const rightTime = right.publishedAt ? new Date(right.publishedAt).getTime() : 0;
      return rightTime - leftTime;
    })
    .slice(0, 120);

  const posts = postsSnapshot.docs
    .map((doc) => {
      const data = doc.data();
      const publishedAt = toIsoString(data.published_at);
      const sourceId = String(data.post_id || doc.id);
      return {
        contentItemId: stableWhisperId("wnc", "instagram", sourceId),
        platform: "instagram" as const,
        sourceId,
        sourceUrl:
          typeof data.permalink === "string" && data.permalink.trim()
            ? data.permalink
            : null,
        creatorName:
          creatorMaps.instagramAccounts.get(String(data.integration_id || "")) || null,
        publishedAt,
        caption: typeof data.caption === "string" ? data.caption : null,
        transcriptText: null,
        transcriptStatus: "unavailable" as const,
        metrics: {
          reach: toNumber(data.reach),
          impressions: toNumber(data.impressions),
          likes: toNumber(data.like_count),
          comments: toNumber(data.comments_count),
        },
      };
    })
    .filter((item) => {
      if (!item.publishedAt) return true;
      return new Date(item.publishedAt).getTime() >= recentCutoff;
    })
    .sort((left, right) => {
      const leftTime = left.publishedAt ? new Date(left.publishedAt).getTime() : 0;
      const rightTime = right.publishedAt ? new Date(right.publishedAt).getTime() : 0;
      return rightTime - leftTime;
    })
    .slice(0, 120);

  return [...videos, ...posts].sort((left, right) => {
    const leftTime = left.publishedAt ? new Date(left.publishedAt).getTime() : 0;
    const rightTime = right.publishedAt ? new Date(right.publishedAt).getTime() : 0;
    return rightTime - leftTime;
  });
}

function buildContentItemWrite(
  userId: string,
  item: WhisperNetContentInput
): WriteOperation {
  const timestamp = nowIso();
  return {
    collectionName: COLLECTIONS.WHISPERNET_CONTENT_ITEMS,
    docId: item.contentItemId,
    data: {
      id: item.contentItemId,
      user_id: userId,
      integration_id: null,
      platform: item.platform,
      content_type: item.platform === "youtube" ? "video" : "post",
      source_id: item.sourceId,
      creator_name: item.creatorName,
      title: item.title || null,
      description: item.description || null,
      caption: item.caption || null,
      permalink: item.sourceUrl,
      thumbnail_url: null,
      transcript_status: item.transcriptStatus || "unavailable",
      transcript_text: item.transcriptText || null,
      published_at: item.publishedAt,
      metrics: item.metrics,
      synced_at: timestamp,
      last_processed_at: timestamp,
      updated_at: timestamp,
      created_at: timestamp,
    },
    merge: true,
  };
}

function buildProductSalesSignals(products: Product[], orders: Order[]) {
  const signals = new Map<string, WhisperNetSalesSignals>();
  const externalIdToProductId = new Map<string, string>();
  const titleToProductId = new Map<string, string>();
  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

  for (const product of products) {
    signals.set(product.id, {
      unitsLast7d: 0,
      unitsLast30d: 0,
      revenueLast7d: 0,
      revenueLast30d: 0,
    });

    if (product.external_id) {
      externalIdToProductId.set(String(product.external_id), product.id);
    }

    titleToProductId.set(product.title.trim().toLowerCase(), product.id);
  }

  for (const order of orders) {
    const placedAt = order.placed_at ? new Date(order.placed_at).getTime() : 0;
    if (placedAt < thirtyDaysAgo) {
      continue;
    }

    const lineItems = Array.isArray(order.line_items) ? order.line_items : [];
    for (const lineItem of lineItems) {
      if (!lineItem || typeof lineItem !== "object") continue;

      const item = lineItem as Record<string, unknown>;
      const directProductId = item.product_id ? String(item.product_id) : null;
      const titleKey =
        typeof item.title === "string" ? item.title.trim().toLowerCase() : null;
      const productId =
        (directProductId ? externalIdToProductId.get(directProductId) : null) ||
        (titleKey ? titleToProductId.get(titleKey) : null);

      if (!productId) continue;

      const quantity = Math.max(0, toNumber(item.quantity));
      const unitPrice = toNumber(item.price);
      const bucket = signals.get(productId);

      if (!bucket) continue;

      bucket.unitsLast30d += quantity;
      bucket.revenueLast30d += quantity * unitPrice;

      if (placedAt >= sevenDaysAgo) {
        bucket.unitsLast7d += quantity;
        bucket.revenueLast7d += quantity * unitPrice;
      }
    }
  }

  return signals;
}

async function getExistingAlertsForUser(db: Firestore, userId: string) {
  const snapshot = await db
    .collection(COLLECTIONS.WHISPERNET_ALERTS)
    .where("user_id", "==", userId)
    .get();

  return new Map(
    snapshot.docs.map((doc) => [
      doc.id,
      {
        id: doc.id,
        ...doc.data(),
      } as WhisperNetAlert,
    ])
  );
}

function buildAlertCopy(productTitle: string, risk: WhisperNetForecast["stockout_risk"]) {
  if (risk === "critical") {
    return {
      title: `${productTitle} could stock out within 48 hours`,
      action: "Restock now or throttle promotion before the mention wave converts into demand you cannot fulfill.",
    };
  }

  if (risk === "high") {
    return {
      title: `${productTitle} inventory is getting tight`,
      action: "Review inbound inventory, update replenishment timing, and monitor demand closely over the next 48 hours.",
    };
  }

  return {
    title: `${productTitle} may need a stock check`,
    action: "Verify available inventory and make sure replenishment assumptions still hold.",
  };
}

export async function runWhisperNetScanForUser(
  db: Firestore,
  userId: string,
  trigger: "manual" | "sync" | "internal" = "manual"
): Promise<WhisperNetRunResult> {
  const startedAt = nowIso();
  const jobId = stableWhisperId("wnj", userId, trigger, startedAt);

  await db.collection(COLLECTIONS.WHISPERNET_PROCESSING_JOBS).doc(jobId).set({
    id: jobId,
    user_id: userId,
    status: "running",
    trigger,
    stats: null,
    error: null,
    started_at: startedAt,
    finished_at: null,
  } satisfies WhisperNetProcessingJob);

  try {
    const [watchers, products, orders, contentItems, existingAlerts] = await Promise.all([
      getWatchersForUser(db, userId),
      getProductsForUser(db, userId),
      getOrdersForUser(db, userId),
      getRecentSourceContentForUser(db, userId),
      getExistingAlertsForUser(db, userId),
    ]);

    const enabledWatchers = watchers.filter((watcher) => watcher.enabled !== false);
    const timestamp = nowIso();

    if (enabledWatchers.length === 0) {
      const finishedAt = nowIso();
      const stats = {
        watchedProducts: 0,
        contentProcessed: contentItems.length,
        mentionsDetected: 0,
        alertsOpen: 0,
        projectedRevenue48h: 0,
        trigger,
        skippedReason: "No active WhisperNet product watchers configured.",
      };

      await db.collection(COLLECTIONS.WHISPERNET_PROCESSING_JOBS).doc(jobId).set(
        {
          status: "succeeded",
          stats,
          finished_at: finishedAt,
        },
        { merge: true }
      );

      return {
        jobId,
        stats,
        finishedAt,
      };
    }

    const productMap = new Map(products.map((product) => [product.id, product]));
    const salesSignalsMap = buildProductSalesSignals(products, orders);
    const writes: WriteOperation[] = contentItems.map((item) =>
      buildContentItemWrite(userId, item)
    );
    const touchedAlertIds = new Set<string>();
    const resolvedAlertIds = new Set<string>();
    const watcherLastMatchAt = new Map<string, string>();
    let mentionsDetected = 0;
    let alertsOpen = 0;
    let projectedRevenue48h = 0;

    for (const watcher of enabledWatchers) {
      const product = productMap.get(watcher.product_id);
      if (!product) {
        writes.push({
          collectionName: COLLECTIONS.WHISPERNET_WATCHERS,
          docId: watcher.id,
          data: {
            last_scanned_at: timestamp,
            updated_at: timestamp,
          },
          merge: true,
        });
        continue;
      }

      const salesSignals = salesSignalsMap.get(product.id) || {
        unitsLast7d: 0,
        unitsLast30d: 0,
        revenueLast7d: 0,
        revenueLast30d: 0,
      };

      for (const item of contentItems) {
        const detection = detectMentionInContent(watcher, item);
        if (!detection) {
          continue;
        }

        mentionsDetected += 1;
        watcherLastMatchAt.set(watcher.id, timestamp);
        const mentionId = stableWhisperId(
          "wnm",
          watcher.id,
          item.contentItemId,
          detection.detectionSource,
          detection.matchedPhrase
        );
        const mentionKey = `${watcher.id}:${item.contentItemId}:${detection.detectionSource}:${detection.matchedPhrase.toLowerCase()}`;

        writes.push({
          collectionName: COLLECTIONS.WHISPERNET_MENTIONS,
          docId: mentionId,
          data: {
            id: mentionId,
            user_id: userId,
            watcher_id: watcher.id,
            product_id: product.id,
            content_item_id: item.contentItemId,
            platform: item.platform,
            source_id: item.sourceId,
            detection_source: detection.detectionSource,
            matched_phrase: detection.matchedPhrase,
            matched_text: detection.matchedText,
            context_window: detection.contextWindow,
            mention_timestamp_seconds: detection.mentionTimestampSeconds,
            confidence: detection.confidence,
            fuzzy_match: detection.fuzzyMatch,
            mention_key: mentionKey,
            source_url: item.sourceUrl,
            published_at: item.publishedAt,
            updated_at: timestamp,
            created_at: timestamp,
          },
          merge: true,
        });

        const forecast = computeWhisperNetForecast({
          detection,
          content: item,
          product,
          watcher,
          salesSignals,
        });

        projectedRevenue48h += forecast.predictedIncrementalRevenue48h;

        const forecastId = stableWhisperId("wnf", mentionId);
        writes.push({
          collectionName: COLLECTIONS.WHISPERNET_FORECASTS,
          docId: forecastId,
          data: {
            id: forecastId,
            user_id: userId,
            mention_id: mentionId,
            product_id: product.id,
            content_item_id: item.contentItemId,
            predicted_incremental_units_48h: forecast.predictedIncrementalUnits48h,
            predicted_incremental_revenue_48h: forecast.predictedIncrementalRevenue48h,
            baseline_units_48h: forecast.baselineUnits48h,
            confidence: forecast.confidence,
            confidence_score: forecast.confidenceScore,
            confidence_band: {
              lower_units: forecast.confidenceBand.lowerUnits,
              upper_units: forecast.confidenceBand.upperUnits,
              lower_revenue: forecast.confidenceBand.lowerRevenue,
              upper_revenue: forecast.confidenceBand.upperRevenue,
            },
            inventory_snapshot: {
              inventory_available:
                typeof product.inventory_quantity === "number"
                  ? product.inventory_quantity
                  : null,
              low_inventory_threshold: watcher.low_inventory_threshold,
            },
            projected_total_units_48h: forecast.projectedTotalUnits48h,
            estimated_hours_until_stockout: forecast.estimatedHoursUntilStockout,
            stockout_risk: forecast.stockoutRisk,
            rationale: forecast.rationale,
            updated_at: timestamp,
            created_at: timestamp,
          },
          merge: true,
        });

        const alertSeverity = getAlertSeverityFromRisk(forecast.stockoutRisk);
        const alertId = stableWhisperId("wna", mentionId);
        touchedAlertIds.add(alertId);

        if (alertSeverity) {
          alertsOpen += 1;
          const copy = buildAlertCopy(product.title, forecast.stockoutRisk);
          writes.push({
            collectionName: COLLECTIONS.WHISPERNET_ALERTS,
            docId: alertId,
            data: {
              id: alertId,
              user_id: userId,
              product_id: product.id,
              forecast_id: forecastId,
              mention_id: mentionId,
              severity: alertSeverity,
              status: "open",
              title: copy.title,
              summary: `${product.title} was mentioned on ${item.platform} and WhisperNet expects ${forecast.predictedIncrementalUnits48h} extra units in the next 48 hours.`,
              recommended_action: copy.action,
              source_url: item.sourceUrl,
              payload: {
                product_title: product.title,
                creator_name: item.creatorName,
                platform: item.platform,
                confidence: forecast.confidence,
                predicted_incremental_units_48h:
                  forecast.predictedIncrementalUnits48h,
                predicted_incremental_revenue_48h:
                  forecast.predictedIncrementalRevenue48h,
                inventory_available: product.inventory_quantity ?? null,
                estimated_hours_until_stockout:
                  forecast.estimatedHoursUntilStockout,
              },
              updated_at: timestamp,
              created_at: timestamp,
              resolved_at: null,
            },
            merge: true,
          });
        } else if (existingAlerts.has(alertId)) {
          resolvedAlertIds.add(alertId);
          writes.push({
            collectionName: COLLECTIONS.WHISPERNET_ALERTS,
            docId: alertId,
            data: {
              status: "resolved",
              updated_at: timestamp,
              resolved_at: timestamp,
            },
            merge: true,
          });
        }
      }

      writes.push({
        collectionName: COLLECTIONS.WHISPERNET_WATCHERS,
        docId: watcher.id,
        data: {
          last_scanned_at: timestamp,
          ...(watcherLastMatchAt.has(watcher.id)
            ? { last_match_at: watcherLastMatchAt.get(watcher.id) }
            : {}),
          updated_at: timestamp,
        },
        merge: true,
      });
    }

    for (const [alertId, alert] of existingAlerts) {
      if (alert.status === "open" && !touchedAlertIds.has(alertId) && !resolvedAlertIds.has(alertId)) {
        continue;
      }
    }

    await commitWriteOperations(db, writes);

    const finishedAt = nowIso();
    const stats = {
      watchedProducts: enabledWatchers.length,
      contentProcessed: contentItems.length,
      mentionsDetected,
      alertsOpen,
      projectedRevenue48h: Number(projectedRevenue48h.toFixed(2)),
      trigger,
    };

    await db.collection(COLLECTIONS.WHISPERNET_PROCESSING_JOBS).doc(jobId).set(
      {
        status: "succeeded",
        stats,
        finished_at: finishedAt,
      },
      { merge: true }
    );

    return {
      jobId,
      stats,
      finishedAt,
    };
  } catch (error) {
    const finishedAt = nowIso();
    await db.collection(COLLECTIONS.WHISPERNET_PROCESSING_JOBS).doc(jobId).set(
      {
        status: "failed",
        error: error instanceof Error ? error.message : "WhisperNet scan failed.",
        finished_at: finishedAt,
      },
      { merge: true }
    );

    throw error;
  }
}

export async function getWhisperNetSummary(
  db: Firestore,
  userId: string
): Promise<WhisperNetSummary> {
  const [
    watchers,
    products,
    integrationsSnapshot,
    contentSnapshot,
    mentionsSnapshot,
    forecastsSnapshot,
    alertsSnapshot,
    jobsSnapshot,
  ] = await Promise.all([
    getWatchersForUser(db, userId),
    getProductsForUser(db, userId),
    db.collection(COLLECTIONS.INTEGRATIONS).where("user_id", "==", userId).get(),
    db
      .collection(COLLECTIONS.WHISPERNET_CONTENT_ITEMS)
      .where("user_id", "==", userId)
      .get(),
    db.collection(COLLECTIONS.WHISPERNET_MENTIONS).where("user_id", "==", userId).get(),
    db.collection(COLLECTIONS.WHISPERNET_FORECASTS).where("user_id", "==", userId).get(),
    db.collection(COLLECTIONS.WHISPERNET_ALERTS).where("user_id", "==", userId).get(),
    db
      .collection(COLLECTIONS.WHISPERNET_PROCESSING_JOBS)
      .where("user_id", "==", userId)
      .get(),
  ]);

  const integrations = integrationsSnapshot.docs.map(
    (doc) => ({ id: doc.id, ...doc.data() }) as Integration
  );
  const contentItems = new Map(
    contentSnapshot.docs.map((doc) => {
      const data = doc.data();
      return [
        doc.id,
        {
          id: doc.id,
          ...data,
          published_at: toIsoString(data.published_at),
          synced_at: toIsoString(data.synced_at),
          last_processed_at: toIsoString(data.last_processed_at),
          created_at: toIsoString(data.created_at) || nowIso(),
          updated_at: toIsoString(data.updated_at) || nowIso(),
        } as WhisperNetContentItem,
      ];
    })
  );
  const productsMap = new Map(products.map((product) => [product.id, product]));
  const watchersMap = new Map(watchers.map((watcher) => [watcher.id, watcher]));
  const forecastsMap = new Map(
    forecastsSnapshot.docs.map((doc) => {
      const data = doc.data();
      return [
        doc.id,
        {
          id: doc.id,
          ...data,
          created_at: toIsoString(data.created_at) || nowIso(),
          updated_at: toIsoString(data.updated_at) || nowIso(),
        } as WhisperNetForecast,
      ];
    })
  );

  const mentions = mentionsSnapshot.docs
    .map((doc) => {
      const data = doc.data();
      const watcher = watchersMap.get(String(data.watcher_id || ""));
      const content = contentItems.get(String(data.content_item_id || ""));
      const forecast = Array.from(forecastsMap.values()).find(
        (item) => item.mention_id === doc.id
      ) || null;

      return {
        id: doc.id,
        ...data,
        published_at: toIsoString(data.published_at),
        created_at: toIsoString(data.created_at) || nowIso(),
        updated_at: toIsoString(data.updated_at) || nowIso(),
        product_title:
          productsMap.get(String(data.product_id || ""))?.title ||
          watcher?.product_title ||
          "Tracked product",
        detection_label:
          String(data.detection_source || "mention").charAt(0).toUpperCase() +
          String(data.detection_source || "mention").slice(1),
        source_title: content?.title || content?.caption || null,
        source_url:
          typeof data.source_url === "string"
            ? data.source_url
            : content?.permalink || null,
        creator_name: content?.creator_name || null,
        forecast,
      } as WhisperNetDashboardMention;
    })
    .sort((left, right) => {
      const leftTime = new Date(left.published_at || left.created_at).getTime();
      const rightTime = new Date(right.published_at || right.created_at).getTime();
      return rightTime - leftTime;
    })
    .slice(0, 24);

  const alerts = alertsSnapshot.docs
    .map((doc) => {
      const data = doc.data();
      const product = productsMap.get(String(data.product_id || ""));
      const forecast = forecastsMap.get(String(data.forecast_id || ""));
      const relatedMention = mentions.find((mention) => mention.id === data.mention_id);

      return {
        id: doc.id,
        ...data,
        created_at: toIsoString(data.created_at) || nowIso(),
        updated_at: toIsoString(data.updated_at) || nowIso(),
        resolved_at: toIsoString(data.resolved_at),
        product_title: product?.title || "Tracked product",
        source_title: relatedMention?.source_title || forecast?.id || null,
      } as WhisperNetDashboardAlert;
    })
    .filter((alert) => alert.status === "open")
    .sort((left, right) => {
      const leftTime = new Date(left.created_at).getTime();
      const rightTime = new Date(right.created_at).getTime();
      return rightTime - leftTime;
    })
    .slice(0, 16);

  const jobs = jobsSnapshot.docs
    .map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        started_at: toIsoString(data.started_at) || nowIso(),
        finished_at: toIsoString(data.finished_at),
      } as WhisperNetProcessingJob;
    })
    .sort((left, right) => {
      const leftTime = new Date(left.started_at).getTime();
      const rightTime = new Date(right.started_at).getTime();
      return rightTime - leftTime;
    });

  const lastRunAt = jobs[0]?.finished_at || jobs[0]?.started_at || null;
  const last48Hours = Date.now() - 48 * 60 * 60 * 1000;

  return {
    watchers,
    availableProducts: products
      .sort((left, right) => left.title.localeCompare(right.title))
      .map((product) => ({
        id: product.id,
        title: product.title,
        price: product.price,
        inventory_quantity: product.inventory_quantity,
        handle: product.handle,
        status: product.status,
      })),
    mentions,
    alerts,
    stats: {
      watchedProducts: watchers.length,
      activeWatchers: watchers.filter((watcher) => watcher.enabled !== false).length,
      monitoredContent: contentItems.size,
      mentionsLast48h: mentions.filter(
        (mention) => new Date(mention.published_at || mention.created_at).getTime() >= last48Hours
      ).length,
      projectedRevenue48h: Number(
        mentions
          .reduce(
            (sum, mention) =>
              sum + Number(mention.forecast?.predicted_incremental_revenue_48h || 0),
            0
          )
          .toFixed(2)
      ),
      criticalAlerts: alerts.filter((alert) => alert.severity === "critical").length,
    },
    integrations: {
      shopifyConnected: integrations.some(
        (integration) =>
          integration.provider === "shopify" && integration.status === "active"
      ),
      youtubeConnected: integrations.some(
        (integration) =>
          integration.provider === "youtube" && integration.status === "active"
      ),
      instagramConnected: integrations.some(
        (integration) =>
          integration.provider === "instagram" && integration.status === "active"
      ),
    },
    transcriptCoverage: {
      available: Array.from(contentItems.values()).filter(
        (item) => item.transcript_status === "available"
      ).length,
      pending: Array.from(contentItems.values()).filter(
        (item) => item.transcript_status === "pending"
      ).length,
      unavailable: Array.from(contentItems.values()).filter(
        (item) => item.transcript_status === "unavailable"
      ).length,
    },
    lastRunAt,
  };
}
