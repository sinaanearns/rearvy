import { Lightbulb } from "lucide-react";

export default function InsightsPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Insights</h1>
        <p className="text-muted-foreground">
          AI-detected trends, anomalies, and opportunities from your data
        </p>
      </div>

      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-20 text-center">
        <Lightbulb className="h-10 w-10 text-muted-foreground/50" />
        <h3 className="mt-4 font-medium">No insights yet</h3>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Connect your Shopify store or social accounts to start receiving
          automated business insights
        </p>
      </div>
    </div>
  );
}
