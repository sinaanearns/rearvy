from __future__ import annotations

import asyncio
import json
import os
import sys
from pathlib import Path
from typing import Literal

os.environ.setdefault("BROWSER_USE_SETUP_LOGGING", "false")
os.environ.setdefault(
    "BROWSER_USE_CONFIG_DIR",
    str((Path.cwd() / ".browser-use-runtime" / "config").resolve()),
)

from pydantic import BaseModel, Field

from browser_use import (
    Agent,
    Browser,
    ChatAnthropic,
    ChatBrowserUse,
    ChatGoogle,
    ChatGroq,
    ChatOpenAI,
)

DEFAULT_BROWSER_USE_MODEL = "bu-2-0"
VALID_BROWSER_USE_MODELS = {"bu-latest", "bu-1-0", "bu-2-0"}
DEFAULT_NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1"
DEFAULT_NVIDIA_MODEL = "mistralai/ministral-14b-instruct-2512"
DEFAULT_OPENAI_MODEL = "gpt-4.1-mini"
DEFAULT_GOOGLE_MODEL = "gemini-2.5-flash"
DEFAULT_ANTHROPIC_MODEL = "claude-3-5-haiku-latest"
DEFAULT_GROQ_MODEL = "moonshotai/kimi-k2-instruct"
NON_MULTIMODAL_MODEL_HINTS = (
    "kimi-k2",
    "kimi_k2",
    "ministral",
    "mistral",
    "gemma-4-31b-it",
)


class CredentialInput(BaseModel):
    label: str | None = None
    login: str
    password: str


class RunnerInput(BaseModel):
    task: str
    service: str | None = None
    startUrl: str | None = None
    credential: CredentialInput | None = None
    maxSteps: int = 30
    headless: bool = True
    useCloudBrowser: bool = True
    runtimeDir: str | None = None


class BrowserTaskResult(BaseModel):
    ok: bool = True
    status: Literal["completed", "partial", "needs_input", "blocked", "failed"]
    summary: str
    blocker: str | None = None
    followUpQuestions: list[str] = Field(default_factory=list)
    createdEntities: list[str] = Field(default_factory=list)
    finalUrl: str | None = None
    notes: list[str] = Field(default_factory=list)
    errors: list[str] = Field(default_factory=list)


def read_env(name: str) -> str | None:
    raw_value = os.getenv(name)
    if not raw_value:
        return None

    cleaned = raw_value.strip().strip("\"'")
    return cleaned or None


def read_first_env(*names: str) -> str | None:
    for name in names:
        value = read_env(name)
        if value:
            return value

    return None


def resolve_browser_use_model() -> tuple[str, str | None]:
    raw_value = read_env("BROWSER_USE_MODEL") or ""
    if not raw_value:
        return DEFAULT_BROWSER_USE_MODEL, None

    if (
        raw_value in VALID_BROWSER_USE_MODELS
        or raw_value.startswith("browser-use/")
    ):
        return raw_value, None

    return (
        DEFAULT_BROWSER_USE_MODEL,
        (
            f'Ignored invalid BROWSER_USE_MODEL "{raw_value}" and fell back to '
            f'"{DEFAULT_BROWSER_USE_MODEL}". Valid values are '
            "bu-latest, bu-1-0, bu-2-0, or models prefixed with browser-use/."
        ),
    )


def with_note(result: BrowserTaskResult, note: str | None) -> BrowserTaskResult:
    if not note:
        return result

    return result.model_copy(update={"notes": [*result.notes, note]})


def with_notes(result: BrowserTaskResult, notes: list[str]) -> BrowserTaskResult:
    safe_notes = [note for note in notes if note]
    if not safe_notes:
        return result

    deduped_notes = list(dict.fromkeys([*result.notes, *safe_notes]))
    return result.model_copy(update={"notes": deduped_notes})


def dedupe_messages(items: list[str]) -> list[str]:
    return list(dict.fromkeys([item for item in items if item]))


