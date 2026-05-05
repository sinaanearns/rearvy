from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
import traceback
from dataclasses import asdict, is_dataclass
from datetime import date, datetime
from enum import Enum
from pathlib import Path
from urllib.parse import quote
from typing import Any
from uuid import uuid4

from dotenv import load_dotenv

os.environ.setdefault("BROWSER_USE_SETUP_LOGGING", "false")
load_dotenv(dotenv_path=Path.cwd() / ".env.local", override=False)
load_dotenv(override=False)

from browser_use import Agent, BrowserSession, ChatBrowserUse
from browser_use.skill_cli.python_session import PythonSession


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Rearvy browser-use session runner")
    parser.add_argument("--session-id", dest="session_id", default=None)
    parser.add_argument("--task", dest="task", default="")
    parser.add_argument("--keep-open", dest="keep_open", action="store_true")
    parser.add_argument("--use-cloud", dest="use_cloud", action="store_true")
    parser.add_argument("--cloud-timeout", dest="cloud_timeout", type=int, default=None)
    parser.add_argument("--cloud-proxy-country-code", dest="cloud_proxy_country_code", default=None)
    parser.add_argument("--cloud-profile-id", dest="cloud_profile_id", default=None)
    parser.add_argument("--max-steps", dest="max_steps", type=int, default=None)
    return parser


def now_ms() -> int:
    return int(datetime.now().timestamp() * 1000)


