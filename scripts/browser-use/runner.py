from __future__ import annotations

import asyncio
import ast
import json
import os
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal

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
DEFAULT_NVIDIA_VISION_MODEL = "meta/llama-3.2-11b-vision-instruct"
DEFAULT_NVIDIA_STRUCTURED_OUTPUT_BACKEND = "outlines"
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


def normalize_structured_json_content(value: str) -> str:
    stripped = value.strip()
    if stripped.startswith("```"):
        lines = stripped.splitlines()
        if lines:
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        stripped = "\n".join(lines).strip()

    return stripped


def extract_balanced_json_candidate(value: str) -> str | None:
    start_index = -1
    opening_brace = ""
    closing_brace = ""

    for index, char in enumerate(value):
        if char == "{":
            start_index = index
            opening_brace = "{"
            closing_brace = "}"
            break
        if char == "[":
            start_index = index
            opening_brace = "["
            closing_brace = "]"
            break

    if start_index < 0:
        return None

    depth = 0
    in_string = False
    escape_next = False
    string_delimiter = ""

    for index in range(start_index, len(value)):
        char = value[index]

        if escape_next:
            escape_next = False
            continue

        if char == "\\":
            escape_next = True
            continue

        if in_string:
            if char == string_delimiter:
                in_string = False
            continue

        if char in {'"', "'"}:
            in_string = True
            string_delimiter = char
            continue

        if char == opening_brace:
            depth += 1
            continue

        if char == closing_brace:
            depth -= 1
            if depth == 0:
                return value[start_index : index + 1]

    return None


def parse_assignment_block(value: str) -> dict[str, object] | None:
    parsed: dict[str, object] = {}

    for raw_line in value.splitlines():
        line = raw_line.strip().rstrip(",")
        if not line or "=" not in line:
            continue

        key, expression = line.split("=", 1)
        key = key.strip()
        expression = expression.strip()
        if not key or not expression:
            continue

        try:
            parsed[key] = ast.literal_eval(expression)
        except Exception:
            return None

    return parsed or None


def coerce_json_like_text(value: str) -> str | None:
    normalized = normalize_structured_json_content(value)
    if not normalized:
        return None

    for candidate in (normalized, extract_balanced_json_candidate(normalized)):
        if not candidate:
            continue

        try:
            parsed = json.loads(candidate)
            return json.dumps(parsed)
        except Exception:
            pass

        try:
            parsed = ast.literal_eval(candidate)
            return json.dumps(parsed)
        except Exception:
            pass

    assignment_block = parse_assignment_block(normalized)
    if assignment_block is not None:
        return json.dumps(assignment_block)

    return None


def _schema_required_keys(schema: object) -> set[str]:
    if not isinstance(schema, dict):
        return set()

    required = schema.get("required")
    if not isinstance(required, list):
        return set()

    return {item for item in required if isinstance(item, str)}


def _schema_property_keys(schema: object) -> set[str]:
    if not isinstance(schema, dict):
        return set()

    properties = schema.get("properties")
    if not isinstance(properties, dict):
        return set()

    return {key for key in properties.keys() if isinstance(key, str)}


def _looks_like_json_schema_object(value: object) -> bool:
    if not isinstance(value, dict):
        return False

    schema_keywords = {
        "$schema",
        "$id",
        "$defs",
        "definitions",
        "type",
        "title",
        "description",
        "properties",
        "required",
        "items",
        "additionalProperties",
        "oneOf",
        "anyOf",
        "allOf",
        "$ref",
    }

    keys = set(value.keys())
    return "properties" in value and "type" in value and keys.issubset(schema_keywords)


def _structured_output_matches_schema(candidate: object, schema: object) -> bool:
    if schema is None:
        return True

    if _looks_like_json_schema_object(candidate):
        return False

    required_keys = _schema_required_keys(schema)
    property_keys = _schema_property_keys(schema)

    if isinstance(candidate, dict):
        candidate_keys = set(candidate.keys())
        if required_keys and not required_keys.issubset(candidate_keys):
            return False

        if property_keys and not candidate_keys.intersection(property_keys):
            return False

    return True


