#!/usr/bin/env python
"""Rearvy bridge for TauricResearch/TradingAgents.

Reads a JSON payload from stdin and writes exactly one JSON object to stdout.
All third-party output is redirected to stderr so the Next.js caller can parse
stdout reliably.
"""

from __future__ import annotations

import contextlib
import datetime as _dt
import json
import os
import sys
import traceback
from typing import Any


MAX_REPORT_CHARS = 5000


def _truncate(value: Any, limit: int = MAX_REPORT_CHARS) -> str:
    text = "" if value is None else str(value)
    if len(text) <= limit:
        return text
    return f"{text[: limit - 3]}..."


def _read_payload() -> dict[str, Any]:
    raw = sys.stdin.read()
    if not raw.strip():
        return {}
    return json.loads(raw)


def _write(payload: dict[str, Any]) -> None:
    sys.stdout.write(json.dumps(payload, ensure_ascii=False))
    sys.stdout.write("\n")
    sys.stdout.flush()


def _int_env(name: str, fallback: int) -> int:
    value = os.getenv(name)
    if not value:
        return fallback
    try:
        return int(value)
    except ValueError:
        return fallback


def _selected_analysts(payload: dict[str, Any]) -> list[str]:
    configured = payload.get("selectedAnalysts") or os.getenv(
        "TRADINGAGENTS_ANALYSTS",
        "market,news",
    )
    if isinstance(configured, str):
        values = [item.strip().lower() for item in configured.split(",")]
    elif isinstance(configured, list):
        values = [str(item).strip().lower() for item in configured]
    else:
        values = []

    allowed = {"market", "social", "news", "fundamentals"}
    selected = [item for item in values if item in allowed]
    return selected or ["market", "news"]


def _build_config(default_config: dict[str, Any]) -> dict[str, Any]:
    config = default_config.copy()

    provider = os.getenv("TRADINGAGENTS_LLM_PROVIDER")
    if provider:
        config["llm_provider"] = provider

    deep_model = os.getenv("TRADINGAGENTS_DEEP_MODEL") or os.getenv(
        "TRADINGAGENTS_MODEL"
    )
    if deep_model:
        config["deep_think_llm"] = deep_model

    quick_model = os.getenv("TRADINGAGENTS_QUICK_MODEL") or os.getenv(
        "TRADINGAGENTS_MODEL"
    )
    if quick_model:
        config["quick_think_llm"] = quick_model

    backend_url = os.getenv("TRADINGAGENTS_BACKEND_URL")
    if backend_url:
        config["backend_url"] = backend_url

    config["max_debate_rounds"] = _int_env("TRADINGAGENTS_MAX_DEBATE_ROUNDS", 1)
    config["max_risk_discuss_rounds"] = _int_env(
        "TRADINGAGENTS_MAX_RISK_DISCUSS_ROUNDS",
        1,
    )
    config["max_recur_limit"] = _int_env("TRADINGAGENTS_MAX_RECUR_LIMIT", 80)
    config["checkpoint_enabled"] = (
        os.getenv("TRADINGAGENTS_CHECKPOINT_ENABLED", "false").lower() == "true"
    )

    output_language = os.getenv("TRADINGAGENTS_OUTPUT_LANGUAGE")
    if output_language:
        config["output_language"] = output_language

    return config


def main() -> int:
    payload = _read_payload()
    repo_path = os.getenv("TRADINGAGENTS_REPO_PATH")
    if repo_path:
        sys.path.insert(0, repo_path)

    try:
        with contextlib.redirect_stdout(sys.stderr):
            from tradingagents.default_config import DEFAULT_CONFIG
            from tradingagents.graph.trading_graph import TradingAgentsGraph

            ticker = str(payload.get("ticker") or payload.get("symbol") or "").strip()
            if not ticker:
                raise ValueError("Missing ticker")

            trade_date = str(payload.get("tradeDate") or "").strip()
            if not trade_date:
                trade_date = _dt.date.today().isoformat()

            config = _build_config(DEFAULT_CONFIG)
            analysts = _selected_analysts(payload)
            graph = TradingAgentsGraph(
                selected_analysts=analysts,
                debug=False,
                config=config,
            )
            state, decision = graph.propagate(ticker, trade_date)

        final_decision = ""
        reports: dict[str, str] = {}
        if isinstance(state, dict):
            final_decision = _truncate(state.get("final_trade_decision"))
            reports = {
                "market": _truncate(state.get("market_report"), 2500),
                "sentiment": _truncate(state.get("sentiment_report"), 2500),
                "news": _truncate(state.get("news_report"), 2500),
                "fundamentals": _truncate(state.get("fundamentals_report"), 2500),
                "trader": _truncate(state.get("trader_investment_plan"), 2500),
            }

        _write(
            {
                "ok": True,
                "ticker": payload.get("ticker") or payload.get("symbol"),
                "tradeDate": payload.get("tradeDate"),
                "decision": str(decision),
                "finalDecision": final_decision,
                "reports": reports,
                "provider": os.getenv("TRADINGAGENTS_LLM_PROVIDER")
                or config.get("llm_provider"),
                "deepModel": config.get("deep_think_llm"),
                "quickModel": config.get("quick_think_llm"),
                "selectedAnalysts": analysts,
            }
        )
        return 0
    except Exception as error:
        _write(
            {
                "ok": False,
                "error": str(error),
                "errorType": error.__class__.__name__,
                "traceback": traceback.format_exc(limit=8),
            }
        )
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
