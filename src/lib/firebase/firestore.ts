import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  QueryConstraint,
  Timestamp,
  writeBatch,
  WhereFilterOp,
} from "firebase/firestore";
import { db } from "./client";

/**
 * Firestore helper that mimics Supabase query patterns
 */
export class FirestoreQuery<T = any> {
  private collectionName: string;
  private constraints: QueryConstraint[] = [];
  private selectFields?: string[];

  constructor(collectionName: string) {
    this.collectionName = collectionName;
  }

  select(fields?: string) {
    if (fields && fields !== "*") {
      this.selectFields = fields.split(",").map((f) => f.trim());
    }
    return this;
  }

  eq(field: string, value: any) {
    this.constraints.push(where(field, "==", value));
    return this;
  }

  neq(field: string, value: any) {
    this.constraints.push(where(field, "!=", value));
    return this;
  }

  in(field: string, values: any[]) {
    this.constraints.push(where(field, "in", values));
    return this;
  }

  order(field: string, options?: { ascending?: boolean }) {
    const direction = options?.ascending === false ? "desc" : "asc";
    this.constraints.push(orderBy(field, direction));
    return this;
  }

  limit(count: number) {
    this.constraints.push(limit(count));
    return this;
  }

  async single(): Promise<{ data: T | null; error: any }> {
    try {
      const docs = await this.execute();
      if (docs.length === 0) {
        return { data: null, error: null };
      }
      return { data: docs[0] as T, error: null };
    } catch (error: any) {
      return { data: null, error };
    }
  }

  async maybeSingle(): Promise<{ data: T | null; error: any }> {
    return this.single();
  }

  async execute(): Promise<T[]> {
    const q = query(collection(db, this.collectionName), ...this.constraints);
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
      } as T;
    });
  }
}

/**
 * Get a document by ID
 */
export async function getDocById<T = any>(
  collectionName: string,
  id: string
): Promise<{ data: T | null; error: any }> {
  try {
    const docRef = doc(db, collectionName, id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return { data: null, error: null };
    }

    return {
      data: { id: docSnap.id, ...docSnap.data() } as T,
      error: null,
    };
  } catch (error: any) {
    return { data: null, error };
  }
}

/**
 * Insert a document
 */
export async function insertDoc<T = any>(
  collectionName: string,
  data: any,
  id?: string
): Promise<{ data: T | null; error: any }> {
  try {
    const docRef = id
      ? doc(db, collectionName, id)
      : doc(collection(db, collectionName));

    const timestamp = Timestamp.now();
    const docData = {
      ...data,
      created_at: data.created_at || timestamp,
      updated_at: data.updated_at || timestamp,
    };

    await setDoc(docRef, docData);

    return {
      data: { id: docRef.id, ...docData } as T,
      error: null,
    };
  } catch (error: any) {
    return { data: null, error };
  }
}

/**
 * Update a document
 */
export async function updateDocById(
  collectionName: string,
  id: string,
  data: any
): Promise<{ data: any; error: any }> {
  try {
    const docRef = doc(db, collectionName, id);
    const updateData = {
      ...data,
      updated_at: Timestamp.now(),
    };

    await updateDoc(docRef, updateData);

    return { data: { id, ...updateData }, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
}

/**
 * Upsert (set with merge)
 */
export async function upsertDoc<T = any>(
  collectionName: string,
  id: string,
  data: any
): Promise<{ data: T | null; error: any }> {
  try {
    const docRef = doc(db, collectionName, id);
    const timestamp = Timestamp.now();
    const docData = {
      ...data,
      updated_at: timestamp,
    };

    await setDoc(docRef, docData, { merge: true });

    return {
      data: { id: docRef.id, ...docData } as T,
      error: null,
    };
  } catch (error: any) {
    return { data: null, error };
  }
}

/**
 * Delete a document
 */
export async function deleteDocById(
  collectionName: string,
  id: string
): Promise<{ error: any }> {
  try {
    const docRef = doc(db, collectionName, id);
    await deleteDoc(docRef);
    return { error: null };
  } catch (error: any) {
    return { error };
  }
}

/**
 * Simple query builder (mimics Supabase .from())
 */
export function from<T = any>(collectionName: string) {
  return new FirestoreQuery<T>(collectionName);
}