class _StructuredOutputCompletionsProxy:
    def __init__(
        self,
        completions: Any,
        structured_output_extra_body: dict[str, object] | None,
    ) -> None:
        self._completions = completions
        self._structured_output_extra_body = structured_output_extra_body or {}

    async def _repair_structured_output(
        self,
        content: str,
        schema: object,
        args: tuple[Any, ...],
        kwargs: dict[str, Any],
        extra_body: dict[str, object] | None,
    ):
        original_messages = kwargs.get("messages")
        if not isinstance(original_messages, list):
            return None

        repair_messages = [
            *original_messages,
            {"role": "assistant", "content": content},
            {
                "role": "user",
                "content": (
                    "Your previous reply was invalid. Return only a valid JSON object "
                    "matching the required schema. No prose, no markdown, no code "
                    "fences, no variable assignment. Return a JSON instance, not a "
                    "JSON Schema. Do not output schema keywords like properties, "
                    "required, title, or type unless they are actual data fields."
                ),
            },
        ]

        if isinstance(schema, dict):
            repair_messages.append(
                {
                    "role": "user",
                    "content": (
                        "Schema to satisfy (for validation only): "
                        f"{json.dumps(schema, ensure_ascii=True)}"
                    ),
                }
            )

        repair_kwargs = {**kwargs, "messages": repair_messages}
        return await self._completions.create(
            *args,
            extra_body=extra_body,
            **repair_kwargs,
        )

    async def create(
        self,
        *args: Any,
        extra_body: dict[str, object] | None = None,
        **kwargs: Any,
    ):
        merged_extra_body = extra_body
        schema = None
        if kwargs.get("response_format") is not None and self._structured_output_extra_body:
            response_format = kwargs.get("response_format")
            json_schema = None
            if isinstance(response_format, dict):
                json_schema = response_format.get("json_schema")
            else:
                json_schema = getattr(response_format, "json_schema", None)

            if isinstance(json_schema, dict):
                schema = json_schema.get("schema")
            elif json_schema is not None:
                schema = getattr(json_schema, "schema", None)

            merged_extra_body = {
                **self._structured_output_extra_body,
                **(extra_body or {}),
            }
            if schema is not None:
                merged_extra_body = {
                    "guided_json": schema,
                    **merged_extra_body,
                }
                kwargs = {**kwargs}
                kwargs.pop("response_format", None)

        response = await self._completions.create(
            *args,
            extra_body=merged_extra_body,
            **kwargs,
        )
        if schema is not None and getattr(response, "choices", None):
            for choice in response.choices:
                message = getattr(choice, "message", None)
                content = getattr(message, "content", None)
                if isinstance(content, str):
                    normalized_content = coerce_json_like_text(content)
                    if normalized_content is not None:
                        try:
                            parsed_content = json.loads(normalized_content)
                        except Exception:
                            parsed_content = None

                        if _structured_output_matches_schema(parsed_content, schema):
                            message.content = normalized_content
                            continue

                    repaired_response = await self._repair_structured_output(
                        content=content,
                        schema=schema,
                        args=args,
                        kwargs=kwargs,
                        extra_body=merged_extra_body,
                    )
                    if repaired_response and getattr(repaired_response, "choices", None):
                        repaired_choice = repaired_response.choices[0]
                        repaired_message = getattr(repaired_choice, "message", None)
                        repaired_content = getattr(repaired_message, "content", None)
                        if isinstance(repaired_content, str):
                            normalized_repaired_content = coerce_json_like_text(
                                repaired_content
                            )
                            if normalized_repaired_content is not None:
                                try:
                                    parsed_repaired_content = json.loads(
                                        normalized_repaired_content
                                    )
                                except Exception:
                                    parsed_repaired_content = None

                                if _structured_output_matches_schema(
                                    parsed_repaired_content,
                                    schema,
                                ):
                                    message.content = normalized_repaired_content
                                    continue
                            message.content = normalize_structured_json_content(
                                repaired_content
                            )
                            continue

                    message.content = normalize_structured_json_content(content)

        return response

    def __getattr__(self, name: str) -> Any:
        return getattr(self._completions, name)


class _StructuredOutputChatProxy:
    def __init__(
        self,
        chat: Any,
        structured_output_extra_body: dict[str, object] | None,
    ) -> None:
        self._chat = chat
        self.completions = _StructuredOutputCompletionsProxy(
            chat.completions,
            structured_output_extra_body,
        )

    def __getattr__(self, name: str) -> Any:
        return getattr(self._chat, name)


class _StructuredOutputClientProxy:
    def __init__(
        self,
        client: Any,
        structured_output_extra_body: dict[str, object] | None,
    ) -> None:
        self._client = client
        self.chat = _StructuredOutputChatProxy(
            client.chat,
            structured_output_extra_body,
        )

    def __getattr__(self, name: str) -> Any:
        return getattr(self._client, name)


