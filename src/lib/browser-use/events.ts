export const BROWSER_AUTOMATION_REPLY_EVENT =
  "rearvy:browser-automation-reply";

export type BrowserAutomationReplyDetail = {
  prompt: string;
};

export function dispatchBrowserAutomationReply(prompt: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<BrowserAutomationReplyDetail>(
      BROWSER_AUTOMATION_REPLY_EVENT,
      {
        detail: { prompt },
      }
    )
  );
}
