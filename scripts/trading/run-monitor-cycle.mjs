const appUrl = process.env.REARVY_APP_URL;
const token = process.env.INTERNAL_API_SECRET;

if (!appUrl || !token) {
  console.error("Missing REARVY_APP_URL or INTERNAL_API_SECRET.");
  process.exit(1);
}

const endpoint = `${appUrl.replace(/\/$/, "")}/api/internal/trading/monitor-jobs/run`;

async function runCycle() {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-token": token,
    },
  });

  const text = await response.text();

  if (!response.ok) {
    console.error(`Monitor cycle failed (${response.status}): ${text}`);
    process.exit(1);
  }

  console.log(`Monitor cycle success (${response.status})`);
  console.log(text);
}

runCycle().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Request failed: ${message}`);
  process.exit(1);
});
