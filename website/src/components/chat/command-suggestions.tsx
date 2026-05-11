import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { 
  type LucideIcon,
  ShoppingBag, 
  TrendingUp, 
  Users, 
  PieChart, 
  History, 
  AlertTriangle,
  ChevronRight,
  Sparkles,
  Globe,
  Search,
  Video as VideoIcon,
} from "lucide-react";


export interface CommandOption {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  example: string;
}

export const COMMANDS: CommandOption[] = [
  {
    id: "sku",
    name: "/sku",
    description: "Revenue, COGS, Margin & Stock risk",
    icon: ShoppingBag,
    example: "/sku [product_name]"
  },
  {
    id: "profit",
    name: "/profit",
    description: "Net profit summary for a period",
    icon: TrendingUp,
    example: "/profit last month"
  },
  {
    id: "ltv",
    name: "/ltv",
    description: "Customer lifetime value & churn risk",
    icon: Users,
    example: "/ltv customer@example.com"
  },
  {
    id: "roas",
    name: "/roas",
    description: "Multi-touch attributed ROAS",
    icon: PieChart,
    example: "/roas instagram campaign"
  },
  {
    id: "save",
    name: "/save",
    description: "Save a personalized query preset",
    icon: History,
    example: "/save weekly-margin"
  },
  {
    id: "warn",
    name: "/warn",
    description: "Set margin or stock alerts",
    icon: AlertTriangle,
    example: "/warn if margin < 25%"
  },
  {
    id: "imagine",
    name: "/imagine",
    description: "Generate an image using Grok",
    icon: Sparkles,
    example: "/imagine a cyberpunk city"
  },
  {
    id: "video",
    name: "/video",
    description: "Generate a short video using Grok",
    icon: VideoIcon,
    example: "/video a rocket launching"
  },
  {
    id: "browse",
    name: "/browse",
    description: "Open a live browser session",
    icon: Globe,
    example: "/browse google.com"
  },
  {
    id: "research",
    name: "/research",
    description: "Deep web research on a topic",
    icon: Search,
    example: "/research current market trends"
  }
];

interface CommandSuggestionsProps {
  query: string;
  onSelect: (command: string) => void;
  focusedIndex: number;
}

export function CommandSuggestions({ query, onSelect, focusedIndex }: CommandSuggestionsProps) {
  const [skuResults, setSkuResults] = useState<{ id: string; title: string; price: number }[]>([]);
  const [loading, setLoading] = useState(false);

  // If query starts with "/sku ", we fetch SKUs
  const isSkuSearch = query.startsWith("/sku ");
  const searchTerm = isSkuSearch ? query.replace("/sku ", "").trim() : "";

  useEffect(() => {
    if (!isSkuSearch || searchTerm.length < 3) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();

    const runSearch = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/products/search?q=${encodeURIComponent(searchTerm)}`, {
          signal: controller.signal,
        });
        const data = await response.json();
        setSkuResults(data.products || []);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setSkuResults([]);
        }
      } finally {
        setLoading(false);
      }
    };

    void runSearch();

    return () => {
      controller.abort();
    };
  }, [isSkuSearch, searchTerm]);

  // Command filtering
  const filteredCommands = !isSkuSearch 
    ? COMMANDS.filter(c => c.name.startsWith(query) || c.id.includes(query.replace("/", "")))
    : [];

  if (filteredCommands.length === 0 && (!isSkuSearch || (searchTerm.length < 3 && !loading) || (skuResults.length === 0 && !loading))) {
    return null;
  }

  return (
    <Card className="absolute bottom-full left-0 mb-2 w-full max-w-sm overflow-hidden border border-border bg-background/95 p-1 shadow-2xl backdrop-blur-xl animate-in slide-in-from-bottom-2 duration-200">
      <div className="flex flex-col">
        {!isSkuSearch && filteredCommands.map((command, index) => (
          <button
            key={command.id}
            onClick={() => onSelect(command.name + " ")}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-muted/80",
              focusedIndex === index && "bg-primary/10 text-primary"
            )}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted/50">
              <command.icon className="h-4 w-4" />
            </div>
            <div className="flex flex-1 flex-col overflow-hidden">
              <span className="text-sm font-semibold">{command.name}</span>
              <span className="truncate text-[11px] text-muted-foreground">{command.description}</span>
            </div>
            <span className="text-[10px] font-mono opacity-50">{command.example}</span>
          </button>
        ))}

        {isSkuSearch && (
          <div className="p-2">
            <div className="mb-2 px-1 text-[10px] uppercase font-bold text-muted-foreground tracking-widest flex items-center gap-2">
              <ShoppingBag className="h-3 w-3" />
              SKU Autocomplete
            </div>
            {loading && <div className="px-1 py-1 text-xs animate-pulse">Searching catalog...</div>}
            {!loading && searchTerm.length >= 3 && skuResults.length === 0 && (
              <div className="px-1 py-1 text-xs text-muted-foreground">No matches found for &quot;{searchTerm}&quot;</div>
            )}
            {!loading && skuResults.map((product, index) => (
              <button
                key={product.id}
                onClick={() => onSelect(`/sku ${product.title}`)}
                className={cn(
                  "flex items-center gap-3 w-full rounded-lg px-3 py-2 text-left transition-colors hover:bg-muted/80",
                  focusedIndex === index && "bg-primary/10 text-primary"
                )}
              >
                <div className="h-8 w-8 shrink-0 rounded bg-muted/50 overflow-hidden flex items-center justify-center text-[10px] font-bold">
                  SKU
                </div>
                <div className="flex flex-1 flex-col overflow-hidden">
                  <span className="text-sm font-medium truncate">{product.title}</span>
                  <span className="text-[10px] text-muted-foreground">₹{product.price}</span>
                </div>
                <ChevronRight className="h-3 w-3 opacity-30" />
              </button>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
