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
  type DocumentData,
} from "firebase/firestore";
import { db } from "./client";

type FirestoreError = unknown;
type FirestoreRecord = Record<string, unknown>;
type FirestoreResult<T> = { data: T | null; error: FirestoreError };
type FirestoreDeleteResult = { error: FirestoreError };

/**
 * Firestore query helper
 */
export class FirestoreQuery<T = DocumentData> {
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

  eq(field: string, value: unknown) {
    this.constraints.push(where(field, "==", value));
    return this;
  }

  neq(field: string, value: unknown) {
    this.constraints.push(where(field, "!=", value));
    return this;
  }

  in(field: string, values: unknown[]) {
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

  async single(): Promise<FirestoreResult<T>> {
    try {
      const docs = await this.execute();
      if (docs.length === 0) {
        return { data: null, error: null };
      }
      return { data: docs[0] as T, error: null };
    } catch (error) {
      return { data: null, error };
    }
  }

  async maybeSingle(): Promise<FirestoreResult<T>> {
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
export async function getDocById<T = DocumentData>(
  collectionName: string,
  id: string
): Promise<FirestoreResult<T>> {
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
  } catch (error) {
    return { data: null, error };
  }
}

/**
 * Insert a document
 */
export async function insertDoc<T = DocumentData>(
  collectionName: string,
  data: FirestoreRecord,
  id?: string
): Promise<FirestoreResult<T>> {
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
  } catch (error) {
    return { data: null, error };
  }
}

/**
 * Update a document
 */
export async function updateDocById(
  collectionName: string,
  id: string,
  data: FirestoreRecord
): Promise<FirestoreResult<FirestoreRecord & { id: string }>> {
  try {
    const docRef = doc(db, collectionName, id);
    const updateData = {
      ...data,
      updated_at: Timestamp.now(),
    };

    await updateDoc(docRef, updateData);

    return { data: { id, ...updateData }, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

/**
 * Upsert (set with merge)
 */
export async function upsertDoc<T = DocumentData>(
  collectionName: string,
  id: string,
  data: FirestoreRecord
): Promise<FirestoreResult<T>> {
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
  } catch (error) {
    return { data: null, error };
  }
}

/**
 * Delete a document
 */
export async function deleteDocById(
  collectionName: string,
  id: string
): Promise<FirestoreDeleteResult> {
  try {
    const docRef = doc(db, collectionName, id);
    await deleteDoc(docRef);
    return { error: null };
  } catch (error) {
    return { error };
  }
}

/**
 * Simple query builder
 */
export function from<T = DocumentData>(collectionName: string) {
  return new FirestoreQuery<T>(collectionName);
}