@dataclass
class RearvyChatOpenAI(ChatOpenAI):
    structured_output_extra_body: dict[str, object] | None = None

    def get_client(self):
        client = super().get_client()
        if not self.structured_output_extra_body:
            return client

        return _StructuredOutputClientProxy(
            client,
            self.structured_output_extra_body,
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
    llmModel: str | None = None
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
    screenshotUrl: str | None = None
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


def get_history_final_url(history: Any) -> str | None:
    try:
        urls = history.urls()
    except Exception:
        return None

    if not urls:
        return None

    final_candidate = urls[-1]
    if isinstance(final_candidate, str) and final_candidate:
        return final_candidate

    return None


def is_non_multimodal_model(model_name: str | None) -> bool:
    model_lower = (model_name or "").lower()
    return any(hint in model_lower for hint in NON_MULTIMODAL_MODEL_HINTS)


def should_prefer_multimodal_model() -> bool:
    raw_override = read_env("BROWSER_USE_USE_VISION")
    if not raw_override:
        return True

    return raw_override.lower() not in {"false", "0", "no", "off"}


def resolve_nvidia_model_name(explicit_model: str | None) -> tuple[str, list[str]]:
    model_name = (
        explicit_model
        or read_env("AI_PROVIDER_MODEL")
        or DEFAULT_NVIDIA_MODEL
    )
    notes: list[str] = []

    if should_prefer_multimodal_model() and is_non_multimodal_model(model_name):
        vision_model = read_env("BROWSER_USE_VISION_MODEL") or DEFAULT_NVIDIA_VISION_MODEL
        if vision_model != model_name:
            notes.append(
                f'Switched Browser Use from text-only model "{model_name}" to '
                f'vision-capable model "{vision_model}" for screenshot reading.'
            )
            model_name = vision_model

    return model_name, notes


def resolve_structured_output_extra_body(
    provider: str,
) -> tuple[dict[str, object] | None, list[str]]:
    explicit_backend = read_env("BROWSER_USE_STRUCTURED_OUTPUT_BACKEND")
    if explicit_backend:
        return (
            {"guided_decoding_backend": explicit_backend},
            [
                "Browser Use structured outputs were configured via "
                f'BROWSER_USE_STRUCTURED_OUTPUT_BACKEND="{explicit_backend}".'
            ],
        )

    if provider == "nvidia":
        return (
            {
                "guided_decoding_backend": DEFAULT_NVIDIA_STRUCTURED_OUTPUT_BACKEND,
            },
            [
                "Browser Use requested the "
                f'"{DEFAULT_NVIDIA_STRUCTURED_OUTPUT_BACKEND}" guided decoding '
                "backend for NVIDIA structured outputs compatibility."
            ],
        )

    return None, []


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

    if is_non_multimodal_model(model_name):
        notes.append(
            f'Browser Use vision was disabled because "{model_name}" does not accept image input.'
        )
        return False, notes

    return True, notes


def build_llm(requested_model: str | None = None):
    provider = (read_env("BROWSER_USE_LLM_PROVIDER") or "auto").lower()
    explicit_model = requested_model or read_env("BROWSER_USE_LLM_MODEL")

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
            model_name, model_notes = resolve_nvidia_model_name(explicit_model)
            structured_output_extra_body, structured_output_notes = (
                resolve_structured_output_extra_body(provider)
            )
            notes.extend(model_notes)
            notes.extend(structured_output_notes)
            notes.append(
                "Browser Use routes NVIDIA structured outputs through the "
                "OpenAI-compatible guided_json path for Mistral tokenizer compatibility."
            )
            notes.append(
                f'Using NVIDIA OpenAI-compatible model "{model_name}" with the configured NVIDIA-compatible key.'
            )
            return (
                RearvyChatOpenAI(
                    model=model_name,
                    api_key=nvidia_api_key,
                    base_url=base_url,
                    structured_output_extra_body=structured_output_extra_body,
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

    llm, llm_notes = build_llm(payload.llmModel)
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
        cdp_url='http://localhost:9222'
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
    latest_screenshot = None
    try:
        screenshots = history.screenshots(return_none_if_not_screenshot=False)
        if screenshots:
            latest_screenshot = screenshots[-1]
    except Exception:
        latest_screenshot = None

    screenshot_data_url = (
        f"data:image/png;base64,{latest_screenshot}" if latest_screenshot else None
    )
    final_url = get_history_final_url(history) or payload.startUrl

    structured = history.structured_output
    if structured:
        structured_updates: dict[str, str] = {}
        if not structured.screenshotUrl and screenshot_data_url:
            structured_updates["screenshotUrl"] = screenshot_data_url
        if not structured.finalUrl and final_url:
            structured_updates["finalUrl"] = final_url
        if structured_updates:
            structured = structured.model_copy(update=structured_updates)
        return with_notes(structured, [*llm_notes, *vision_notes])

    final_result = history.final_result()
    errors = dedupe_messages([error for error in history.errors() if error])

    if final_result:
        return with_notes(
            BrowserTaskResult(
                ok=True,
                status="partial" if errors else "completed",
                summary=str(final_result),
                finalUrl=final_url,
                screenshotUrl=screenshot_data_url,
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
            screenshotUrl=screenshot_data_url,
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
