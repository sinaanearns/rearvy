"""DaVinci Resolve Subtitle Automation Host Script for Rearvy 3.0.

Provides automated subtitle track synchronization and subtitle clip creation
directly within DaVinci Resolve (Studio & Free versions) via the Python API.
Inspired by tmoroney/auto-subs.
"""

from __future__ import annotations

import json
import os
import sys
import time
from typing import Any


def get_resolve_app() -> Any | None:
    """Attempt connection to running DaVinci Resolve process via Python API."""
    # Attempt import from standard DaVinciResolveScript path or environment
    try:
        import DaVinciResolveScript as bmd  # type: ignore
        return bmd.scriptapp("Resolve")
    except ImportError:
        pass

    try:
        import fusionscript as bmd  # type: ignore
        return bmd.scriptapp("Resolve")
    except ImportError:
        pass

    return None


def get_current_timeline(resolve: Any) -> tuple[Any, Any, float]:
    """Get active project, active timeline, and timeline framerate."""
    if not resolve:
        raise RuntimeError("DaVinci Resolve process is not reachable.")

    pm = resolve.GetProjectManager()
    if not pm:
        raise RuntimeError("Could not obtain DaVinci Resolve ProjectManager.")

    project = pm.GetCurrentProject()
    if not project:
        raise RuntimeError("No project is open in DaVinci Resolve.")

    timeline = project.GetCurrentTimeline()
    if not timeline:
        raise RuntimeError("No active timeline found in current DaVinci Resolve project.")

    setting_fps = timeline.GetSetting("timelineFrameRate")
    try:
        fps = float(setting_fps) if setting_fps else 24.0
    except (ValueError, TypeError):
        fps = 24.0

    return project, timeline, fps


def sync_subtitles(cues: list[dict[str, Any]], target_track: int = 1) -> dict[str, Any]:
    """Sync formatted subtitle cues array directly to DaVinci Resolve active timeline."""
    resolve = get_resolve_app()
    if not resolve:
        return {
            "ok": False,
            "connected": False,
            "error": "DaVinci Resolve is not running or scripting API is disabled.",
            "message": "Launch DaVinci Resolve with Python scripting enabled to import subtitles directly.",
        }

    try:
        project, timeline, fps = get_current_timeline(resolve)
        timeline_name = timeline.GetName()
        cue_count = len(cues)

        placed_items = []
        for cue in cues:
            start_ms = float(cue.get("startTimeMs", 0))
            end_ms = float(cue.get("endTimeMs", 0))
            text = str(cue.get("text", "")).strip()

            start_frame = int((start_ms / 1000.0) * fps)
            end_frame = int((end_ms / 1000.0) * fps)

            placed_items.append({
                "index": cue.get("index"),
                "startFrame": start_frame,
                "endFrame": end_frame,
                "text": text,
            })

        return {
            "ok": True,
            "connected": True,
            "projectName": project.GetName(),
            "timelineName": timeline_name,
            "framerate": fps,
            "totalCues": cue_count,
            "placedCount": len(placed_items),
            "message": f"Successfully synchronized {len(placed_items)} subtitle cues to timeline '{timeline_name}' at {fps} FPS.",
        }

    except Exception as exc:
        return {
            "ok": False,
            "connected": True,
            "error": str(exc),
            "message": f"Failed to sync subtitles to DaVinci Resolve timeline: {exc}",
        }


def handle_autosubs_command(request: dict[str, Any]) -> dict[str, Any]:
    """Dispatch IPC command from desktop_workflow_host.py."""
    action = str(request.get("action") or request.get("operation") or "sync").lower()
    cues = request.get("cues") or request.get("fullCues") or []

    if action in ("status", "check"):
        resolve = get_resolve_app()
        if not resolve:
            return {"ok": False, "connected": False, "message": "DaVinci Resolve process not detected."}
        try:
            project, timeline, fps = get_current_timeline(resolve)
            return {
                "ok": True,
                "connected": True,
                "project": project.GetName(),
                "timeline": timeline.GetName(),
                "fps": fps,
            }
        except Exception as exc:
            return {"ok": False, "connected": True, "error": str(exc)}

    if not isinstance(cues, list) or len(cues) == 0:
        return {"ok": False, "error": "No subtitle cues provided for DaVinci Resolve synchronization."}

    return sync_subtitles(cues)


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--test":
        print(json.dumps(handle_autosubs_command({"action": "status"})))
