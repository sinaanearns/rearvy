# Rearvy — LLM Integration Guide

This document helps integrators and prompt engineers use Rearvy as an LLM-first Business Operating System. It provides system prompts, user templates, few-shot examples, JSON schemas, function-call patterns, RAG suggestions, and recommended runtime settings for reliable, automatable outputs.

## High-level goals

- Produce machine-parseable outputs (JSON-first) suitable for automation.
- Offer concise human summaries for readability.
- Support function-call orchestration for idempotent actions.
- Be RAG-friendly: include sources and assumptions when using external facts.

---

## 1. System Prompt (canonical)

Recommended concise system prompt (copyable):

```
You are Rearvy, an AI business operating system. Produce concise, actionable, machine-readable outputs. Respond JSON-first, then a 1–2 sentence human summary. Include `assumptions[]` and `confidence_score` for plans. When applicable, return function-call suggestions with `name` and `arguments` for automation.
```

Notes:
- Keep the system message short and invariant across calls.
- Use the system role to enforce JSON-first policy and output hygiene.

---

## 2. User Prompt Templates

Template: Idea → Launch Plan
```
User: I want to build: <idea>
Audience: <audience>
Constraints: {budget:<n>, timeline_days:<n>}
Deliverable: 90-day launch plan
Output: JSON using `business_plan_v1` schema; then 2-line human summary.
```

Template: Brand + Landing
```
User: Create brand for <idea> with tones [<tone1>,<tone2>] and 3 name options.
Deliverable: `brand_bundle` JSON (names, taglines, voice, 1-page landing HTML snippet).
```

Template: Growth Experiment
```
User: Suggest 3 growth experiments for <vertical>.
Output: JSON array with fields: hypothesis, expected_kpi_delta, steps (actions), measurement, estimated_cost_usd.
```

Guidance:
- Always include `Output:` that names a schema to enforce structure.
- Ask for `cite_sources:true` when factual claims are made.

---

## 3. Few-shot Examples

Example 1 — Meal-planning app (concise)
Input:
```
Idea: Premium meal-planning app for busy professionals.
Budget: 10,000 USD
Timeline: 90 days
Deliverable: 90-day launch plan JSON using `business_plan_v1`.
```
Expected (summary): Two sentences + JSON where `mvp_scope` includes `["basic meal plans","grocery export","one subscription tier"]` and `milestones` at 30/60/90 days.

Example 2 — Brand + Landing
Input: "Create brand for a B2B analytics tool, tones: professional, approachable. Return `brand_bundle` JSON and an HTML hero snippet."

Example 3 — Growth Experiment
Input: "Suggest 3 experiments to increase trial-to-paid conversion for a SaaS product with expected KPI uplift and measurement plan."

---

## 4. JSON Schemas (recommended)

business_plan_v1 (schema excerpt)
```json
{
  "name": "string",
  "one_liner": "string",
  "problem": "string",
  "solution": "string",
  "target_customer": {"persona":"string","pain_points":["string"]},
  "revenue_model": {"type":"string","examples":["string"]},
  "mvp_scope":["string"],
  "milestones":[{"id":"string","title":"string","due_days":0}],
  "estimated_cost_usd":0,
  "confidence_score":0.0,
  "assumptions":["string"]
}
```

brand_bundle (schema excerpt)
```json
{
  "names":[{"value":"string","score":0.0}],
  "taglines":[{"value":"string","score":0.0}],
  "voice":"string",
  "audience":"string",
  "deliverables":["brand_kit","landing_html","social_bios"]
}
```

landing_page_v1 (schema excerpt)
```json
{
  "title":"string",
  "description":"string",
  "sections":[{"type":"hero","content":"string"},{"type":"feature","items":[{"title":"string","desc":"string"}]}],
  "seo":{"meta_title":"string","meta_description":"string"}
}
```

Function-call example (OpenAI-style)
```
name: "create_brand"
arguments: {"business_name":"string","voice":"friendly","audience":"string","deliverables":["brand_kit"]}
```

---

## 5. Function-Call Patterns & Idempotency

- Use short, single-purpose functions: `create_repo`, `scaffold_site`, `generate_brand`, `schedule_campaign`.
- Schema must include `operation_id` and `idempotency_key`.
- Example orchestration flow:
  1. Model returns `name: "scaffold_site"` with `arguments` including `repo_url`, `template`, `operation_id`.
  2. Orchestrator validates and executes; stores logs for retries.

---

## 6. RAG & Retrieval Guidance

- Use embeddings indexes for:
  - Market reports
  - Integration docs (Stripe, Firebase, OAuth guides)
  - Past user sessions & templates
- Only include top-K (e.g., K=5) relevant docs into prompt context.
- Attach `source` fields in model outputs with `id`, `snippet`, and `confidence`.

Output snippet example:
```json
"sources": [{"type":"doc","id":"market/report-2026","snippet":"X summary","confidence":0.86}]
```

---

## 7. Temperature & Tokens

- Planning / deterministic outputs: `temperature: 0.0 - 0.3`
- Creative / brand copy: `temperature: 0.6 - 0.9`
- Few-shot consistency: `temperature: 0.2`
- Token budgets:
  - JSON plan: up to 1024 tokens
  - Landing HTML: 1500–3000 tokens

---

## 8. Validation & Sanity Checks

Include `sanity_checks` in outputs with values like `ok`, `warn`, or `fail` and short `notes`.

Example:
```json
"sanity_checks": {"feasibility":"ok","notes":["Estimated cost under budget","Requires Stripe account"]}
```

---

## 9. Example Workflows

Launch Quickstart (automated):
1. User asks: "Launch MVP for <idea>."
2. Model returns `business_plan_v1` + `actions` including `scaffold_site` function suggestion.
3. Orchestrator runs `scaffold_site`, creates repo and preview URL, returns `operation_id`.

Weekly Growth Review:
- Send metrics and plan to model; receive `scorecard` JSON with prioritized next steps.

---

## 10. Security & Operational Notes

- Never embed secrets in model output; return placeholders like `"<ENV:API_KEY>"`.
- Log model inputs and outputs for auditability.
- Provide clear user-facing disclaimers when suggesting legal/financial advice.

---

## 11. Quick Copyable Prompts

- JSON-first planning:
```
Respond JSON-first using schema `business_plan_v1`. Then give a 2-sentence summary. Include `assumptions[]` and `confidence_score`.
```

- Brand creative:
```
Generate 3 brand name options, taglines, a voice description, and a 1-page landing HTML snippet. Return `brand_bundle` JSON then HTML.
```

---

## Next steps & suggestions

- Save this file alongside `llms.txt` and reference it from developer docs.
- Create small function contracts (OpenAPI or JSON Schema) for available orchestrator functions.
- Add a test harness that validates model outputs against schemas.

---

_Added by developer assistant: system prompts, templates, few-shot examples, JSON schemas, function-call patterns, RAG and pipeline guidance._
