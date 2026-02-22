import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShoppingBag, Instagram, Youtube, Music2 } from "lucide-react";

const integrations = [
  {
    name: "Shopify",
    description: "Connect your store to analyze sales, products, and customers",
    icon: ShoppingBag,
    available: true,
  },
  {
    name: "Instagram",
    description: "Track followers, engagement, and content performance",
    icon: Instagram,
    available: false,
  },
  {
    name: "YouTube",
    description: "Monitor subscribers, views, and video analytics",
    icon: Youtube,
    available: false,
  },
  {
    name: "TikTok",
    description: "Analyze video reach, engagement, and audience demographics",
    icon: Music2,
    available: false,
  },
];

export default function IntegrationsPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Integrations</h1>
        <p className="text-muted-foreground">
          Connect your platforms so Rearvy can analyze your real data
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {integrations.map((integration) => (
          <Card
            key={integration.name}
            className={!integration.available ? "opacity-60" : ""}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <integration.icon className="h-8 w-8" />
                {!integration.available && (
                  <Badge variant="secondary">Coming soon</Badge>
                )}
              </div>
              <CardTitle className="text-base">{integration.name}</CardTitle>
              <CardDescription>{integration.description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}
