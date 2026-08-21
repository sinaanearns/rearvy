# Rearvy desktop automation providers

Rearvy desktop automation is workflow-only: the user reviews and approves a complete workflow before it can control another application. The renderer can inspect desktop state, but it cannot access raw mouse, keyboard, clipboard, shell, or application-control commands directly.

## Provider order

With the default `REARVY_DESKTOP_AUTOMATION_BACKEND=auto`, Rearvy uses the first available provider below for semantic element actions:

1. **Terminator** (`@mediar-ai/terminator`) — bundled as an optional Windows native dependency. It targets accessibility elements and can verify window/tree state.
2. **Touchpoint** (`touchpoint-py`) — optional Python host. It can merge Windows UI Automation with CDP-backed Chromium/Electron accessibility data. Its coordinate fallback is disabled; Rearvy falls back explicitly and records the provider used.
3. **pywinauto** — optional Python UI Automation fallback for legacy Windows controls.
4. **python-uiautomation** (`uiautomation`) — optional high-performance Python UIA tree traversal engine.
5. **Rearvy native UI Automation** — the zero-install Windows fallback embedded in the Electron main process.
6. **Windows Native OCR** (`Windows.Media.Ocr`) — zero-install WinRT text recognition fallback for custom canvas, Flutter, and non-accessible bitmap UIs.

Set `REARVY_DESKTOP_AUTOMATION_BACKEND` to `terminator`, `touchpoint`, `pywinauto`, `uiautomation`, `ocr`, or `native` to pin a provider. A pinned provider failing is surfaced to the workflow instead of silently changing automation engines.

## Optional Python providers

Python is never downloaded or changed by Rearvy. An administrator who wants the extra providers can install them into the Python runtime made available to the desktop app:

```powershell
py -3 -m pip install -r desktop-app\automation-python\requirements.txt
```

Use `REARVY_PYTHON_BIN` to select a specific Python executable. The host exchanges one bounded JSON request/response for every already-approved semantic operation; it never receives a renderer IPC channel.

## Verification and safety

The workflow executor prefers `waitForElement`, `getElementState`, `getElementValue`, `invokeElement`, `clickElement`, `typeIntoElement`, `setElementValue`, and `setToggleState` over coordinate input. The provider result includes its name in the workflow log. Coordinate, keyboard, and mouse fallbacks remain approval-gated and retain Rearvy's existing user-interrupt monitor.

The desktop bridge exposes `window.electron.automation.getBackendCapabilities()` for UI diagnostics. It reports availability only; it does not grant execution permission.
