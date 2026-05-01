export async function startBrowserSession(task: string) {
  const res = await fetch(`/api/browser/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ task }),
  });
  return res.json();
}

export async function sendSessionCommand(sessionId: string, cmd: string) {
  const res = await fetch(`/api/browser/session/${sessionId}/command`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cmd }),
  });
  return res.json();
}
