import { Firestore } from "firebase-admin/firestore";
import { COLLECTIONS, GmailMessage, Order } from "@/lib/firebase/schema";
import { classifyEmail } from "@/lib/ai/gmail-classifier";
import { createServerLogger } from "@/lib/server-logger";

const log = createServerLogger("GmailInsightPipeline");

type GmailInsightCandidate = {
  insightType: "opportunity" | "risk";
  severity: "notable" | "important" | "critical";
  title: string;
  summary: string;
  dataSnapshot: Record<string, unknown>;
  relatedEntity: Record<string, unknown>;
};

/**
 * Processes unclassified Gmail messages and generates revenue-linked insights.
 */
export async function runGmailInsightPipeline(
  db: Firestore,
  userId: string,
  integrationId: string
) {
  // 1. Fetch unprocessed messages
  const messagesSnap = await db
    .collection(COLLECTIONS.GMAIL_MESSAGES)
    .where("user_id", "==", userId)
    .where("integration_id", "==", integrationId)
    .where("processed_at", "==", null)
    .limit(20) // Process in small batches
    .get();

  const messages = messagesSnap.docs.map(doc => ({
    id: doc.id,
    ref: doc.ref,
    data: doc.data() as GmailMessage
  }));

  if (messages.length === 0) return { processed: 0, insights: 0 };

  let processedCount = 0;

  for (const msg of messages) {
    try {
      // 2. Classify with AI
      const classification = await classifyEmail({
        subject: msg.data.subject,
        body: msg.data.body_text || msg.data.snippet || "",
        from: msg.data.from,
      });

      // 3. Match with Shopify Order
      // Extract email from "Name <email@example.com>" format
      const emailMatch = msg.data.from.match(/<(.+)>|(\S+@\S+\.\S+)/);
      const customerEmail = emailMatch ? (emailMatch[1] || emailMatch[2]) : msg.data.from;

      const orderSnap = await db
        .collection(COLLECTIONS.ORDERS)
        .where("user_id", "==", userId)
        .where("customer_email", "==", customerEmail)
        .orderBy("placed_at", "desc")
        .limit(1)
        .get();

      let orderId: string | null = null;
      if (!orderSnap.empty) {
        orderId = orderSnap.docs[0].id;
      }

      // 4. Update message with classification and attribution
      await msg.ref.update({
        category: classification.category,
        intent_signals: classification.intent_signals,
        sentiment: classification.sentiment,
        order_id: orderId,
        processed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      processedCount++;
    } catch (err) {
      log.error("Failed to process Gmail message:", { messageId: msg.id, error: err });
    }
  }

  // 5. Generate Predictive Insights
  const insightsCreated = await generatePredictiveInsights(db, userId, integrationId);

  return { processed: processedCount, insights: insightsCreated };
}

/**
 * Analyzes processed messages to find patterns and risks.
 */
async function generatePredictiveInsights(
  db: Firestore,
  userId: string,
  integrationId: string
): Promise<number> {
  let created = 0;

  // A. Trending Issues (3+ support/complaint in 7 days about similar topics)
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const recentIssuesSnap = await db
    .collection(COLLECTIONS.GMAIL_MESSAGES)
    .where("user_id", "==", userId)
    .where("category", "in", ["support", "complaint"])
    .where("received_at", ">=", weekAgo)
    .get();

  const issues = recentIssuesSnap.docs.map(doc => doc.data() as GmailMessage);
  
  if (issues.length >= 3) {
    // Basic grouping by intent signals
    const intentCounts: Record<string, number> = {};
    issues.forEach(msg => {
      msg.intent_signals.forEach(intent => {
        intentCounts[intent] = (intentCounts[intent] || 0) + 1;
      });
    });

    for (const [intent, count] of Object.entries(intentCounts)) {
      if (count >= 3) {
        const insightCreated = await insertGmailInsightIfFresh(db, userId, {
          insightType: "risk",
          severity: "important",
          title: `Trending Issue: ${intent.replace(/_/g, " ")}`,
          summary: `Detected ${count} customer inquiries regarding "${intent.replace(/_/g, " ")}" in the last 7 days. This may indicate a systemic issue with a product or process.`,
          dataSnapshot: { count, intent },
          relatedEntity: { type: "integration", id: integrationId },
        });
        if (insightCreated) created++;
      }
    }
  }

  // B. Churn Risk (Negative sentiment from high-value customer)
  const highValueCustomerEmails = await getHighValueCustomers(db, userId);
  const negativeMsgsSnap = await db
    .collection(COLLECTIONS.GMAIL_MESSAGES)
    .where("user_id", "==", userId)
    .where("sentiment", "==", "negative")
    .where("received_at", ">=", weekAgo)
    .get();
  
  const negativeMsgs = negativeMsgsSnap.docs.map(doc => doc.data() as GmailMessage);
  
  for (const msg of negativeMsgs) {
    const emailMatch = msg.from.match(/<(.+)>|(\S+@\S+\.\S+)/);
    const customerEmail = emailMatch ? (emailMatch[1] || emailMatch[2]) : msg.from;
    
    if (highValueCustomerEmails.includes(customerEmail)) {
      const insightCreated = await insertGmailInsightIfFresh(db, userId, {
        insightType: "risk",
        severity: "critical",
        title: `High Churn Risk: ${customerEmail}`,
        summary: `High-value customer expressed negative sentiment in a recent email. Immediate proactive reach-out is recommended to prevent churn.`,
        dataSnapshot: { customerEmail, sentiment: "negative" },
        relatedEntity: { type: "order", id: msg.order_id },
      });
      if (insightCreated) created++;
    }
  }

  // C. Demand Indicator (Pre-sale inquiry volume)
  const preSaleMsgsSnap = await db
    .collection(COLLECTIONS.GMAIL_MESSAGES)
    .where("user_id", "==", userId)
    .where("category", "==", "pre_sale")
    .where("received_at", ">=", weekAgo)
    .get();
  
  const preSaleMsgs = preSaleMsgsSnap.docs.map(doc => doc.data() as GmailMessage);
  
  if (preSaleMsgs.length >= 3) {
    const demandSignals: Record<string, number> = {};
    preSaleMsgs.forEach(msg => {
      msg.intent_signals.forEach(intent => {
        if (intent.includes("stock") || intent.includes("avail") || intent.includes("when")) {
            demandSignals[intent] = (demandSignals[intent] || 0) + 1;
        }
      });
    });

    for (const [intent, count] of Object.entries(demandSignals)) {
        if (count >= 3) {
            const insightCreated = await insertGmailInsightIfFresh(db, userId, {
                insightType: "opportunity",
                severity: "notable",
                title: `Demand Spike: ${intent.replace(/_/g, " ")}`,
                summary: `We detected ${count} pre-sale inquiries regarding "${intent.replace(/_/g, " ")}" in the last 7 days. This may indicate strong demand or low inventory levels for a specific product.`,
                dataSnapshot: { count, intent },
                relatedEntity: { type: "integration", id: integrationId },
              });
              if (insightCreated) created++;
        }
    }
  }

  return created;
}

async function getHighValueCustomers(db: Firestore, userId: string): Promise<string[]> {
    // Definition: Customers with total revenue > $500 (arbitrary for now)
    const ordersSnap = await db
        .collection(COLLECTIONS.ORDERS)
        .where("user_id", "==", userId)
        .get();
    
    const revenueByCustomer: Record<string, number> = {};
    ordersSnap.docs.forEach(doc => {
        const order = doc.data() as Order;
        if (order.customer_email) {
            revenueByCustomer[order.customer_email] = (revenueByCustomer[order.customer_email] || 0) + (Number(order.total_price) || 0);
        }
    });

    return Object.entries(revenueByCustomer)
        .filter(([, revenue]) => revenue > 500)
        .map(([email]) => email);
}

async function insertGmailInsightIfFresh(
  db: Firestore,
  userId: string,
  candidate: GmailInsightCandidate
): Promise<boolean> {
  const freshnessWindowStart = new Date(
    Date.now() - 3 * 24 * 60 * 60 * 1000 // 3 days for Gmail insights
  ).toISOString();

  const recentMatchSnapshot = await db
    .collection(COLLECTIONS.INSIGHTS)
    .where("user_id", "==", userId)
    .where("insight_type", "==", candidate.insightType)
    .where("title", "==", candidate.title)
    .where("generated_at", ">=", freshnessWindowStart)
    .limit(1)
    .get();

  if (!recentMatchSnapshot.empty) {
    return false;
  }

  await db.collection(COLLECTIONS.INSIGHTS).add({
    user_id: userId,
    insight_type: candidate.insightType,
    severity: candidate.severity,
    title: candidate.title,
    summary: candidate.summary,
    data_snapshot: candidate.dataSnapshot,
    metric_refs: [],
    related_entity: candidate.relatedEntity,
    is_read: false,
    is_dismissed: false,
    generated_at: new Date().toISOString(),
  });

  return true;
}
