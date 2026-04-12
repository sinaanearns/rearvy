import { execSync } from "node:child_process";

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

function shellEscape(value) {
  return `"${value.replace(/"/g, '\\"')}"`;
}

function schedulerUri(baseUrl) {
  return `${baseUrl.replace(/\/$/, "")}/api/internal/trading/monitor-jobs/run`;
}

function hasJob(project, location, jobName) {
  try {
    run(
      `gcloud scheduler jobs describe ${shellEscape(jobName)} --location=${shellEscape(location)} --project=${shellEscape(project)}`
    );
    return true;
  } catch {
    return false;
  }
}

function upsertSchedulerJob() {
  const project = requiredEnv("GOOGLE_CLOUD_PROJECT");
  const appUrl = requiredEnv("REARVY_APP_URL");
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
  const cmd = `gcloud scheduler jobs ${action} http ${quotedName} ${commonArgs}`;

  run(cmd);

  // Enable if job was previously paused.
  try {
    run(
      `gcloud scheduler jobs resume ${quotedName} --location=${quotedLocation} --project=${quotedProject}`
    );
  } catch {
    // Keep this non-fatal; job may already be enabled.
  }

  // Trigger one manual run for smoke test.
  run(
    `gcloud scheduler jobs run ${quotedName} --location=${quotedLocation} --project=${quotedProject}`
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
