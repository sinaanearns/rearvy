import argparse
import asyncio
import inspect
import json
import os
import re
import sys
import time
import uuid
from pathlib import Path
from typing import Any


RISKY_PATTERN = re.compile(
    r"\b("
    r"submit|send|post|publish|comment|reply|message|email|dm|"
    r"buy|purchase|checkout|order|pay|payment|subscribe|"
    r"upload|attach|download|delete|remove|cancel|refund|"
    r"login|log in|sign in|sign-in|password|otp|2fa|mfa|"
    r"permission|camera|microphone|location|share|invite"
    r")\b",
    re.IGNORECASE,
)

URL_PATTERN = re.compile(r"https?://[^\s]+", re.IGNORECASE)
SIMPLE_NAVIGATION_PATTERN = re.compile(
    r"\b(open|visit|go to|navigate to|load|show)\b",
    re.IGNORECASE,
)

STOP_COMMANDS = {"stop", "close", "exit", "quit"}
STDIN_QUEUE: asyncio.Queue[str] | None = None
STDIN_READER_TASK: asyncio.Task[None] | None = None
NVIDIA_DEEPSEEK_V4_PRO_MODEL = "deepseek-ai/deepseek-v4-pro"
NVIDIA_MODEL_KEY_ENV_VARS = {
    NVIDIA_DEEPSEEK_V4_PRO_MODEL: "NVIDIA_DEEPSEEK_API_KEY",
    "z-ai/glm-5.1": "NVIDIA_GLM_API_KEY",
    "moonshotai/kimi-k2.6": "NVIDIA_KIMI_API_KEY",
    "stepfun-ai/step-3.7-flash": "NVIDIA_STEP_API_KEY",
    "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning": "NVIDIA_NEMOTRON_API_KEY",
}

SAFETY_INSTRUCTION = """
You are Rearvy's local desktop browser agent.
You may navigate, search, read pages, summarize content, and extract visible information.
For goal-seeking browser tasks, do not stop after the first page load. Scan the full page,
inspect visible and full-document links/buttons/forms, scroll when necessary, and follow
safe candidate navigation paths until the user's requested target is found or bounded
fallbacks are exhausted.
Before any action that transmits data, changes account state, logs in, grants permissions,
uploads files, deletes data, sends messages, posts content, starts a purchase, checks out,
or saves payment/password details, call request_user_approval with a specific reason.
If approval is not granted, stop before the risky action and explain what is pending.
Never solve CAPTCHAs, bypass paywalls, bypass security interstitials, or complete a final
password-change step.
""".strip()

GOAL_SEEKING_INSTRUCTION = """
Bounded fallback order:
1. Open the start URL or most likely target URL.
2. Read the full page text and inspect links, buttons, and forms.
3. Try the safest matching signup/login/goal candidate on the current page.
4. Scroll and inspect again if the candidate is not visible.
5. Try likely same-site routes such as /signup, /sign-up, /register, /start, /login, or /admin only when relevant.
6. Stop with a concise attempted-method summary when the target cannot be found.
For signup/login/account tasks, stop before entering passwords, OTPs, recovery codes,
payment details, CAPTCHA, or final account submission. Keep the browser open for the user.
""".strip()

EXCLUDED_DEFAULT_ACTIONS = [
    "upload_file",
    "save_pdf",
    "write_file",
    "replace_file",
    "download",
]


def emit(payload: dict[str, Any]) -> None:
    payload.setdefault("timestamp", time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()))
    print(json.dumps(payload, ensure_ascii=True), flush=True)


def get_nvidia_api_key(model: str | None = None) -> str:
    model_key_env_var = NVIDIA_MODEL_KEY_ENV_VARS.get((model or "").strip())
    if model_key_env_var:
        value = os.getenv(model_key_env_var, "").strip()
        if value:
            return value

    return os.getenv("NVIDIA_API_KEY", "").strip()


def load_env_files() -> None:
    try:
        from dotenv import load_dotenv
    except Exception:
        load_dotenv = None

    start = Path(__file__).resolve()
    repo_root = start.parents[2] if len(start.parents) >= 3 else Path.cwd()
    candidates = [
        repo_root / ".env.local",
        repo_root / "website" / ".env.local",
        repo_root / "desktop-app" / ".env.local",
        Path.cwd() / ".env.local",
    ]

    for env_path in candidates:
        if env_path.exists():
            if load_dotenv:
                load_dotenv(env_path, override=False)
            else:
                load_env_file_without_dotenv(env_path)


