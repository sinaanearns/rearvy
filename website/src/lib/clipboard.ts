/**
 * Writes text to the operating-system clipboard when Rearvy runs in Electron,
 * then falls back to the browser Clipboard API for normal web sessions.
 */
export async function copyTextToClipboard(text: string): Promise<void> {
  if (!text) {
    return;
  }

  const desktopClipboard = window.electron?.clipboard;
  if (desktopClipboard?.writeText) {
    try {
      await desktopClipboard.writeText(text);
      return;
    } catch {
      // A web fallback remains useful when an older desktop shell lacks IPC.
    }
  }

  if (!navigator.clipboard?.writeText) {
    throw new Error("Clipboard access is unavailable in this browser.");
  }

  await navigator.clipboard.writeText(text);
}
