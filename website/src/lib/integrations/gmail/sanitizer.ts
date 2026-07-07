/**
 * High-performance regex HTML sanitizer to eliminate XSS risks in inbound emails.
 * Strips script tags, style headers, iframe tags, and onXYZ attributes.
 */
export function sanitizeEmailHtml(html: string): string {
  if (!html) return "";

  let clean = html;

  // Remove entire <script>...</script> blocks
  clean = clean.replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, "");

  // Remove entire <style>...</style> blocks
  clean = clean.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, "");

  // Remove entire <iframe>...</iframe> blocks
  clean = clean.replace(/<iframe[^>]*>([\s\S]*?)<\/iframe>/gi, "");

  // Strip event handler attributes (e.g. onload, onclick, onerror)
  clean = clean.replace(/\s+on[a-z]+\s*=\s*"[^"]*"/gi, "");
  clean = clean.replace(/\s+on[a-z]+\s*=\s*'[^']*'/gi, "");
  clean = clean.replace(/\s+on[a-z]+\s*=\s*[^\s>]+/gi, "");

  // Strip javascript: links
  clean = clean.replace(/href\s*=\s*["']\s*javascript:[^"']*["']/gi, 'href="#"');

  return clean;
}