def load_env_file_without_dotenv(env_path: Path) -> None:
    try:
        for raw_line in env_path.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = value
    except Exception:
        return


def parse_bool(value: str | None, default: bool) -> bool:
    if value is None:
        return default
    return value.strip().lower() not in {"0", "false", "no", "off"}


def has_risky_intent(text: str | None) -> bool:
    return bool(text and RISKY_PATTERN.search(text))


def extract_url(text: str | None) -> str | None:
    if not text:
        return None
    match = URL_PATTERN.search(text)
    if not match:
        return None
    return match.group(0).rstrip(").,;\"'")


def is_simple_navigation_task(text: str | None) -> bool:
    if not text or not extract_url(text):
        return False
    if has_risky_intent(text):
        return False
    return bool(SIMPLE_NAVIGATION_PATTERN.search(text))


def build_agent_task(instruction: str, strategy: str = "goal-seeking") -> str:
    strategy_text = GOAL_SEEKING_INSTRUCTION if strategy == "goal-seeking" else "Open only the requested page and keep the browser open."
    return f"{SAFETY_INSTRUCTION}\n\nStrategy:\n{strategy_text}\n\nUser task:\n{instruction}"


def command_to_instruction(raw: str) -> str | None:
    value = raw.strip()
    if not value:
        return None

    try:
        parsed = json.loads(value)
    except Exception:
        parsed = None

    if isinstance(parsed, dict):
        command = parsed.get("command") or parsed.get("cmd")
        if isinstance(command, str) and command.strip():
            return command.strip()

        commands = parsed.get("commands")
        if isinstance(commands, list) and commands:
            parts: list[str] = []
            for item in commands:
                if not isinstance(item, dict):
                    continue
                action = str(item.get("action") or "").strip().lower()
                if action == "goto":
                    target = str(item.get("target") or "").strip()
                    if target:
                        parts.append(f"navigate to {target}")
                elif action == "click":
                    selector = str(item.get("selector") or "").strip()
                    if selector:
                        parts.append(f"click the element matching selector {selector}")
                    else:
                        parts.append("click the intended element")
                elif action in {"type", "typefocused"}:
                    text = str(item.get("value") or item.get("text") or "")
                    if text:
                        parts.append(f"type this text into the appropriate field: {text}")
                elif action in {"back", "forward", "reload"}:
                    parts.append(f"perform browser action: {action}")
                elif action == "scroll":
                    parts.append("scroll the page")
            if parts:
                return "Continue in the same browser tab and " + "; then ".join(parts) + "."

    return value


def extract_history_summary(history: Any) -> str:
    if history is None:
        return "Browser task completed."

    all_results = getattr(history, "all_results", None)
    if isinstance(all_results, (list, tuple)) and all_results:
        for result in reversed(all_results):
            for attr in ("extracted_content", "long_term_memory"):
                value = getattr(result, attr, None)
                if value:
                    return str(value)
        for result in reversed(all_results):
            value = getattr(result, "error", None)
            if value:
                return f"Browser task stopped with: {value}"

    for attr in ("final_result", "final_answer"):
        method = getattr(history, attr, None)
        if callable(method):
            try:
                result = method()
                if result:
                    return str(result)
            except Exception:
                pass

    if isinstance(history, (list, tuple)) and history:
        last = history[-1]
        for attr in ("result", "extracted_content", "content"):
            value = getattr(last, attr, None)
            if value:
                return str(value)
        return str(last)

    text = str(history).strip()
    return text or "Browser task completed."


async def maybe_await(value: Any) -> Any:
    if inspect.isawaitable(value):
        return await value
    return value


async def close_browser(browser: Any) -> None:
    if not browser:
        return
    for method_name in ("close", "kill", "stop"):
        method = getattr(browser, method_name, None)
        if callable(method):
            try:
                await maybe_await(method())
                return
            except Exception:
                continue


async def stdin_reader(queue: asyncio.Queue[str]) -> None:
    while True:
        try:
            line = await asyncio.to_thread(sys.stdin.readline)
        except Exception:
            await asyncio.sleep(0.25)
            continue

        if line == "":
            await asyncio.sleep(0.25)
            continue

        await queue.put(line)


def ensure_stdin_reader() -> asyncio.Queue[str]:
    global STDIN_QUEUE, STDIN_READER_TASK

    if STDIN_QUEUE is None:
        STDIN_QUEUE = asyncio.Queue()

    if STDIN_READER_TASK is None or STDIN_READER_TASK.done():
        STDIN_READER_TASK = asyncio.create_task(stdin_reader(STDIN_QUEUE))

    return STDIN_QUEUE


