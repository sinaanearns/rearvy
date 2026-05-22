## Automaton Troubleshooting & Quick Start

If you see "Failed to start Automaton" or "Automaton is not available" in the desktop app, follow these quick checks to restore or debug the Automaton runner.

1) Why this happens
- The desktop app expects a runnable Automaton installation under one of these locations (in order):
  - the directory pointed to by the environment variable `REARVY_AUTOMATON_DIR`
  - the local repository `automaton/` (development)
  - the packaged app resources `process.resourcesPath/automaton` (production)
- In shipped desktop builds the `automaton/` folder must be packaged into the app resources. If it is missing, the app cannot spawn the runner.

2) Quick verification
- Confirm whether the runner file exists (replace `<path>` with the candidate path you expect):

  ```powershell
  # Windows example - check local repo path
  dir .\automaton\scripts\rearvy-runner.js

  # Or check a packaged path (example):
  dir "C:\\Program Files\\Rearvy\\resources\\automaton\\scripts\\rearvy-runner.js"
  ```

- If file exists, run it manually to see output/logs:

  ```powershell
  node <path>\scripts\rearvy-runner.js --run
  ```

3) Use `REARVY_AUTOMATON_DIR` for temporary fix
- If you have a built automaton folder elsewhere, set the env var to point to it and restart the app:

  ```powershell
  $env:REARVY_AUTOMATON_DIR = 'C:\\path\\to\\automaton'
  # Then start the desktop app from the same shell so the var is visible to the process
  .\start-desktop.bat
  ```

4) Reinstall / repair the desktop app
- If the packaged resources are missing, reinstalling or repairing the desktop app will usually restore the `automaton` resources. Use your usual installer or release package for the application.

5) Developer notes (for maintainers)
- Packaging must copy built Automaton artifacts (including `scripts/rearvy-runner.js` and `dist/`) into the packaged app's `resources/automaton` so `resolveAutomatonCwd()` can find them at runtime.
- When automaton is intentionally omitted from the repo (it may be `.gitignore`d), provide CI/release steps that copy compiled artifacts into the installer bundle.

6) When opening an issue
- Include the following information in the report:
  - OS and installer used
  - Whether `automaton/scripts/rearvy-runner.js` exists in installed resources (give full path)
  - Any logs from running the runner manually

If you want, the app can be updated to surface a direct `helpUrl` pointing to this document or to an online release page. Contact the release maintainer to add that link to the installer.
