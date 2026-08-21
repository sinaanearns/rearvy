import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return;
  }

  const content = readFileSync(filePath, "utf8");
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const idx = trimmed.indexOf("=");
    if (idx <= 0) {
      continue;
    }

    const key = trimmed.slice(0, idx).trim();
    if (!key) {
      continue;
    }

    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

loadEnvFile(resolve(process.cwd(), ".env.local"));

function requiredEnv(name) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

function optionalEnv(name, fallback) {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : fallback;
}

function run(command) {
  return execSync(command, { stdio: "pipe" }).toString("utf8").trim();
}

function resolveGcloudCommand() {
  const explicit = process.env.GCLOUD_CMD;
  if (explicit && explicit.trim()) {
    return explicit.trim();
  }

  const localAppData = process.env.LOCALAPPDATA || "";
  const fallback = `${localAppData}\\Google\\Cloud SDK\\google-cloud-sdk\\bin\\gcloud.cmd`;
  if (localAppData && existsSync(fallback)) {
    return fallback;
  }

  return "gcloud";
}

const GCLOUD = resolveGcloudCommand();

function shellEscape(value) {
  return `"${value.replace(/"/g, '\\"')}"`;
}

function schedulerUri(baseUrl) {
  return `${baseUrl.replace(/\/$/, "")}/api/internal/trading/monitor-jobs`;
}

function hasJob(project, location, jobName) {
  try {
    run(
      `${shellEscape(GCLOUD)} scheduler jobs describe ${shellEscape(jobName)} --location=${shellEscape(location)} --project=${shellEscape(project)}`
    );
    return true;
  } catch {
    return false;
  }
}

function upsertSchedulerJob() {
  const project = process.env.GOOGLE_CLOUD_PROJECT || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!project || !project.trim()) {
    throw new Error("Missing required environment variable: GOOGLE_CLOUD_PROJECT (or NEXT_PUBLIC_FIREBASE_PROJECT_ID fallback)");
  }
  const appUrl = process.env.REARVY_APP_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl || !appUrl.trim()) {
    throw new Error("Missing required environment variable: REARVY_APP_URL (or NEXT_PUBLIC_APP_URL fallback)");
  }
  const internalToken = requiredEnv("INTERNAL_API_SECRET");

  const location = optionalEnv("TRADING_SCHEDULER_LOCATION", "us-central1");
  const jobName = optionalEnv("TRADING_SCHEDULER_JOB_NAME", "trading-monitor-runner");
  const schedule = optionalEnv("TRADING_SCHEDULER_CRON", "*/1 * * * *");
  const timeZone = optionalEnv("TRADING_SCHEDULER_TIME_ZONE", "UTC");
  const deadline = optionalEnv("TRADING_SCHEDULER_DEADLINE", "300s");

  const uri = schedulerUri(appUrl);
  const quotedName = shellEscape(jobName);
  const quotedProject = shellEscape(project);
  const quotedLocation = shellEscape(location);
  const quotedSchedule = shellEscape(schedule);
  const quotedTimeZone = shellEscape(timeZone);
  const quotedUri = shellEscape(uri);
  const quotedHeader = shellEscape(`x-internal-token=${internalToken}`);
  const quotedDeadline = shellEscape(deadline);

  const commonArgs = [
    `--location=${quotedLocation}`,
    `--project=${quotedProject}`,
    `--schedule=${quotedSchedule}`,
    `--time-zone=${quotedTimeZone}`,
    `--uri=${quotedUri}`,
    "--http-method=POST",
    `--headers=${quotedHeader}`,
    `--attempt-deadline=${quotedDeadline}`,
  ].join(" ");

  const exists = hasJob(project, location, jobName);
  const action = exists ? "update" : "create";
  const cmd = `${shellEscape(GCLOUD)} scheduler jobs ${action} http ${quotedName} ${commonArgs}`;

  run(cmd);

  // Enable if job was previously paused.
  try {
    run(
      `${shellEscape(GCLOUD)} scheduler jobs resume ${quotedName} --location=${quotedLocation} --project=${quotedProject}`
    );
  } catch {
    // Keep this non-fatal; job may already be enabled.
  }

  // Trigger one manual run for smoke test.
  run(
    `${shellEscape(GCLOUD)} scheduler jobs run ${quotedName} --location=${quotedLocation} --project=${quotedProject}`
  );

  console.log("Trading scheduler configured successfully.");
  console.log(`Project: ${project}`);
  console.log(`Location: ${location}`);
  console.log(`Job: ${jobName}`);
  console.log(`Target: ${uri}`);
  console.log(`Schedule: ${schedule} (${timeZone})`);
}

try {
  upsertSchedulerJob();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Failed to configure trading scheduler: ${message}`);
  process.exit(1);
}