async def read_stdin_line(timeout_seconds: float = 0.5) -> str | None:
    queue = ensure_stdin_reader()
    try:
        return await asyncio.wait_for(queue.get(), timeout_seconds)
    except asyncio.TimeoutError:
        return None


async def wait_for_user_approval(reason: str, command: str | None, session_id: str | None) -> bool:
    approval_id = f"approval_{uuid.uuid4().hex[:10]}"
    approval = {
        "id": approval_id,
        "reason": reason,
        "command": command,
    }
    emit(
        {
            "ok": True,
            "type": "approval",
            "status": "awaiting_approval",
            "id": session_id,
            "message": reason,
            "awaitingApproval": approval,
        }
    )

    while True:
        raw = await read_stdin_line()
        if raw is None:
            continue

        normalized = raw.strip()
        if not normalized:
            continue

        lower = normalized.lower()
        if lower in STOP_COMMANDS:
            emit(
                {
                    "ok": False,
                    "type": "approval",
                    "status": "rejected",
                    "id": session_id,
                    "message": "Browser action stopped before approval.",
                    "awaitingApproval": None,
                }
            )
            return False

        if lower == "approve" or lower.startswith("approve:"):
            requested_id = normalized.split(":", 1)[1].strip() if ":" in normalized else ""
            if not requested_id or requested_id == approval_id:
                emit(
                    {
                        "ok": True,
                        "type": "approval",
                        "status": "approved",
                        "id": session_id,
                        "message": "User approved the pending browser action.",
                        "awaitingApproval": None,
                    }
                )
                return True

        emit(
            {
                "ok": True,
                "type": "approval",
                "status": "awaiting_approval",
                "id": session_id,
                "message": f"Still waiting for approval. Send approve:{approval_id} to continue.",
                "awaitingApproval": approval,
            }
        )


