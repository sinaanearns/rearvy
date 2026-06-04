import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/firebase/middleware";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { createServerLogger } from "@/lib/server-logger";

const log = createServerLogger("ProductSearchApi");

type ProductSearchRecord = Record<string, unknown> & {
  id: string;
  title?: unknown;
  price?: unknown;
  image_url?: unknown;
};

function toProductSearchRecord(id: string, data: Record<string, unknown>): ProductSearchRecord {
  return { id, ...data };
}

function toProductSearchResult(product: ProductSearchRecord) {
  return {
    id: product.id,
    title: typeof product.title === "string" ? product.title : "",
    price: product.price,
    imageUrl: typeof product.image_url === "string" ? product.image_url : null,
  };
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) {
    return auth.error;
  }
  const user = auth.user!;

  const searchParams = req.nextUrl.searchParams;
  const q = searchParams.get("q");

  if (!q || q.length < 3) {
    return NextResponse.json({ products: [] });
  }

  try {
    // Basic prefix search based on title. Note this is case-sensitive for the prefix in standard Firestore.
    // For a more robust setup, we'd use Typesense/Algolia or a lowercase_title field.
    const snapshot = await adminDb
      .collection(COLLECTIONS.PRODUCTS)
      .where("user_id", "==", user.uid)
      .where("title", ">=", q)
      .where("title", "<", q + "\uf8ff")
      .limit(5)
      .get();

    const products = snapshot.docs.map((doc) => {
      return toProductSearchResult(
        toProductSearchRecord(doc.id, doc.data() as Record<string, unknown>)
      );
    });

    // If no exact matches due to case, try fetching some and filtering (simple fallback)
    if (products.length === 0) {
      const lowercaseQ = q.toLowerCase();
      const fallbackSnapshot = await adminDb
        .collection(COLLECTIONS.PRODUCTS)
        .where("user_id", "==", user.uid)
        .limit(50)
        .get();

      const allProducts = fallbackSnapshot.docs.map((doc) =>
        toProductSearchRecord(doc.id, doc.data() as Record<string, unknown>)
      );
      const filtered = allProducts
        .filter((product) =>
          typeof product.title === "string" &&
          product.title.toLowerCase().includes(lowercaseQ)
        )
        .slice(0, 5)
        .map(toProductSearchResult);

      return NextResponse.json({ products: filtered });
    }

    return NextResponse.json({ products });
  } catch (error) {
    log.error("Product search error:", error);
    return NextResponse.json(
      { error: "Failed to search products" },
      { status: 500 }
    );
  }
}
