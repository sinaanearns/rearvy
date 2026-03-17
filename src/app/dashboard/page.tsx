import { redirect } from "next/navigation";

interface DashboardRedirectPageProps {
  searchParams: Promise<{ shop?: string }>;
}

export default async function DashboardRedirectPage({
  searchParams,
}: DashboardRedirectPageProps) {
  const params = await searchParams;
  const shop = params.shop;

  if (shop) {
    redirect(`/integrations?shop=${encodeURIComponent(shop)}`);
  }

  redirect("/integrations");
}
