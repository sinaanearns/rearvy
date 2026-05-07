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

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

function normalizeProfileForResponse(
  rawProfile: Record<string, unknown>,
  user: { id: string; email?: string | null }
) {
  const normalizedUsername = normalizeUsername(
    firstString(
      rawProfile.username,
      rawProfile.username_lower,
      rawProfile.userName,
      rawProfile.handle
    )
  );

  return {
    ...rawProfile,
    id: user.id,
    email: firstString(rawProfile.email, user.email || ""),
    full_name: firstString(
      rawProfile.full_name,
      rawProfile.fullName,
      rawProfile.name,
      rawProfile.displayName
    ),
    username: normalizedUsername,
    username_lower: normalizedUsername || null,
    avatar_url: firstString(
      rawProfile.avatar_url,
      rawProfile.avatarUrl,
      rawProfile.photoURL,
      rawProfile.photoUrl
    ),
    bio: firstString(rawProfile.bio, rawProfile.about),
    working_on: firstString(rawProfile.working_on, rawProfile.workingOn),
    skills: normalizeSkills(rawProfile.skills),
    project_links: normalizeProjectLinks(rawProfile.project_links || rawProfile.projectLinks),
    business_name: firstString(
      rawProfile.business_name,
      rawProfile.businessName,
      rawProfile.company_name,
      rawProfile.companyName
    ),
    business_type: firstString(rawProfile.business_type, rawProfile.businessType),
    timezone: firstString(rawProfile.timezone) || "UTC",
    currency: firstString(rawProfile.currency) || "USD",
    plan: firstString(rawProfile.plan) || DEFAULT_PLAN,
  };
}

export async function GET(request: NextRequest) {
  try {
    const { data, error } = await getUserFromRequest(request);
    if (error || !data.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
      const profileDoc = await adminDb
        .collection("profiles")
        .doc(data.user.id)
        .get();

      const rawProfile = profileDoc.exists
        ? ((profileDoc.data() as Record<string, unknown>) ?? {})
        : {};

      const profile = normalizeProfileForResponse(rawProfile, {
        id: data.user.id,
        email: data.user.email,
      });

      return NextResponse.json({ profile });
    } catch (dbError) {
      console.error("Error fetching profile document, returning fallback profile:", dbError);

      return NextResponse.json({
        profile: {
          id: data.user.id,
          email: data.user.email || "",
          full_name: "",
          username: "",
          username_lower: null,
          avatar_url: "",
          bio: "",
          working_on: "",
          skills: [],
          project_links: [],
          business_name: "",
          business_type: "",
          timezone: "UTC",
          currency: "USD",
          plan: DEFAULT_PLAN,
          _fallback: true,
        },
      });
    }
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
