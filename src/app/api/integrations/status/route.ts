import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: integrations } = await supabase
    .from("integrations")
    .select(
      "id, provider, provider_account_name, status, last_synced_at, scopes, created_at"
    )
    .eq("user_id", user.id);

  // Also get counts of synced data
  const { count: productsCount } = await supabase
    .from("products")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  const { count: ordersCount } = await supabase
    .from("orders")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  return NextResponse.json({
    integrations: integrations || [],
    syncedData: {
      products: productsCount || 0,
      orders: ordersCount || 0,
    },
  });
}
