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
For explicit signup or login tasks where email and password credentials are provided in
the task description, fill in all required form fields and submit the form autonomously —
the user's request to sign up or log in is itself the approval. Report clearly when done
or explain exactly what went wrong if it fails.
Before any OTHER risky action — uploading files, deleting data, sending messages, posting
content, starting a purchase, checking out, or saving payment details — call
request_user_approval with a specific reason. If approval is not granted, stop and explain.
If a CAPTCHA, 2FA code, OTP, or recovery code is required, pause and keep the browser
open. Tell the user exactly what is blocking completion so they can resolve it.
Never solve CAPTCHAs, bypass paywalls, bypass security interstitials, or complete a
final password-change step.
""".strip()

GOAL_SEEKING_INSTRUCTION = """
Bounded fallback order:
1. Open the start URL or most likely target URL.
2. Read the full page text and inspect links, buttons, and forms.
3. Try the safest matching signup/login/goal candidate on the current page.
4. Scroll and inspect again if the candidate is not visible.
5. Try likely same-site routes such as /signup, /sign-up, /register, /start, /login, or /admin only when relevant.
6. Stop with a concise attempted-method summary when the target cannot be found.
For signup/login/account tasks, if credentials (such as email/password) are provided in the task description or user inputs, you should enter them and click the signup/login/submit button to proceed. Call request_user_approval before entering or submitting credentials. If a required password, OTP, recovery code, or payment detail is missing or not provided, or if a CAPTCHA or 2FA is encountered, call request_user_approval or pause and wait for the user to complete it, keeping the browser open.
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


# Model-name prefixes that are hosted on the NVIDIA API, not on OpenAI.
# When BROWSER_USE_MODEL is set to one of these, route to NVIDIA even if
# OPENAI_API_KEY is also present in the environment.
NVIDIA_MODEL_NAME_PREFIXES = (
    "moonshotai/",
    "nvidia/",
    "deepseek-ai/",
    "z-ai/",
    "stepfun-ai/",
    "qwen/",
    "mistralai/",
    "meta/",
    "google/",
    "microsoft/",
)


def is_nvidia_model_name(model: str) -> bool:
    """Return True if the model name is hosted on NVIDIA's API, not OpenAI."""
    lower = (model or "").lower()
    return any(lower.startswith(prefix) for prefix in NVIDIA_MODEL_NAME_PREFIXES)


