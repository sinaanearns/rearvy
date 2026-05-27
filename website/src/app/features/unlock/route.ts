const deindexHeaders = {
  "Content-Type": "text/plain; charset=utf-8",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
};

export function GET() {
  return new Response("Gone", {
    status: 410,
    headers: deindexHeaders,
  });
}

export function HEAD() {
  return new Response(null, {
    status: 410,
    headers: deindexHeaders,
  });
}
