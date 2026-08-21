import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS, type BusinessKnowledgeNode, type BusinessKnowledgeEdge } from "@/lib/firebase/schema";
import { createServerLogger } from "@/lib/server-logger";

const log = createServerLogger("BusinessGraph");

export interface EntityQueryResult {
  node: BusinessKnowledgeNode;
  connectedNodes: Array<{ edge: BusinessKnowledgeEdge; targetNode: BusinessKnowledgeNode }>;
}

export class BusinessKnowledgeGraphService {
  static async addNode(
    userId: string,
    nodeData: Omit<BusinessKnowledgeNode, "id" | "created_at" | "updated_at">
  ): Promise<string> {
    const now = new Date().toISOString();
    const docRef = await adminDb.collection(COLLECTIONS.BUSINESS_KNOWLEDGE_NODES).add({
      ...nodeData,
      user_id: userId,
      created_at: now,
      updated_at: now,
    });
    log.info(`Added graph node ${docRef.id} (${nodeData.type}: ${nodeData.label})`);
    return docRef.id;
  }

  static async addEdge(
    edgeData: Omit<BusinessKnowledgeEdge, "id" | "created_at">
  ): Promise<string> {
    const now = new Date().toISOString();
    const docRef = await adminDb.collection(COLLECTIONS.BUSINESS_KNOWLEDGE_EDGES).add({
      ...edgeData,
      created_at: now,
    });
    log.info(`Added graph edge ${docRef.id} (${edgeData.relationship})`);
    return docRef.id;
  }

  static async queryNodeWithContext(
    userId: string,
    labelOrQuery: string
  ): Promise<EntityQueryResult[]> {
    try {
      const snapshot = await adminDb
        .collection(COLLECTIONS.BUSINESS_KNOWLEDGE_NODES)
        .where("user_id", "==", userId)
        .get();

      const nodes = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<BusinessKnowledgeNode, "id">),
      }));

      const queryLower = labelOrQuery.toLowerCase();
      const matchedNodes = nodes.filter(
        (node) =>
          node.label.toLowerCase().includes(queryLower) ||
          node.type.toLowerCase().includes(queryLower)
      );

      const results: EntityQueryResult[] = [];

      for (const node of matchedNodes) {
        const edgesSnapshot = await adminDb
          .collection(COLLECTIONS.BUSINESS_KNOWLEDGE_EDGES)
          .where("source_id", "==", node.id)
          .get();

        const connected: Array<{ edge: BusinessKnowledgeEdge; targetNode: BusinessKnowledgeNode }> = [];

        for (const edgeDoc of edgesSnapshot.docs) {
          const edge = { id: edgeDoc.id, ...(edgeDoc.data() as Omit<BusinessKnowledgeEdge, "id">) };
          const targetNodeDoc = await adminDb
            .collection(COLLECTIONS.BUSINESS_KNOWLEDGE_NODES)
            .doc(edge.target_id)
            .get();

          if (targetNodeDoc.exists) {
            connected.push({
              edge,
              targetNode: { id: targetNodeDoc.id, ...(targetNodeDoc.data() as Omit<BusinessKnowledgeNode, "id">) },
            });
          }
        }

        results.push({ node, connectedNodes: connected });
      }

      return results;
    } catch (error) {
      log.error("Error querying business graph:", error);
      return [];
    }
  }

  static async getBusinessGraphSummary(userId: string): Promise<Record<string, number>> {
    try {
      const snapshot = await adminDb
        .collection(COLLECTIONS.BUSINESS_KNOWLEDGE_NODES)
        .where("user_id", "==", userId)
        .get();

      const counts: Record<string, number> = {};

      for (const doc of snapshot.docs) {
        const type = doc.data().type || "Other";
        counts[type] = (counts[type] || 0) + 1;
      }

      return counts;
    } catch (error) {
      log.error("Error summarizing business graph:", error);
      return {};
    }
  }
}
