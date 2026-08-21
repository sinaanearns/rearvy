export const PUBLIC_CONTACT_EMAIL = "myrearvy@gmail.com";
export const PRIVACY_CONTACT_EMAIL = PUBLIC_CONTACT_EMAIL;
export const SECURITY_CONTACT_EMAIL = PUBLIC_CONTACT_EMAIL;

export function buildMailto(email: string, subject?: string, body?: string) {
  const params = new URLSearchParams();

  if (subject) {
    params.set("subject", subject);
  }

  if (body) {
    params.set("body", body);
  }

  const query = params.toString();
  return `mailto:${email}${query ? `?${query}` : ""}`;
}

export function buildGmailComposeUrl(email: string, subject?: string, body?: string) {
  const params = new URLSearchParams({
    view: "cm",
    fs: "1",
    to: email,
  });

  if (subject) {
    params.set("su", subject);
  }

  if (body) {
    params.set("body", body);
  }

  return `https://mail.google.com/mail/?${params.toString()}`;
}
