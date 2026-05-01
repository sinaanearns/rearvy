/**
 * Demo browser agent for showcasing browser automation capabilities
 * when the paid browser-use tier is not available
 */

export interface DemoBrowserResult {
  ok: boolean;
  summary?: string;
  error?: string;
  status: string;
  screenshot?: string;
  currentUrl?: string;
  actions?: Array<{
    action: string;
    description: string;
    success: boolean;
  }>;
}

export async function runDemoBrowserAgent(task: string): Promise<DemoBrowserResult> {
  // Simulate browser tasks for demo purposes
  const taskLower = task.toLowerCase().trim();

  // Demo: Explicit open-google requests (only when user explicitly asks for Google)
  if (
    /\b(open|go to|visit)\s+google\b/.test(taskLower) ||
    /\bgoogle\.com\b/.test(taskLower)
  ) {
    return {
      ok: true,
      status: "completed",
      summary: "Opened Google as requested",
      currentUrl: "https://www.google.com",
      actions: [
        {
          action: "navigate",
          description: "Opened google.com in browser",
          success: true,
        },
      ],
    };
  }

  // Demo: Search queries like "search for cats" or "search cats"
  const searchMatch = taskLower.match(/(?:search(?:\s+for)?|find)\s+(.+)/i);
  if (searchMatch) {
    const query = encodeURIComponent(searchMatch[1].trim());
    const searchUrl = `https://www.google.com/search?q=${query}`;
    return {
      ok: true,
      status: "completed",
      summary: `Performed demo search for: ${searchMatch[1].trim()}`,
      currentUrl: searchUrl,
      actions: [
        {
          action: "navigate",
          description: `Opened search results for ${searchMatch[1].trim()}`,
          success: true,
        },
      ],
    };
  }

  // Demo: Fill form
  if (
    taskLower.includes("form") ||
    taskLower.includes("fill") ||
    taskLower.includes("contact")
  ) {
    return {
      ok: true,
      status: "completed",
      summary: "Successfully filled out form fields and demonstrated interaction capabilities",
      currentUrl: "https://example.com/contact",
      actions: [
        {
          action: "navigate",
          description: "Navigated to contact form",
          success: true,
        },
        {
          action: "fill",
          description: "Filled form fields with demonstration data",
          success: true,
        },
        {
          action: "submit",
          description: "Demonstrated form submission",
          success: true,
        },
      ],
    };
  }

  // Demo: Extract data
  if (taskLower.includes("extract") || taskLower.includes("scrape")) {
    return {
      ok: true,
      status: "completed",
      summary: "Extracted and analyzed webpage content successfully",
      currentUrl: "https://example.com/data",
      actions: [
        {
          action: "navigate",
          description: "Navigated to target page",
          success: true,
        },
        {
          action: "extract",
          description: "Extracted structured data from page",
          success: true,
        },
      ],
    };
  }

  // Demo: Generic navigation
  if (
    taskLower.includes("go to") ||
    taskLower.includes("visit") ||
    taskLower.includes("navigate")
  ) {
    const urlMatch = task.match(
      /(?:go to|visit|navigate to|open)\s+(.+?)(?:\s+and|$)/i
    );
    const target = urlMatch ? urlMatch[1] : "the requested page";

    return {
      ok: true,
      status: "completed",
      summary: `Successfully navigated to ${target}`,
      currentUrl: "https://example.com",
      actions: [
        {
          action: "navigate",
          description: `Navigated to ${target}`,
          success: true,
        },
      ],
    };
  }

  // Default demo response
  return {
    ok: true,
    status: "completed",
    summary: `Completed browser task: "${task}". This is a demonstration of browser automation capabilities.`,
    currentUrl: "https://www.rearvy.com",
    actions: [
      {
        action: "execute",
        description: "Executed browser automation task",
        success: true,
      },
    ],
  };
}

export function getDemoBrowserMessage(): string {
  return `Browser automation is running in demo mode. For production use with unlimited browser tasks and live interaction, upgrade your browser-use account at https://cloud.browser-use.com/settings. Demo mode demonstrates all features with pre-configured examples.`;
}
