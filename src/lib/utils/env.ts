export const isVercel = process.env.VERCEL === "1";

/**
 * Returns true if the current environment is a web deployment (e.g. Vercel production or preview),
 * but not local development.
 */
export function isWebDeployment() {
  return isVercel && process.env.VERCEL_ENV !== "development";
}

/**
 * Returns true if the code is running in an Electron environment.
 */
export function isElectron() {
  if (typeof window !== "undefined") {
    return window.navigator.userAgent.toLowerCase().includes("electron");
  }
  return process.env.ELECTRON_RUN_AS_NODE === "1" || !!process.versions.electron;
}
