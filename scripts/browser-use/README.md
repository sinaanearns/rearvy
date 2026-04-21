# Browser Use Runtime

This folder contains the pinned Python runtime for Rearvy's browser automation.

Setup:

```bash
uv sync --project scripts/browser-use
uv run --project scripts/browser-use browser-use install
uv run --project scripts/browser-use browser-use doctor
```

The app runs [browser-use/browser-use](https://github.com/browser-use/browser-use)
through this project so Browser Use versions stay explicit and repeatable.
