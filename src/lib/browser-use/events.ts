export const BROWSER_AUTOMATION_REPLY_EVENT = "rearvy:browser-automation-reply";

export interface BrowserAutomationReplyDetail {
  prompt?: string;
  // Add other fields as needed based on your automation reply structure
}

export function dispatchBrowserAutomationReply(detail: BrowserAutomationReplyDetail | string) {
  if (typeof window === "undefined") {
    return;
  }

  const payload: BrowserAutomationReplyDetail =
    typeof detail === "string" ? { prompt: detail } : detail;

  try {
    window.dispatchEvent(
      new CustomEvent(BROWSER_AUTOMATION_REPLY_EVENT, {
        detail: payload,
      })
    );
  } catch {
    // noop in environments where CustomEvent might be restricted
  }
}
