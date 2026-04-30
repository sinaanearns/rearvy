// Playwright noop stub for Vercel/web deployments.
// The real playwright is only needed in the desktop app (Electron).
// All actual playwright calls are guarded by isWebDeployment() before execution.

"use strict";

function notAvailable(name) {
  return new Proxy(
    {},
    {
      get() {
        throw new Error(
          `[playwright-noop] "${name}" is not available in the web deployment. ` +
            "Use the Rearvy Desktop App for browser automation."
        );
      },
      apply() {
        throw new Error(
          `[playwright-noop] "${name}" is not available in the web deployment.`
        );
      },
    }
  );
}

module.exports = {
  chromium: notAvailable("chromium"),
  firefox: notAvailable("firefox"),
  webkit: notAvailable("webkit"),
  devices: {},
  errors: {},
  selectors: notAvailable("selectors"),
  request: notAvailable("request"),
};