def resolve_agent_vision_mode(
    model_name: str | None,
) -> tuple[bool | Literal["auto"], list[str]]:
    raw_override = read_env("BROWSER_USE_USE_VISION")
    notes: list[str] = []

    if raw_override:
        normalized_override = raw_override.lower()
        if normalized_override in {"true", "1", "yes", "on"}:
            notes.append("Browser Use vision was enabled via BROWSER_USE_USE_VISION.")
            return True, notes
        if normalized_override in {"false", "0", "no", "off"}:
            notes.append("Browser Use vision was disabled via BROWSER_USE_USE_VISION.")
            return False, notes
        if normalized_override == "auto":
            notes.append("Browser Use vision is running in auto mode via BROWSER_USE_USE_VISION.")
            return "auto", notes

        notes.append(
            f'Ignored invalid BROWSER_USE_USE_VISION value "{raw_override}". '
            "Use true, false, or auto."
        )

    model_lower = (model_name or "").lower()
    if any(hint in model_lower for hint in NON_MULTIMODAL_MODEL_HINTS):
        notes.append(
            f'Browser Use vision was disabled because "{model_name}" does not accept image input.'
        )
        return False, notes

    return True, notes


def build_llm():
    provider = (read_env("BROWSER_USE_LLM_PROVIDER") or "auto").lower()
    explicit_model = read_env("BROWSER_USE_LLM_MODEL")

    nvidia_api_key = read_first_env(
        "AI_API_KEY",
        "NVIDIA_API_KEY",
        "Kimi",
        "Gamma",
    )
    openai_api_key = read_env("OPENAI_API_KEY")
    google_api_key = read_env("GOOGLE_API_KEY") or read_env("GEMINI_API_KEY")
    anthropic_api_key = read_env("ANTHROPIC_API_KEY")
    groq_api_key = read_env("GROQ_API_KEY")

    notes: list[str] = []

    if provider == "auto":
        if nvidia_api_key:
            provider = "nvidia"
        elif openai_api_key:
            provider = "openai"
        elif google_api_key:
            provider = "google"
        elif anthropic_api_key:
            provider = "anthropic"
        elif groq_api_key:
            provider = "groq"
        else:
            provider = "browser-use"

    if provider == "browser-use":
        model_name, config_note = resolve_browser_use_model()
        llm = ChatBrowserUse(model=model_name)
        if config_note:
            notes.append(config_note)
        notes.append(f'Using Browser Use gateway model "{model_name}".')
        return llm, notes

    if provider == "nvidia":
        base_url = read_env("BROWSER_USE_LLM_BASE_URL") or DEFAULT_NVIDIA_BASE_URL
        if nvidia_api_key:
            model_name = (
                explicit_model
                or read_env("AI_PROVIDER_MODEL")
                or DEFAULT_NVIDIA_MODEL
            )
            notes.append(
                f'Using NVIDIA OpenAI-compatible model "{model_name}" with the configured NVIDIA-compatible key.'
            )
            return (
                ChatOpenAI(
                    model=model_name,
                    api_key=nvidia_api_key,
                    base_url=base_url,
                ),
                notes,
            )

        raise RuntimeError(
            "BROWSER_USE_LLM_PROVIDER is set to nvidia, but no NVIDIA-compatible API key is configured."
        )

    if provider == "openai":
        if not openai_api_key:
            raise RuntimeError(
                "BROWSER_USE_LLM_PROVIDER is set to openai, but OPENAI_API_KEY is missing."
            )

        model_name = explicit_model or DEFAULT_OPENAI_MODEL
        notes.append(f'Using OpenAI model "{model_name}" for Browser Use.')
        return ChatOpenAI(model=model_name, api_key=openai_api_key), notes

    if provider == "google":
        if not google_api_key:
            raise RuntimeError(
                "BROWSER_USE_LLM_PROVIDER is set to google, but GOOGLE_API_KEY is missing."
            )

        model_name = explicit_model or DEFAULT_GOOGLE_MODEL
        notes.append(f'Using Google model "{model_name}" for Browser Use.')
        return ChatGoogle(model=model_name, api_key=google_api_key), notes

    if provider == "anthropic":
        if not anthropic_api_key:
            raise RuntimeError(
                "BROWSER_USE_LLM_PROVIDER is set to anthropic, but ANTHROPIC_API_KEY is missing."
            )

        model_name = explicit_model or DEFAULT_ANTHROPIC_MODEL
        notes.append(f'Using Anthropic model "{model_name}" for Browser Use.')
        return ChatAnthropic(model=model_name, api_key=anthropic_api_key), notes

    if provider == "groq":
        if not groq_api_key:
            raise RuntimeError(
                "BROWSER_USE_LLM_PROVIDER is set to groq, but GROQ_API_KEY is missing."
            )

        model_name = explicit_model or DEFAULT_GROQ_MODEL
        notes.append(f'Using Groq model "{model_name}" for Browser Use.')
        return ChatGroq(model=model_name, api_key=groq_api_key), notes

    raise RuntimeError(
        "Unsupported BROWSER_USE_LLM_PROVIDER. Use one of: auto, nvidia, browser-use, openai, google, anthropic, groq."
    )