def choose_provider() -> tuple[str, str]:
    requested = os.getenv("BROWSER_USE_LLM_PROVIDER", "").strip().lower()
    providers = [requested] if requested else []

    explicit_model = (
        os.getenv("BROWSER_USE_MODEL", "").strip()
        or os.getenv("NVIDIA_MODEL", "").strip()
        or os.getenv("NVIDIA_CHAT_MODEL", "").strip()
    )

    has_openai = bool(os.getenv("OPENAI_API_KEY", "").strip())
    has_google = bool(
        os.getenv("GOOGLE_API_KEY", "").strip()
        or os.getenv("GEMINI_API_KEY", "").strip()
    )
    has_nvidia = bool(
        get_nvidia_api_key(explicit_model)
        or os.getenv("NVIDIA_API_KEY", "").strip()
    )

    # Non-tool-supporting models on NVIDIA's endpoint return 404 for function calls.
    is_non_tool_nvidia = bool(
        explicit_model
        and any(
            explicit_model.lower().startswith(p)
            for p in ("moonshotai/", "deepseek-ai/", "z-ai/", "stepfun-ai/")
        )
    )

    if is_non_tool_nvidia and not requested:
        if has_openai:
            return "openai", os.getenv("OPENAI_MODEL") or "gpt-4o-mini"
        if has_google:
            return "google", os.getenv("GOOGLE_MODEL") or "gemini-2.0-flash"
        if has_nvidia:
            return "nvidia", "meta/llama-3.3-70b-instruct"

    if explicit_model and is_nvidia_model_name(explicit_model) and not requested:
        providers = ["nvidia"] + [p for p in providers if p != "nvidia"]
    else:
        providers.extend(["openai", "google", "nvidia"])

    seen: set[str] = set()
    for provider in providers:
        if not provider or provider in seen:
            continue
        seen.add(provider)

        if provider == "openai" and has_openai:
            model = (
                os.getenv("BROWSER_USE_MODEL")
                or os.getenv("OPENAI_MODEL")
                or "gpt-4o-mini"
            )
            if is_nvidia_model_name(model):
                model = "gpt-4o-mini"
            return "openai", model

        if provider in {"google", "gemini"} and has_google:
            model = (
                os.getenv("BROWSER_USE_MODEL")
                or os.getenv("GOOGLE_MODEL")
                or "gemini-2.0-flash"
            )
            if is_nvidia_model_name(model):
                model = "gemini-2.0-flash"
            return "google", model

        if provider == "nvidia" and has_nvidia:
            model = (
                os.getenv("BROWSER_USE_MODEL")
                or os.getenv("NVIDIA_MODEL")
                or os.getenv("NVIDIA_CHAT_MODEL")
                or "meta/llama-3.3-70b-instruct"
            )
            if any(
                model.lower().startswith(p)
                for p in ("moonshotai/", "deepseek-ai/", "z-ai/", "stepfun-ai/")
            ):
                model = "meta/llama-3.3-70b-instruct"
            return "nvidia", model

    raise RuntimeError(
        "Browser automation needs one local LLM key. Set OPENAI_API_KEY, "
        "GOOGLE_API_KEY, or NVIDIA_API_KEY in .env.local."
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
            # NVIDIA's OpenAI-compatible endpoint does not support parallel function
            # call registration (returns 404 for registered function UUIDs). Disable
            # parallel_tool_calls and set temperature=0 for deterministic tool routing.
            nvidia_kwargs: dict[str, Any] = {
                "model": model,
                "api_key": get_nvidia_api_key(model),
                "base_url": "https://integrate.api.nvidia.com/v1",
                "temperature": 0,
            }
            try:
                return chat_openai(**nvidia_kwargs, parallel_tool_calls=False)
            except TypeError:
                return chat_openai(**nvidia_kwargs)

    try:
        from langchain_openai import ChatOpenAI

        if provider == "openai":
            return ChatOpenAI(model=model, api_key=os.getenv("OPENAI_API_KEY"), temperature=0)
        if provider == "nvidia":
            nvidia_kwargs2: dict[str, Any] = {
                "model": model,
                "api_key": get_nvidia_api_key(model),
                "base_url": "https://integrate.api.nvidia.com/v1",
                "temperature": 0,
            }
            try:
                return ChatOpenAI(**nvidia_kwargs2, parallel_tool_calls=False)
            except TypeError:
                return ChatOpenAI(**nvidia_kwargs2)
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
    """
    Build the browser-use Browser/BrowserSession object.

    Optional env-var enhancements:
      CLOAK_BROWSER_ENABLED=true  — use the CloakBrowser stealth Chromium binary.
                                    (cloakbrowser.ensure_browser() downloads it on first use)
      BROWSER_USE_PROXY=<url>     — route all traffic through an HTTP or SOCKS5 proxy.
      BROWSER_USE_SYSTEM_CHROME   — use Browser.from_system_chrome() instead of launching.
    """
    browser_class = getattr(browser_use_module, "Browser", None) or getattr(browser_use_module, "BrowserSession", None)
    if not browser_class:
        raise RuntimeError("browser-use did not expose Browser or BrowserSession.")

    kwargs: dict[str, Any] = {
        "headless": parse_bool(os.getenv("BROWSER_USE_HEADLESS"), True),
        "keep_alive": True,
        "window_size": {
            "width": int(os.getenv("BROWSER_USE_WIDTH") or "1280"),
            "height": int(os.getenv("BROWSER_USE_HEIGHT") or "900"),
        },
    }

    user_data_dir = os.getenv("BROWSER_USE_USER_DATA_DIR")
    if not user_data_dir:
        default_profile_dir = Path.home() / ".rearvy" / "browser-profile"
        try:
            default_profile_dir.mkdir(parents=True, exist_ok=True)
            user_data_dir = str(default_profile_dir)
        except Exception:
            user_data_dir = None

    if user_data_dir:
        kwargs["user_data_dir"] = user_data_dir

    channel = os.getenv("BROWSER_USE_CHANNEL")
    if channel:
        kwargs["channel"] = channel

    # ── CloakBrowser stealth mode ──────────────────────────────────────────────
    # When CLOAK_BROWSER_ENABLED=true the standard Playwright Chromium is replaced
    # with the CloakBrowser binary (source-level C++ patches for canvas, WebGL,
    # audio, WebRTC and font fingerprinting) to bypass bot-detection systems.
    # The binary is automatically downloaded to the user cache on first run.
    if parse_bool(os.getenv("CLOAK_BROWSER_ENABLED"), False):
        try:
            import cloakbrowser  # type: ignore[import-untyped]
            cloak_binary = cloakbrowser.ensure_browser()
            kwargs["executable_path"] = str(cloak_binary)
            emit({
                "ok": True,
                "type": "status",
                "status": "running",
                "message": "CloakBrowser stealth mode active.",
                "action": "setup",
            })
        except Exception as cloak_err:
            emit({
                "ok": True,
                "type": "status",
                "status": "running",
                "message": (
                    f"CloakBrowser requested but unavailable ({cloak_err}). "
                    "Run `uv sync --project scripts/browser-use` to install it. "
                    "Falling back to default Chromium."
                ),
                "action": "setup",
            })

    # ── Proxy routing ──────────────────────────────────────────────────────────
    # Set BROWSER_USE_PROXY to an HTTP or SOCKS5 proxy URL, e.g.:
    #   http://user:pass@proxy-host:8080
    #   socks5://user:pass@proxy-host:1080
    proxy_url = os.getenv("BROWSER_USE_PROXY", "").strip()
    if proxy_url:
        kwargs["proxy"] = proxy_url

    # ── CDP-direct mode ────────────────────────────────────────────────────────
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

    # Detect whether the LLM is pointed at NVIDIA's OpenAI-compatible endpoint.
    # NVIDIA's API does not support browser-use's function-UUID registration
    # mechanism: every custom tool call returns
    #   404 – "Function '<uuid>': Not found for account '<id>'"
    # because the UUID is generated client-side but never registered server-side.
    # We detect this via the base_url stored inside the ChatOpenAI client object
    # or via the model name (which contains a vendor prefix like "moonshotai/").
    _llm_base_url = (
        getattr(llm, "openai_api_base", None)
        or getattr(getattr(llm, "client", None), "base_url", None)
        or getattr(getattr(llm, "_client", None), "base_url", None)
        or ""
    )
    _llm_model = getattr(llm, "model_name", None) or getattr(llm, "model", None) or ""
    is_nvidia_endpoint = (
        "nvidia.com" in str(_llm_base_url).lower()
        or "integrate.api.nvidia" in str(_llm_base_url).lower()
        or is_nvidia_model_name(str(_llm_model))
    )

    kwargs: dict[str, Any] = {
        "task": task,
        "llm": llm,
        "browser": browser,
    }

    if tools and not is_nvidia_endpoint:
        # Custom tool registration uses function UUIDs that NVIDIA's API rejects.
        # Skip the tools when running on the NVIDIA endpoint so the agent can
        # complete its steps using its built-in Playwright actions instead.
        kwargs["tools"] = tools

    if is_nvidia_endpoint:
        # Request JSON-mode tool calling so the model doesn't try to invoke
        # server-registered function UUIDs.
        kwargs["tool_calling_method"] = "auto"

    def _make_agent(kw: dict) -> Any:
        """Try all known Agent constructor signatures in order."""
        try:
            return Agent(**kw)
        except TypeError:
            kw2 = dict(kw)
            kw2.pop("tool_calling_method", None)
            try:
                return Agent(**kw2)
            except TypeError:
                kw3 = dict(kw2)
                kw3.pop("browser", None)
                kw3["browser_session"] = browser
                try:
                    return Agent(**kw3)
                except TypeError:
                    kw3.pop("tool_calling_method", None)
                    return Agent(**kw3)

    agent = _make_agent(kwargs)

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
