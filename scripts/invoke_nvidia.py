from pathlib import Path
import requests
import base64
import os
import sys
import json

INVOKE_URL = "https://integrate.api.nvidia.com/v1/chat/completions"

IMAGE_MIME_TYPES = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
}


def find_image_path(index: int) -> Path:
    for suffix in IMAGE_MIME_TYPES:
        path = Path(f"image_{index}{suffix}")
        if path.exists():
            return path
    raise FileNotFoundError(f"Expected image_{index}.png/.jpg/.jpeg/.webp")


def read_image_data_url(path: Path) -> str:
    with open(path, "rb") as f:
        image_b64 = base64.b64encode(f.read()).decode()
    return f"data:{IMAGE_MIME_TYPES[path.suffix.lower()]};base64,{image_b64}"


def build_headers(api_key: str | None = None, stream: bool = False) -> dict:
    if not api_key:
        api_key = os.getenv("NVIDIA_API_KEY")
    if not api_key:
        raise RuntimeError("NVIDIA_API_KEY not set in environment and not provided explicitly")
    return {
        "Authorization": f"Bearer {api_key}",
        "Accept": "text/event-stream" if stream else "application/json",
        "Content-Type": "application/json",
    }


def invoke(
    model: str = "stepfun-ai/step-3.7-flash",
    messages: list | None = None,
    max_tokens: int = 16384,
    temperature: float = 1.0,
    top_p: float = 0.95,
    stream: bool = False,
    api_key: str | None = None,
):
    headers = build_headers(api_key, stream)

    payload = {
        "model": model,
        "messages": messages or [{"role": "user", "content": ""}],
        "max_tokens": max_tokens,
        "temperature": temperature,
        "top_p": top_p,
        "stream": stream,
    }

    response = requests.post(INVOKE_URL, headers=headers, json=payload, stream=stream)
    if stream:
        for line in response.iter_lines():
            if line:
                try:
                    print(line.decode("utf-8"))
                except Exception:
                    print(line)
    else:
        try:
            print(json.dumps(response.json(), indent=2))
        except Exception:
            print(response.text)


if __name__ == "__main__":
    # Usage: python scripts/invoke_nvidia.py [message...]
    # Make sure NVIDIA_API_KEY is set in your environment, e.g. `export NVIDIA_API_KEY=nvapi-...` or in Windows PowerShell:
    # $env:NVIDIA_API_KEY = 'nvapi-...'
    message = " ".join(sys.argv[1:]).strip() or "Hello from invoke_nvidia.py"
    invoke(messages=[{"role": "user", "content": message}])