def build_agent_task(payload: RunnerInput) -> str:
    instructions = [
        f"Primary browser task: {payload.task}",
        "You are executing a real browser workflow for a user inside Rearvy.",
        "Return the final result strictly using the provided structured output schema.",
        "If you fully finish the requested web task, set status='completed'.",
        "If you make meaningful progress but cannot fully finish, set status='partial'.",
        "If you need more user information, credentials, or confirmations, set status='needs_input' and add concise follow_up_questions.",
        "If you hit a hard blocker like phone verification, email verification, access denied, or a login that cannot be completed, set status='blocked' and explain the blocker clearly.",
        "If the task crashes or becomes impossible for other reasons, set status='failed'.",
        "Never reveal actual secret values in the summary, blocker, notes, or follow-up questions.",
        "If a page asks for email, username, or login, use the secure placeholder named 'login'.",
        "If a page asks for a password, use the secure placeholder named 'password'.",
        "If the task creates something, add the created names or handles to createdEntities.",
        "Keep the summary concise and factual.",
    ]

    if payload.service:
        instructions.append(f"Target service: {payload.service}")

    if payload.startUrl:
        instructions.append(f"Open this page first: {payload.startUrl}")

    if payload.credential:
        instructions.append(
            "Credentials are available securely through the placeholders 'login' and 'password'."
        )
    else:
        instructions.append(
            "No credentials are currently available. If a login is required, stop and ask for it."
        )

    return "\n".join(instructions)


async def run() -> BrowserTaskResult:
    raw_input = sys.stdin.read()
    payload = RunnerInput.model_validate_json(raw_input)

    if payload.runtimeDir:
        Path(payload.runtimeDir).mkdir(parents=True, exist_ok=True)

    llm, llm_notes = build_llm()
    use_vision, vision_notes = resolve_agent_vision_mode(
        model_name=getattr(llm, "model", None),
    )

    sensitive_data: dict[str, str] | None = None
    if payload.credential:
        sensitive_data = {
            "login": payload.credential.login,
            "password": payload.credential.password,
        }

    browser = Browser(
        use_cloud=payload.useCloudBrowser,
        headless=payload.headless,
    )

    agent = Agent(
        task=build_agent_task(payload),
        llm=llm,
        browser=browser,
        sensitive_data=sensitive_data,
        output_model_schema=BrowserTaskResult,
        use_vision=use_vision,
    )

    history = await agent.run(max_steps=payload.maxSteps)
    structured = history.structured_output
    if structured:
        return with_notes(structured, [*llm_notes, *vision_notes])

    final_result = history.final_result()
    errors = dedupe_messages([error for error in history.errors() if error])
    final_url = None
    try:
        urls = history.urls()
        if urls:
            final_url = urls[-1]
    except Exception:
        final_url = None

    if final_result:
        return with_notes(
            BrowserTaskResult(
                ok=True,
                status="partial" if errors else "completed",
                summary=str(final_result),
                finalUrl=final_url,
                errors=errors,
            ),
            [*llm_notes, *vision_notes],
        )

    return with_notes(
        BrowserTaskResult(
            ok=not errors,
            status="failed" if errors else "partial",
            summary=errors[0] if errors else "Browser task ended without a final result.",
            finalUrl=final_url,
            errors=errors,
        ),
        [*llm_notes, *vision_notes],
    )


def main() -> None:
    try:
        result = asyncio.run(run())
        print(result.model_dump_json())
    except Exception as error:  # noqa: BLE001
        fallback = BrowserTaskResult(
            ok=False,
            status="failed",
            summary="Browser task crashed before completion.",
            errors=[str(error)],
        )
        print(fallback.model_dump_json())


if __name__ == "__main__":
    main()
