import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";

type TemplateRecord = {
  id: string;
  name?: unknown;
  [key: string]: unknown;
};

export async function GET() {
  try {
    const templatesSnapshot = await adminDb
      .collection("project_templates")
      .where("is_active", "==", true)
      .get();

    const templates = templatesSnapshot.docs
      .map((doc): TemplateRecord => ({
        id: doc.id,
        ...doc.data(),
      }))
      .sort((a, b) => String(a.name ?? "").localeCompare(String(b.name ?? "")));

    return NextResponse.json({ templates });
  } catch (error) {
    console.error("Error fetching templates:", error);
    return NextResponse.json(
      { error: "Failed to fetch templates" },
      { status: 500 }
    );
  }
}
