import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/firebase/server";
import { adminDb } from "@/lib/firebase/admin";
import { DEFAULT_PLAN } from "@/lib/plans";

function normalizeUsername(input: string) {
  return input
    .toLowerCase()
    .replace(/^@+/, "")
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 30);
}

function sanitizeText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function normalizeSkills(value: unknown) {
  const raw = Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").join(",")
    : typeof value === "string"
      ? value
      : "";

  return Array.from(
    new Set(
      raw
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    )
  ).slice(0, 20);
}

function normalizeProjectLinks(value: unknown) {
  const raw = Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : typeof value === "string"
      ? value.split(/\r?\n/)
      : [];

  return Array.from(
    new Set(
      raw
        .map((item) => item.trim())
        .filter((item) => item.length > 0)
        .filter((item) => /^https?:\/\//i.test(item))
    )
  ).slice(0, 20);
}

export async function GET(request: NextRequest) {
  try {
    const { data, error } = await getUserFromRequest(request);
    if (error || !data.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profileDoc = await adminDb
      .collection("profiles")
      .doc(data.user.id)
      .get();

    const profile = profileDoc.exists
      ? {
        plan: DEFAULT_PLAN,
        ...profileDoc.data(),
      }
      : {
        id: data.user.id,
        email: data.user.email,
        full_name: "",
        username: "",
        bio: "",
        working_on: "",
        skills: [],
        project_links: [],
        business_name: "",
        business_type: "",
        plan: DEFAULT_PLAN,
        timezone: "UTC",
        currency: "USD",
        avatar_url: "",
      };

    return NextResponse.json({ profile });
  } catch (error) {
    console.error("Error fetching profile:", error);
    return NextResponse.json(
      { error: "Failed to fetch profile" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { data, error } = await getUserFromRequest(request);
    if (error || !data.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      full_name,
      username,
      avatar_url,
      bio,
      working_on,
      skills,
      project_links,
      business_name,
      business_type,
      timezone,
      currency,
    } = body;

    let normalizedUsername = "";
    if (typeof username === "string" && username.trim()) {
      normalizedUsername = normalizeUsername(username.trim());
      if (!normalizedUsername) {
        return NextResponse.json(
          { error: "Username can only contain letters, numbers, and underscores." },
          { status: 400 }
        );
      }

      const existing = await adminDb
        .collection("profiles")
        .where("username_lower", "==", normalizedUsername)
        .limit(1)
        .get();

      if (!existing.empty && existing.docs[0].id !== data.user.id) {
        return NextResponse.json(
          { error: "Username is already taken." },
          { status: 409 }
        );
      }
    }

    const avatarUrl = sanitizeText(avatar_url, 600000);
    const safeBio = sanitizeText(bio, 1200);
    const safeWorkingOn = sanitizeText(working_on, 1200);
    const safeSkills = normalizeSkills(skills);
    const safeProjectLinks = normalizeProjectLinks(project_links);

    const profileRef = adminDb.collection("profiles").doc(data.user.id);

    await profileRef.set(
      {
        full_name: full_name || "",
        username: normalizedUsername || null,
        username_lower: normalizedUsername || null,
        avatar_url: avatarUrl || null,
        bio: safeBio,
        working_on: safeWorkingOn,
        skills: safeSkills,
        project_links: safeProjectLinks,
        business_name: business_name || "",
        business_type: business_type || null,
        timezone: timezone || "UTC",
        currency: currency || "USD",
        plan: DEFAULT_PLAN,
        updated_at: new Date(),
      },
      { merge: true }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating profile:", error);
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    );
  }
}
