#!/usr/bin/env python3
"""Small stdin/stdout bridge between the Next.js server and MemPalace."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path
from typing import Any


def read_payload() -> dict[str, Any]:
    raw = sys.stdin.read().strip()
    if not raw:
        return {}

    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as exc:
        write_response({"ok": False, "error": f"Invalid JSON payload: {exc}"})
        sys.exit(0)

    return payload if isinstance(payload, dict) else {}


def write_response(payload: dict[str, Any]) -> None:
    print(json.dumps(payload, ensure_ascii=False))


def import_mempalace():
    try:
        from mempalace.config import MempalaceConfig
        from mempalace.layers import MemoryStack
        from mempalace.searcher import search_memories
        from mempalace.version import __version__

        return {
            "ok": True,
            "config_cls": MempalaceConfig,
            "stack_cls": MemoryStack,
            "search_fn": search_memories,
            "version": __version__,
        }
    except Exception as exc:  # pragma: no cover - runtime integration guard
        return {
            "ok": False,
            "error": "MemPalace Python package is not installed for this interpreter.",
            "details": str(exc),
        }


def resolve_palace_path(
    config_cls, palace_path: str | None
) -> str:
    if palace_path and palace_path.strip():
        return str(Path(palace_path).expanduser())

    return str(Path(config_cls().palace_path).expanduser())


def handle_probe(_: dict[str, Any]) -> None:
    imported = import_mempalace()
    if not imported["ok"]:
        write_response(imported)
        return

    write_response(
        {
            "ok": True,
            "version": imported["version"],
            "python": sys.executable,
        }
    )


def handle_recall(payload: dict[str, Any]) -> None:
    imported = import_mempalace()
    if not imported["ok"]:
        write_response(imported)
        return

    query = str(payload.get("query") or "").strip()
    wing = str(payload.get("wing") or "").strip() or None
    max_distance = float(payload.get("maxDistance") or 0.0)
    n_results = int(payload.get("results") or 5)
    palace_path = resolve_palace_path(
        imported["config_cls"], str(payload.get("palacePath") or "").strip() or None
    )

    try:
        # MemPalace manages the wake-up text inside the same palace.
        stack = imported["stack_cls"](palace_path=palace_path)
        wake_up = stack.wake_up(wing=wing)
        search_payload = (
            imported["search_fn"](
                query=query,
                palace_path=palace_path,
                wing=wing,
                n_results=n_results,
                max_distance=max_distance,
            )
            if query
            else {"query": "", "filters": {"wing": wing, "room": None}, "results": []}
        )
    except Exception as exc:  # pragma: no cover - runtime integration guard
        write_response(
            {
                "ok": False,
                "error": "MemPalace recall failed.",
                "details": str(exc),
            }
        )
        return

    write_response(
        {
            "ok": True,
            "wakeUp": wake_up,
            "search": search_payload,
            "palacePath": palace_path,
        }
    )


def handle_capture(payload: dict[str, Any]) -> None:
    imported = import_mempalace()
    if not imported["ok"]:
        write_response(imported)
        return

    transcript_path_raw = str(payload.get("transcriptPath") or "").strip()
    if not transcript_path_raw:
        write_response(
            {
                "ok": False,
                "error": "Missing transcriptPath for MemPalace capture.",
            }
        )
        return

    transcript_path = Path(transcript_path_raw).expanduser().resolve()
    if not transcript_path.exists():
        write_response(
            {
                "ok": False,
                "error": "Transcript file does not exist.",
                "details": str(transcript_path),
            }
        )
        return

    wing = str(payload.get("wing") or "").strip() or None
    agent = str(payload.get("agent") or "").strip() or "rearvy"
    palace_path = resolve_palace_path(
        imported["config_cls"], str(payload.get("palacePath") or "").strip() or None
    )

    command = [
        sys.executable,
        "-m",
        "mempalace.cli",
        "--palace",
        palace_path,
        "mine",
        str(transcript_path.parent),
        "--mode",
        "convos",
        "--agent",
        agent,
    ]
    if wing:
        command.extend(["--wing", wing])

    completed = subprocess.run(
        command,
        capture_output=True,
        text=True,
        encoding="utf-8",
    )

    if completed.returncode != 0:
        write_response(
            {
                "ok": False,
                "error": "MemPalace capture failed.",
                "details": (completed.stderr or completed.stdout).strip()
                or f"Process exited with code {completed.returncode}.",
            }
        )
        return

    write_response(
        {
            "ok": True,
            "output": completed.stdout.strip(),
            "transcriptPath": str(transcript_path),
            "palacePath": palace_path,
        }
    )


def main() -> None:
    if len(sys.argv) < 2:
        write_response({"ok": False, "error": "Missing MemPalace bridge command."})
        return

    command = sys.argv[1].strip().lower()
    payload = read_payload()

    if command == "probe":
        handle_probe(payload)
        return

    if command == "recall":
        handle_recall(payload)
        return

    if command == "capture":
        handle_capture(payload)
        return

    write_response({"ok": False, "error": f"Unsupported command: {command}"})


if __name__ == "__main__":
    main()
