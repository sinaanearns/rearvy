import { NextResponse, type NextRequest } from "next/server";
import { getUserFromRequest } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  generateSiteId,
  normalizeDomain,
  buildTrackingSnippet,
} from "@/lib/integrations/website/utils";
import { getAppOrigin } from "@/lib/utils/url";

export async function POST(request: NextRequest) {
  const {
    data: { user },
  } = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { domain?: string; name?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { domain: rawDomain, name } = body;
  if (!rawDomain) {
    return NextResponse.json({ error: "Missing domain" }, { status: 400 });
  }

  const domain = normalizeDomain(rawDomain);
  if (!domain) {
    return NextResponse.json(
      { error: "Invalid domain format" },
      { status: 400 }
    );
  }

  const adminSupabase = createAdminClient();

  const { data: existing } = await adminSupabase
    .from("websites")
    .select("id")
    .eq("user_id", user.id)
    .eq("domain", domain)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: "This domain is already connected" },
      { status: 409 }
    );
  }

  const siteId = generateSiteId();
  const appOrigin = getAppOrigin(request);

  const { data: website, error } = await adminSupabase
    .from("websites")
    .insert({
      user_id: user.id,
      site_id: siteId,
      domain,
      name: name || domain,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    console.error("Failed to create website tracking:", error);
    return NextResponse.json(
      { error: "Failed to create website tracking" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    website,
    snippet: buildTrackingSnippet(siteId, appOrigin),
  });
}
