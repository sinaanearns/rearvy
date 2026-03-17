"use client";

import { useEffect, useState } from "react";
import { collection, query, where, orderBy, onSnapshot, limit } from "firebase/firestore";
import { db, auth } from "@/lib/firebase/client";
import { Insight } from "@/types/database";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { InsightCard } from "./insight-card";
import { InsightDetails } from "./insight-details";
import { Loader2, Lightbulb, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from "@/components/ui/dropdown-menu";

import { useAuth } from "@/components/auth-provider";

export function InsightsList() {
  const { user, loading: authLoading } = useAuth();
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [selectedInsight, setSelectedInsight] = useState<Insight | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
        setLoading(false);
        setInsights([]);
        return;
    }

    setLoading(true);

    let q = query(
      collection(db, COLLECTIONS.INSIGHTS),
      where("user_id", "==", user.uid),
      where("is_dismissed", "==", false),
      orderBy("generated_at", "desc"),
      limit(50)
    );

    if (filter !== "all") {
      q = query(q, where("insight_type", "==", filter));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Insight[];
      setInsights(data);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching insights:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [filter]);

  const handleInsightClick = (insight: Insight) => {
    setSelectedInsight(insight);
    setIsDetailsOpen(true);
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Recent Intelligence
        </h2>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Filter className="h-4 w-4" />
              {filter === "all" ? "All Insights" : filter.charAt(0).toUpperCase() + filter.slice(1)}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Filter by Type</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setFilter("all")}>All Insights</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setFilter("trend")}>Trends</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setFilter("anomaly")}>Anomalies</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setFilter("opportunity")}>Opportunities</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setFilter("risk")}>Risks</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {insights.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-20 text-center bg-muted/10">
          <div className="rounded-full bg-muted p-4 mb-4">
            <Lightbulb className="h-10 w-10 text-muted-foreground/50" />
          </div>
          <h3 className="text-lg font-medium">No insights found</h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            {filter === "all" 
              ? "Connect your integrations and allow some time for data analysis to see generated business insights here."
              : `No insights of type "${filter}" were found matching your criteria.`}
          </p>
          {filter !== "all" && (
            <Button variant="link" onClick={() => setFilter("all")} className="mt-2 text-primary">
              Clear filters
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {insights.map((insight) => (
            <InsightCard 
              key={insight.id} 
              insight={insight} 
              onClick={() => handleInsightClick(insight)}
            />
          ))}
        </div>
      )}

      <InsightDetails 
        insight={selectedInsight} 
        isOpen={isDetailsOpen} 
        onClose={() => setIsDetailsOpen(false)} 
      />
    </div>
  );
}
