import type { GenerateMapInput } from "@/lib/ai/tools/generate-map";

export type MapGenerationIntent = {
  input: GenerateMapInput;
  assistantText: string;
  source: "jp-morgan-example";
};

const JP_MORGAN_PATTERN =
  /\b(?:j\.?\s*p\.?\s*morgan|jp\s*morgan|jpmorgan|jpmorgan\s*chase|chase\s+bank)\b/i;
const MAP_REQUEST_PATTERN =
  /\b(?:map|plot|visuali[sz]e|locations?|offices?|branches?|headquarters|hq|global\s+footprint|company\s+footprint|where\s+(?:is|are))\b/i;

function normalizeIntentText(value: string | null | undefined) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function buildJpMorganLocationMap(): MapGenerationIntent {
  const input: GenerateMapInput = {
    title: "JPMorgan Chase major company locations",
    summary:
      "City-level sample of major JPMorgan Chase and J.P. Morgan office hubs. Use it as a map-generation example, not an exhaustive branch or office locator.",
    focus: "JP Morgan company locations",
    viewport: {
      center: {
        latitude: 24,
        longitude: 12,
      },
      zoom: 1.55,
      bearing: 0,
      pitch: 0,
    },
    markers: [
      {
        id: "jpm-new-york",
        label: "New York",
        description: "Corporate headquarters and major banking hub.",
        latitude: 40.7556,
        longitude: -73.9754,
        tone: "violet",
        emphasis: true,
      },
      {
        id: "jpm-london",
        label: "London",
        description: "Major EMEA headquarters and investment banking hub.",
        latitude: 51.5048,
        longitude: -0.0195,
        tone: "blue",
        emphasis: true,
      },
      {
        id: "jpm-hong-kong",
        label: "Hong Kong",
        description: "Asia-Pacific financial markets and client hub.",
        latitude: 22.2819,
        longitude: 114.1586,
        tone: "amber",
      },
      {
        id: "jpm-singapore",
        label: "Singapore",
        description: "Regional corporate, operations, and client-service hub.",
        latitude: 1.2834,
        longitude: 103.8519,
        tone: "emerald",
      },
      {
        id: "jpm-mumbai",
        label: "Mumbai",
        description: "India banking, markets, and technology operations footprint.",
        latitude: 19.076,
        longitude: 72.8777,
        tone: "emerald",
      },
      {
        id: "jpm-bengaluru",
        label: "Bengaluru",
        description: "Large technology and operations center presence in India.",
        latitude: 12.9716,
        longitude: 77.5946,
        tone: "emerald",
      },
      {
        id: "jpm-tokyo",
        label: "Tokyo",
        description: "Japan capital markets and institutional client hub.",
        latitude: 35.6812,
        longitude: 139.7671,
        tone: "blue",
      },
      {
        id: "jpm-sydney",
        label: "Sydney",
        description: "Australia investment banking and markets presence.",
        latitude: -33.8688,
        longitude: 151.2093,
        tone: "blue",
      },
      {
        id: "jpm-frankfurt",
        label: "Frankfurt",
        description: "European financial center and corporate banking presence.",
        latitude: 50.1109,
        longitude: 8.6821,
        tone: "amber",
      },
      {
        id: "jpm-paris",
        label: "Paris",
        description: "Continental Europe office and client coverage hub.",
        latitude: 48.8566,
        longitude: 2.3522,
        tone: "amber",
      },
      {
        id: "jpm-sao-paulo",
        label: "Sao Paulo",
        description: "Latin America banking and institutional client hub.",
        latitude: -23.5505,
        longitude: -46.6333,
        tone: "rose",
      },
      {
        id: "jpm-chicago",
        label: "Chicago",
        description: "Major U.S. commercial banking and markets presence.",
        latitude: 41.8781,
        longitude: -87.6298,
        tone: "neutral",
      },
    ],
    routes: [],
  };

  return {
    input,
    source: "jp-morgan-example",
    assistantText:
      "I generated a city-level map of major JPMorgan Chase and J.P. Morgan locations. This is a working AI map example, not an exhaustive branch or office locator, so verify exact addresses before outreach or travel.",
  };
}

export function detectMapGenerationIntent(
  userText: string | null | undefined
): MapGenerationIntent | null {
  const text = normalizeIntentText(userText);
  if (!text || !MAP_REQUEST_PATTERN.test(text)) {
    return null;
  }

  if (JP_MORGAN_PATTERN.test(text)) {
    return buildJpMorganLocationMap();
  }

  return null;
}