def choose_provider() -> tuple[str, str]:
    requested = os.getenv("BROWSER_USE_LLM_PROVIDER", "").strip().lower()
    providers = [requested] if requested else []
    providers.extend(["openai", "google", "nvidia"])

    seen: set[str] = set()
    for provider in providers:
        if not provider or provider in seen:
            continue
        seen.add(provider)

        if provider == "openai" and os.getenv("OPENAI_API_KEY"):
            return "openai", os.getenv("BROWSER_USE_MODEL") or os.getenv("OPENAI_MODEL") or "gpt-4o-mini"
        if provider in {"google", "gemini"} and (os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")):
            return "google", os.getenv("BROWSER_USE_MODEL") or os.getenv("GOOGLE_MODEL") or "gemini-2.0-flash"
        if provider == "nvidia":
            model = (
                os.getenv("BROWSER_USE_MODEL")
                or os.getenv("NVIDIA_MODEL")
                or os.getenv("NVIDIA_CHAT_MODEL")
                or NVIDIA_DEEPSEEK_V4_PRO_MODEL
            )
            if get_nvidia_api_key(model):
                return "nvidia", model

    raise RuntimeError(
        "Browser automation needs one local LLM key. Set OPENAI_API_KEY, "
        "or GOOGLE_API_KEY in .env.local. BROWSER_USE_API_KEY is not required for this local runner."
    )


def make_llm(browser_use_module: Any) -> Any:
    provider, model = choose_provider()

    if provider == "openai":
        chat_openai = getattr(browser_use_module, "ChatOpenAI", None)
        if chat_openai:
            return chat_openai(model=model, api_key=os.getenv("OPENAI_API_KEY"))

    if provider == "google":
        os.environ.setdefault("GOOGLE_API_KEY", os.getenv("GEMINI_API_KEY", ""))
        chat_google = getattr(browser_use_module, "ChatGoogle", None) or getattr(browser_use_module, "ChatGoogleGenerativeAI", None)
        if chat_google:
            return chat_google(model=model)

    if provider == "nvidia":
        chat_openai = getattr(browser_use_module, "ChatOpenAI", None)
        if chat_openai:
            return chat_openai(
                model=model,
                api_key=get_nvidia_api_key(model),
                base_url="https://integrate.api.nvidia.com/v1",
            )

    try:
        from langchain_openai import ChatOpenAI

        if provider == "openai":
            return ChatOpenAI(model=model, api_key=os.getenv("OPENAI_API_KEY"), temperature=0)
        if provider == "nvidia":
            return ChatOpenAI(
                model=model,
                api_key=get_nvidia_api_key(model),
                base_url="https://integrate.api.nvidia.com/v1",
                temperature=0,
            )
    except Exception:
        pass

    if provider == "google":
        try:
            from langchain_google_genai import ChatGoogleGenerativeAI

            return ChatGoogleGenerativeAI(model=model, google_api_key=os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY"))
        except Exception:
            pass

    raise RuntimeError(f"Could not initialize a browser-use LLM for provider '{provider}'.")


def make_tools(browser_use_module: Any, session_id: str | None) -> Any:
    tools_class = getattr(browser_use_module, "Tools", None)
    action_result_class = getattr(browser_use_module, "ActionResult", None)

    if not tools_class:
        return None

    try:
        tools = tools_class(exclude_actions=EXCLUDED_DEFAULT_ACTIONS)
    except TypeError:
        tools = tools_class()

    @tools.action(description="Ask the user for approval before a risky browser action")
    async def request_user_approval(reason: str, destination: str = "", data: str = "") -> Any:
        detail = reason.strip() or "The browser agent wants to perform a risky action."
        if destination.strip():
            detail = f"{detail} Destination: {destination.strip()}."
        if data.strip():
            detail = f"{detail} Data involved: {data.strip()}."

        approved = await wait_for_user_approval(detail, detail, session_id)
        if action_result_class:
            if approved:
                return action_result_class(extracted_content="User approved the risky browser action.")
            return action_result_class(error="User did not approve the risky browser action.", is_done=True, success=False)
        return "User approved the risky browser action." if approved else "User did not approve the risky browser action."

    return tools


def make_browser(browser_use_module: Any, connection_method: str = "managed-runner", cdp_url: str | None = None) -> Any:
    browser_class = getattr(browser_use_module, "Browser", None) or getattr(browser_use_module, "BrowserSession", None)
    if not browser_class:
        raise RuntimeError("browser-use did not expose Browser or BrowserSession.")

    kwargs: dict[str, Any] = {
        "headless": parse_bool(os.getenv("BROWSER_USE_HEADLESS"), False),
        "keep_alive": True,
        "window_size": {
            "width": int(os.getenv("BROWSER_USE_WIDTH") or "1280"),
            "height": int(os.getenv("BROWSER_USE_HEIGHT") or "900"),
        },
    }

    user_data_dir = os.getenv("BROWSER_USE_USER_DATA_DIR")
    if user_data_dir:
        kwargs["user_data_dir"] = user_data_dir

    channel = os.getenv("BROWSER_USE_CHANNEL")
    if channel:
        kwargs["channel"] = channel

    resolved_cdp_url = cdp_url or os.getenv("BROWSER_USE_CDP_URL")
    if connection_method == "cdp-direct" and resolved_cdp_url:
        kwargs["cdp_url"] = resolved_cdp_url
        kwargs["is_local"] = True

    if parse_bool(os.getenv("BROWSER_USE_SYSTEM_CHROME"), False):
        from_system_chrome = getattr(browser_class, "from_system_chrome", None)
        if callable(from_system_chrome):
            return from_system_chrome(**kwargs)

    return browser_class(**kwargs)


async def current_page_state(browser: Any) -> dict[str, Any]:
    state: dict[str, Any] = {}
    try:
        url_method = getattr(browser, "get_current_page_url", None)
        if callable(url_method):
            url = await maybe_await(url_method())
            if url:
                state["currentUrl"] = str(url)

        title_method = getattr(browser, "get_current_page_title", None)
        if callable(title_method):
            title = await maybe_await(title_method())
            if title:
                state["title"] = str(title)

        if state:
            return state

        page = None
        for method_name in ("must_get_current_page", "get_current_page"):
            method = getattr(browser, method_name, None)
            if callable(method):
                page = await maybe_await(method())
                if page:
                    break
        if not page:
            return state

        url = getattr(page, "url", None)
        title = getattr(page, "title", None)
        if callable(title):
            title = await maybe_await(title())
        if url:
            state["currentUrl"] = str(url)
        if title:
            state["title"] = str(title)
    except Exception:
        return state
    return state


async def run_direct_navigation(browser: Any, instruction: str, session_id: str | None) -> str | None:
    url = extract_url(instruction)
    if not url:
        return None

    navigate = getattr(browser, "navigate_to", None)
    if not callable(navigate):
        return None

    emit(
        {
            "ok": True,
            "type": "status",
            "status": "running",
            "id": session_id,
            "message": f"Opening {url}.",
            "action": "navigate",
            "currentUrl": url,
        }
    )

    start = getattr(browser, "start", None)
    if callable(start):
        await asyncio.wait_for(maybe_await(start()), timeout=20)

    try:
        await asyncio.wait_for(maybe_await(navigate(url)), timeout=20)
    except asyncio.TimeoutError:
        emit(
            {
                "ok": False,
                "type": "error",
                "status": "timeout",
                "id": session_id,
                "message": f"Timed out while opening {url}; checking current page state.",
                "action": "navigate",
                "currentUrl": url,
            }
        )
    state = await current_page_state(browser)
    title = state.get("title")
    current_url = state.get("currentUrl") or url
    summary = f"Opened {title} at {current_url}." if title else f"Opened {current_url}."
    emit(
        {
            "ok": True,
            "type": "status",
            "status": "running",
            "id": session_id,
            "message": summary,
            "summary": summary,
            "action": "navigate",
            **state,
        }
    )
    return summary


async def run_agent_once(
    browser_use_module: Any,
    instruction: str,
    strategy: str,
    browser: Any,
    llm: Any,
    tools: Any,
    timeout_ms: int,
    session_id: str | None,
) -> str:
    Agent = getattr(browser_use_module, "Agent")
    task = build_agent_task(instruction, strategy)
    kwargs: dict[str, Any] = {
        "task": task,
        "llm": llm,
        "browser": browser,
    }
    if tools:
        kwargs["tools"] = tools

    try:
        agent = Agent(**kwargs)
    except TypeError:
        kwargs.pop("browser", None)
        kwargs["browser_session"] = browser
        agent = Agent(**kwargs)

    emit(
        {
            "ok": True,
            "type": "status",
            "status": "running",
            "id": session_id,
            "message": "Browser agent is running.",
            "action": "agent_run",
        }
    )

    history = await asyncio.wait_for(agent.run(), timeout=max(5, timeout_ms // 1000))
    summary = extract_history_summary(history)
    state = await current_page_state(browser)
    if summary.startswith("AgentHistoryList") and state.get("title"):
        summary = f"Current page: {state.get('title')} at {state.get('currentUrl') or 'the browser URL'}."
    emit(
        {
            "ok": True,
            "type": "status",
            "status": "running",
            "id": session_id,
            "message": summary,
            "summary": summary,
            "action": "agent_result",
            **state,
        }
    )
    return summary


async def run_with_approval(
    browser_use_module: Any,
    instruction: str,
    strategy: str,
    browser: Any,
    llm: Any,
    tools: Any,
    timeout_ms: int,
    session_id: str | None,
) -> str | None:
    if (
        strategy == "open-only"
        and parse_bool(os.getenv("BROWSER_USE_DIRECT_NAVIGATION"), False)
        and is_simple_navigation_task(instruction)
    ):
        direct_summary = await run_direct_navigation(browser, instruction, session_id)
        if direct_summary:
            return direct_summary

    return await run_agent_once(browser_use_module, instruction, strategy, browser, llm, tools, timeout_ms, session_id)


async def command_loop(
    browser_use_module: Any,
    strategy: str,
    browser: Any,
    llm: Any,
    tools: Any,
    timeout_ms: int,
    session_id: str | None,
) -> None:
    emit(
        {
            "ok": True,
            "type": "status",
            "status": "running",
            "id": session_id,
            "message": "Browser session is open for follow-up commands.",
            "action": "keep_open",
            **(await current_page_state(browser)),
        }
    )

    while True:
        raw = await read_stdin_line()
        if raw is None:
            continue

        normalized = raw.strip()
        if not normalized:
            continue

        if normalized.lower() in STOP_COMMANDS:
            emit(
                {
                    "ok": True,
                    "type": "status",
                    "status": "closed",
                    "id": session_id,
                    "message": "Browser session closed.",
                    "action": "close",
                    **(await current_page_state(browser)),
                }
            )
            return

        if normalized.lower().startswith("approve:") or normalized.lower() == "approve":
            emit(
                {
                    "ok": True,
                    "type": "status",
                    "status": "running",
                    "id": session_id,
                    "message": "There is no pending approval right now.",
                    "action": "approval",
                }
            )
            continue

        instruction = command_to_instruction(normalized)
        if not instruction:
            emit({"ok": False, "type": "error", "status": "failed", "id": session_id, "error": "Unknown browser command."})
            continue

        try:
            await run_with_approval(browser_use_module, instruction, strategy, browser, llm, tools, timeout_ms, session_id)
        except asyncio.TimeoutError:
            emit(
                {
                    "ok": False,
                    "type": "error",
                    "status": "timeout",
                    "id": session_id,
                    "error": f"Browser command exceeded {timeout_ms}ms.",
                    "action": "timeout",
                }
            )
        except Exception as error:
            emit(
                {
                    "ok": False,
                    "type": "error",
                    "status": "failed",
                    "id": session_id,
                    "error": str(error),
                    "action": "command_failed",
                }
            )


async def main() -> int:
    parser = argparse.ArgumentParser(description="Run a local Rearvy browser-use task.")
    parser.add_argument("legacy_task", nargs="?", help="Task text for backward compatibility.")
    parser.add_argument("--task", dest="task", help="Browser task to run.")
    parser.add_argument("--id", dest="session_id", help="Rearvy browser session id.")
    parser.add_argument("--keep-open", action="store_true", help="Keep the browser open for follow-up commands.")
    parser.add_argument("--timeout-ms", type=int, default=int(os.getenv("BROWSER_USE_TIMEOUT_MS") or "60000"))
    parser.add_argument(
        "--strategy",
        choices=["goal-seeking", "open-only"],
        default=os.getenv("BROWSER_USE_STRATEGY") or "goal-seeking",
        help="Browser task strategy.",
    )
    parser.add_argument(
        "--connection-method",
        choices=["managed-runner", "cdp-direct"],
        default=os.getenv("BROWSER_USE_CONNECTION_METHOD") or "managed-runner",
        help="Browser connection method for browser-use.",
    )
    parser.add_argument("--cdp-url", default=os.getenv("BROWSER_USE_CDP_URL"), help="Browser DevTools Protocol URL.")
    args = parser.parse_args()

    load_env_files()

    task = args.task or args.legacy_task or os.getenv("BROWSER_USE_TASK")
    if not task:
        emit({"ok": False, "type": "error", "status": "failed", "id": args.session_id, "error": "No browser task provided."})
        return 1

    browser = None
    try:
        emit(
            {
                "ok": True,
                "type": "status",
                "status": "initializing",
                "id": args.session_id,
                "message": "Initializing local browser-use runtime.",
                "action": "setup",
                "connectionMethod": args.connection_method,
                "connectedBrowser": {"name": "CDP browser"} if args.connection_method == "cdp-direct" else None,
            }
        )

        try:
            import browser_use as browser_use_module
        except Exception as error:
            emit(
                {
                    "ok": False,
                    "type": "error",
                    "status": "setup_error",
                    "id": args.session_id,
                    "setupError": "Could not import browser-use. Run `uv run --project scripts/browser-use python runner.py --help` to install dependencies.",
                    "error": str(error),
                    "action": "setup",
                }
            )
            return 2

        llm = make_llm(browser_use_module)
        browser = make_browser(browser_use_module, args.connection_method, args.cdp_url)
        tools = make_tools(browser_use_module, args.session_id)

        summary = await run_with_approval(
            browser_use_module,
            task,
            args.strategy,
            browser,
            llm,
            tools,
            args.timeout_ms,
            args.session_id,
        )

        if summary is None:
            emit(
                {
                    "ok": False,
                    "type": "status",
                    "status": "rejected",
                    "id": args.session_id,
                    "message": "Browser task was not approved.",
                    "awaitingApproval": None,
                }
            )
            return 0

        if args.keep_open:
            await command_loop(browser_use_module, args.strategy, browser, llm, tools, args.timeout_ms, args.session_id)
        else:
            emit(
                {
                    "ok": True,
                    "type": "status",
                    "status": "completed",
                    "id": args.session_id,
                    "message": summary,
                    "summary": summary,
                    **(await current_page_state(browser)),
                }
            )

        return 0
    except asyncio.TimeoutError:
        emit(
            {
                "ok": False,
                "type": "error",
                "status": "timeout",
                "id": args.session_id,
                "error": f"Browser task exceeded {args.timeout_ms}ms.",
                "action": "timeout",
            }
        )
        return 3
    except Exception as error:
        emit(
            {
                "ok": False,
                "type": "error",
                "status": "setup_error" if "key" in str(error).lower() else "failed",
                "id": args.session_id,
                "setupError": str(error) if "key" in str(error).lower() else None,
                "error": str(error),
                "action": "failed",
            }
        )
        return 1
    finally:
        if not args.keep_open:
            await close_browser(browser)


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
