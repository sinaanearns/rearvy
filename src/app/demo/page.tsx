import Link from "next/link";
import { ArrowRight, ChartNoAxesCombined, Globe, Package, ShoppingCart, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const demoMetrics = [
  {
    label: "Revenue (30d)",
    value: "$24,860",
    trend: "+18.4%",
    icon: ChartNoAxesCombined,
  },
  {
    label: "Orders (30d)",
    value: "728",
    trend: "+9.1%",
    icon: ShoppingCart,
  },
  {
    label: "Products Sold",
    value: "1,932",
    trend: "+14.7%",
    icon: Package,
  },
  {
    label: "Visitors",
    value: "18,402",
    trend: "+22.0%",
    icon: Globe,
  },
];

const demoInsights = [
  "Your best conversion window is 7:00 PM to 10:00 PM on weekdays.",
  "Bundle offers raised average order value by 12% in the last two weeks.",
  "Instagram traffic drives 28% more returning customers than paid search.",
  "Product Retinol Serum is trending down in stock and may sell out in 5 days.",
];

const topProducts = [
  { name: "Glow Serum", units: 432, revenue: "$8,640" },
  { name: "Hydrating Cleanser", units: 385, revenue: "$5,775" },
  { name: "Night Repair Cream", units: 271, revenue: "$4,336" },
];

export default function DemoPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-background via-background to-muted/30 px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="rounded-2xl border border-border/60 bg-card/80 p-6 shadow-sm backdrop-blur sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-3">
              <Badge variant="secondary">Demo Account</Badge>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Explore Rearvy with sample business data
              </h1>
              <p className="max-w-2xl text-muted-foreground">
                This demo workspace shows example metrics, trends, and AI insights so visitors can experience Rearvy before creating an account.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/signup">
                <Button>
                  Create free account
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/">
                <Button variant="outline">Back to homepage</Button>
              </Link>
            </div>
          </div>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {demoMetrics.map((metric) => {
            const Icon = metric.icon;
            return (
              <Card key={metric.label}>
                <CardHeader className="space-y-1 pb-2">
                  <CardDescription>{metric.label}</CardDescription>
                  <CardTitle className="text-2xl">{metric.value}</CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-between">
                  <span className="text-sm text-emerald-600">{metric.trend}</span>
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </CardContent>
              </Card>
            );
          })}
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>AI demo insights</CardTitle>
              <CardDescription>
                Examples of what Rearvy can surface automatically
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 text-sm text-muted-foreground">
                {demoInsights.map((insight) => (
                  <li key={insight} className="rounded-md border bg-muted/40 px-3 py-2">
                    {insight}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Top products (demo)</CardTitle>
              <CardDescription>
                Snapshot of high-performing items this month
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {topProducts.map((product) => (
                <div
                  key={product.name}
                  className="flex items-center justify-between rounded-md border px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium">{product.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {product.units} units sold
                    </p>
                  </div>
                  <p className="text-sm font-semibold">{product.revenue}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <section className="rounded-2xl border border-border/60 bg-card/70 p-6 text-center sm:p-8">
          <Users className="mx-auto mb-3 h-6 w-6 text-muted-foreground" />
          <h2 className="text-xl font-semibold">Want your own real dashboard?</h2>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground">
            Connect Shopify, Instagram, YouTube, or Google Analytics and let Rearvy generate live insights from your data.
          </p>
          <div className="mt-4">
            <Link href="/signup">
              <Button size="lg">Start free</Button>
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