def to_jsonable(value: Any) -> Any:
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, Enum):
        return value.value
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if is_dataclass(value):
        return to_jsonable(asdict(value))
    if hasattr(value, "model_dump"):
        try:
            return to_jsonable(value.model_dump())
        except Exception:
            return str(value)
    if isinstance(value, dict):
        return {str(key): to_jsonable(item) for key, item in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [to_jsonable(item) for item in value]
    return str(value)


def emit(kind: str, **payload: Any) -> None:
    message = {"kind": kind, "timestamp": now_ms(), **payload}
    print(json.dumps(message, ensure_ascii=True, separators=(",", ":")), flush=True)


def get_env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() not in {"0", "false", "no", "off"}


def is_cloud_startup_limit_error(error: BaseException) -> bool:
    message = str(error).lower()
    return any(
        marker in message
        for marker in (
            "http 429",
            "too many requests",
            "free plan limit",
            "concurrent sessions reached",
            "cloudbrowsererror",
        )
    )


def looks_like_url_or_domain(text: str) -> bool:
    stripped = text.strip()
    if stripped.startswith(("http://", "https://", "file://", "www.")):
        return True
    if " " in stripped:
        return False
    parts = stripped.split(".")
    if len(parts) < 2:
        return False
    if any(part == "" for part in parts):
        return False
    if not parts[-1].isalpha() or len(parts[-1]) < 2:
        return False
    return all(part.replace("-", "").isalnum() for part in parts)


def looks_like_python(text: str) -> bool:
    stripped = text.strip()
    if not stripped:
        return False

    if stripped.startswith(("python:", "py:")):
        return True

    if looks_like_url_or_domain(stripped):
        return False

    python_markers = (
        "import ",
        "from ",
        "await ",
        "print(",
        "browser.",
        "subprocess.",
        "os.",
        "asyncio.",
        "Path(",
        "json.",
        "re.",
        "time.",
        "def ",
        "class ",
        "for ",
        "while ",
        "if ",
        "return ",
    )
    if stripped.startswith(python_markers):
        return True

    if any(marker in stripped for marker in ("(", ")", "=", ";", "[", "]", "{", "}", "+", "-", "*", "/", "%", "<", ">")):
        return True

    if "." in stripped and " " not in stripped:
        return True

    try:
        compile(stripped, "<terminal>", "exec")
    except SyntaxError:
        return False

    return False


def strip_command_prefix(text: str) -> tuple[str, str]:
    stripped = text.strip()
    lowered = stripped.lower()
    for prefix, mode in (("python:", "python"), ("py:", "python"), ("task:", "task"), ("agent:", "task")):
        if lowered.startswith(prefix):
            return mode, stripped[len(prefix) :].strip()
    return "auto", stripped


async def build_browser_session(session_id: str, use_cloud: bool) -> BrowserSession:
    cloud_timeout = os.getenv("BROWSER_USE_CLOUD_TIMEOUT")
    cloud_proxy_country_code = os.getenv("BROWSER_USE_CLOUD_PROXY_COUNTRY_CODE")
    cloud_profile_id = os.getenv("BROWSER_USE_CLOUD_PROFILE_ID")

    session_kwargs: dict[str, Any] = {
        "id": session_id,
        "keep_alive": True,
        "use_cloud": use_cloud,
        "headless": get_env_bool("BROWSER_USE_HEADLESS", True),
    }

    if cloud_timeout:
        try:
            session_kwargs["cloud_timeout"] = int(cloud_timeout)
        except ValueError:
            pass

    if cloud_proxy_country_code:
        session_kwargs["cloud_proxy_country_code"] = cloud_proxy_country_code

    if cloud_profile_id:
        session_kwargs["cloud_profile_id"] = cloud_profile_id

    browser_session = BrowserSession(**session_kwargs)
    await browser_session.start()
    return browser_session


def make_llm() -> ChatBrowserUse:
    model = os.getenv("BROWSER_USE_MODEL", "bu-2-0")
    timeout_ms = int(os.getenv("BROWSER_USE_TIMEOUT_MS", "240000"))
    return ChatBrowserUse(model=model, timeout=max(30.0, timeout_ms / 1000.0))


async def run_autonomous_task(
    browser_session: BrowserSession,
    llm: ChatBrowserUse,
    task: str,
    *,
    max_steps: int,
    source: str,
) -> None:
    emit("task-start", task=task, source=source)

    async def on_step(browser_state_summary: Any, model_output: Any, step: int) -> None:
        current_state = getattr(model_output, "current_state", None)
        emit(
            "step",
            step=step,
            task=task,
            source=source,
            url=getattr(browser_state_summary, "url", None),
            title=getattr(browser_state_summary, "title", None),
            evaluation=getattr(current_state, "evaluation_previous_goal", None),
            memory=getattr(current_state, "memory", None),
            nextGoal=getattr(current_state, "next_goal", None),
            actions=to_jsonable(getattr(model_output, "action", [])),
        )

    async def on_done(history: Any) -> None:
        final_result = None
        try:
            final_result = history.final_result()
        except Exception:
            final_result = None

        emit(
            "task-complete",
            task=task,
            source=source,
            result=to_jsonable(final_result),
        )

    agent = Agent(
        task=task,
        llm=llm,
        browser_session=browser_session,
        register_new_step_callback=on_step,
        register_done_callback=on_done,
        use_judge=False,
        include_recent_events=True,
        llm_timeout=int(os.getenv("BROWSER_USE_TIMEOUT_MS", "240000")) // 1000,
        step_timeout=max(30, int(os.getenv("BROWSER_USE_TIMEOUT_MS", "240000")) // 1000),
    )

    try:
        await agent.run(max_steps=max_steps)
    except Exception as error:
        emit(
            "task-error",
            task=task,
            source=source,
            error=str(error),
            traceback=traceback.format_exc(),
        )
        raise

    state = await browser_session.get_browser_state_summary(include_screenshot=False)
    emit(
        "browser-snapshot",
        task=task,
        source=source,
        url=getattr(state, "url", None),
        title=getattr(state, "title", None),
    )


async def run_python_code(
    python_session: PythonSession,
    browser_session: BrowserSession,
    code: str,
    *,
    source: str,
) -> None:
    emit("python-start", source=source, code=code)
    loop = asyncio.get_running_loop()
    result = await loop.run_in_executor(None, python_session.execute, code, browser_session, loop)
    state = await browser_session.get_browser_state_summary(include_screenshot=False)

    emit(
        "python-result",
        source=source,
        success=result.success,
        code=code,
        output=result.output or None,
        error=result.error,
        url=getattr(state, "url", None),
        title=getattr(state, "title", None),
    )


async def handle_follow_up(
    browser_session: BrowserSession,
    llm: ChatBrowserUse,
    python_session: PythonSession,
    command: str,
    *,
    max_steps: int,
) -> bool:
    mode, payload = strip_command_prefix(command)
    if not payload:
        return True

    if mode == "python" or looks_like_python(payload):
        code = payload
        if code.lower().startswith("python:"):
            code = code.split(":", 1)[1].strip()
        await run_python_code(python_session, browser_session, code, source="terminal")
        return True

    await run_autonomous_task(browser_session, llm, payload, max_steps=max_steps, source="follow-up")
    return True


async def main_async() -> int:
    args = build_parser().parse_args()
    session_id = args.session_id or os.getenv("BROWSER_USE_SESSION_ID") or str(uuid4())
    use_cloud = args.use_cloud or get_env_bool("BROWSER_USE_USE_CLOUD_BROWSER", False)
    max_steps = args.max_steps or int(os.getenv("BROWSER_USE_MAX_STEPS", "50"))
    allow_local_fallback = get_env_bool("BROWSER_USE_ALLOW_LOCAL_FALLBACK", False)

    emit(
        "session-config",
        sessionId=session_id,
        useCloud=use_cloud,
        keepAlive=args.keep_open,
        model=os.getenv("BROWSER_USE_MODEL", "bu-2-0"),
    )

    try:
        browser_session = await build_browser_session(session_id, use_cloud)
    except Exception as error:
        if use_cloud and allow_local_fallback and is_cloud_startup_limit_error(error):
            emit(
                "session-warning",
                sessionId=session_id,
                message="Cloud browser startup hit a session limit; retrying with a local browser session.",
                error=str(error),
            )
            use_cloud = False
            browser_session = await build_browser_session(session_id, use_cloud)
        else:
            emit(
                "session-error",
                sessionId=session_id,
                error=str(error),
                traceback=traceback.format_exc(),
            )
            return 1

    llm = make_llm()
    python_session = PythonSession()
    python_session.namespace.update(
        {
            "subprocess": __import__("subprocess"),
            "sys": sys,
            "browser_session": browser_session,
        }
    )

    state = await browser_session.get_browser_state_summary(include_screenshot=False)
    emit(
        "session-ready",
        sessionId=session_id,
        browserSessionId=browser_session.id,
        useCloud=use_cloud,
        cdpUrl=getattr(browser_session, "cdp_url", None),
        liveUrl=(
            f"https://live.browser-use.com/?wss={quote(browser_session.cdp_url, safe='')}"
            if use_cloud and browser_session.cdp_url
            else None
        ),
        url=getattr(state, "url", None),
        title=getattr(state, "title", None),
    )

    if args.task.strip():
        await run_autonomous_task(browser_session, llm, args.task.strip(), max_steps=max_steps, source="initial")

    if not args.keep_open:
        await browser_session.stop()
        emit("session-end", reason="keep-open-disabled")
        return 0

    emit(
        "terminal-ready",
        message="Terminal ready. Type Python code for the browser terminal, or plain text for a follow-up browser task.",
    )

    while True:
      try:
          line = await asyncio.to_thread(sys.stdin.readline)
      except (EOFError, KeyboardInterrupt):
          break

      if line == "":
          break

      command = line.strip()
      if not command:
          continue

      lowered = command.lower()
      if lowered in {"exit", "quit", "close"}:
          emit("session-end", reason="closed-by-request")
          break

      try:
          await handle_follow_up(browser_session, llm, python_session, command, max_steps=max_steps)
      except Exception:
          # Errors are already emitted; keep the terminal alive for the next command.
          continue

    try:
      await browser_session.stop()
    except Exception:
      pass

    emit("session-end", reason="stdin-closed")
    return 0


def main() -> None:
    raise SystemExit(asyncio.run(main_async()))


if __name__ == "__main__":
    main()