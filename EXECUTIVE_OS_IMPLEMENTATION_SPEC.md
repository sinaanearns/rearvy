# Rearvy Executive OS Implementation Spec

Status: Draft for engineering execution
Date: 2026-05-05
Owner: Product + Platform Engineering

## 1. Scope and Outcome

This spec operationalizes six initiatives into buildable modules on top of the current Next.js + Firebase platform:

1. Universal Browser Automation
2. Dynamic Python Sandbox
3. Media and Asset Generation
4. Meeting and Voice Integration
5. Fundraising and Investor OS
6. Proactive Morning Brief at 8 AM

Primary outcome: Rearvy shifts from chat-first assistant to autonomous operating layer with guardrails, auditability, and measurable ROI.

## 2. Current Platform Baseline

Current codebase already includes primitives that reduce delivery risk:

- AI tool registry and tool execution pipeline
- Existing browser session controls and API routes
- Durable sync job worker pattern with secret-auth internal route
- WhisperNet scheduled analysis pattern
- Firebase Auth + Firestore-centric data model

Execution model should extend these patterns rather than introducing a second orchestration stack.

## 3. Product Pillars and Non-Goals

### Pillars

- Autonomous where safe, approval-first where risky
- Explainable outcomes with full run timelines
- Reusable runbooks over ad hoc prompts
- Client-level isolation and permission scoping

### Non-goals in v1

- Full legal cap table system replacement
- Fully unsupervised browser execution on unknown domains
- Arbitrary internet access from sandbox jobs

## 4. Target Architecture

## 4.1 Core Services

1. Orchestrator Service
- Evaluates tasks and dispatches to Execution Workers
- Supports retries, dead-letter states, and idempotency keys

2. Browser Worker Pool
- Playwright-based isolated workers
- Domain allowlist + action policy checks

3. Python Sandbox Worker Pool
- Ephemeral containers with CPU, memory, and timeout limits
- Allowlisted package installation only

4. Artifact Service
- Stores generated assets, previews, and metadata
- Tracks lineage from source data and prompt inputs

5. Briefing Service
- Timezone-aware scheduler for overnight triage and 8 AM briefing delivery

## 4.2 Existing Pattern Reuse

- Internal secret-guarded route style for worker invocation
- Firestore job queue style already used by integration sync
- AI tool registration and call flow used in chat routes

## 4.3 Data Plane and Security

- Firestore as control plane and execution metadata store
- Cloud Storage for artifacts and media outputs
- Per-tenant scoped credential references
- Signed action logs with immutable run snapshots

## 5. Data Model Additions (Firestore)

## 5.1 Execution

Collection: users/{uid}/automation_runs/{runId}

Fields:
- type: browser | python | media | meeting | brief
- status: queued | running | awaiting_approval | completed | failed | canceled
- riskLevel: low | medium | high
- requestedBy: user id or system
- startedAt, endedAt
- summary
- error
- costEstimate
- evidenceRefs: array of storage paths or doc refs

Collection: users/{uid}/automation_run_steps/{stepId}

Fields:
- runId
- stepType
- input
- output
- screenshotRef
- startedAt, endedAt
- status

## 5.2 Browser Recipes

Collection: users/{uid}/browser_recipes/{recipeId}

Fields:
- name
- targetDomain
- selectorsVersion
- steps
- requiresApproval: boolean
- lastValidationAt
- successRate30d

## 5.3 Sandbox Scripts

Collection: users/{uid}/sandbox_scripts/{scriptId}

Fields:
- name
- language: python
- code
- version
- createdBy
- approvalState: draft | approved | archived
- allowedDataScopes

## 5.4 Morning Brief

Collection: users/{uid}/morning_briefs/{briefId}

Fields:
- date
- timezone
- generatedAt
- actionsTaken
- unresolvedRisks
- kpiDeltas
- messageBody
- deliveryChannels
- status

## 5.5 Meeting Intelligence

Collection: users/{uid}/meeting_runs/{meetingRunId}

Fields:
- meetingId
- participants
- transcriptRef
- extractedCommitments
- confidence
- appliedUpdates

## 5.6 Investor OS

Collection: users/{uid}/investor_workspace/{docId}

Subcollections:
- investors
- updates
- board_packets
- fundraising_pipeline

## 6. API and Tooling Contracts

## 6.1 Browser Automation

New routes:
- POST /api/automation/browser/runs
- GET /api/automation/runs/{id}
- POST /api/automation/runs/{id}/approve
- POST /api/automation/runs/{id}/cancel
- POST /api/automation/browser/recipes
- POST /api/automation/browser/recipes/{id}/execute

Tool additions:
- startBrowserRun
- approveBrowserRun
- executeBrowserRecipe

## 6.2 Python Sandbox

New routes:
- POST /api/automation/python/execute
- POST /api/automation/python/scripts
- POST /api/automation/python/scripts/{id}/run

Tool additions:
- runPythonSandboxTask
- saveSandboxScript
- runSandboxScript

## 6.3 Media and Asset Generation

New routes:
- POST /api/assets/generate
- GET /api/assets/{id}
- POST /api/assets/{id}/approve
- POST /api/assets/{id}/publish

Tool additions:
- generateCampaignAssets
- generateBoardDeck

## 6.4 Meeting and Voice

New routes:
- POST /api/meetings/connect-calendar
- POST /api/meetings/runs/{id}/process
- GET /api/meetings/runs/{id}

Tool additions:
- summarizeMeetingCommitments
- applyMeetingUpdatesToPulse

## 6.5 Investor OS

New routes:
- GET /api/investor/overview
- POST /api/investor/updates/generate
- POST /api/investor/board-packets/generate

Tool additions:
- generateInvestorUpdate
- generateBoardPacket

## 6.6 Morning Brief

New routes:
- POST /api/internal/briefing/run
- GET /api/morning-brief/latest
- POST /api/morning-brief/delivery-test

Tool additions:
- runOvernightTriage
- getMorningBrief

## 7. Policy and Guardrails

## 7.1 Approval Matrix

Low risk:
- Data extraction
- Draft generation
- Non-destructive form fill

Medium risk:
- Publishing external content
- Sending investor updates

High risk:
- Billing-affecting actions
- Account-level permission changes

Rules:
- medium and high default to awaiting_approval
- high requires explicit named approval policy

## 7.2 Browser Controls

- Per-tenant allowlisted domains
- Action allowlist for click, type, submit, upload
- Redact sensitive fields in stored logs
- Capture before and after screenshots for mutating steps

## 7.3 Sandbox Controls

- Max run time 120 seconds in v1
- Max memory 512 MB in v1
- No arbitrary outbound network by default
- Explicit allowlist for internal integration endpoints

## 8. Delivery Plan (90 Days)

## Phase 1 (Weeks 1-4): Execution Foundation

Deliver:
- Unified automation run model and UI timeline
- Browser run engine v1 for 3 workflows
- Python sandbox v1 with strict policy
- Morning brief v1 in-app only

Acceptance:
- 80 percent success on predefined browser workflows
- 95 percent sandbox runs terminate within limits
- Daily brief generated by 8:05 AM local time

## Phase 2 (Weeks 5-8): Operational Intelligence

Deliver:
- Meeting transcription ingestion and commitment extraction
- Recipe recorder beta from user demonstrations
- Asset generation v1 for social posts and ad variants

Acceptance:
- Commitment extraction precision >= 0.8 on validation set
- Asset generation approval rate >= 40 percent in pilot accounts

## Phase 3 (Weeks 9-12): Executive OS

Deliver:
- Investor workspace v1 with update and board packet generation
- Morning brief v2 with autonomous low-risk actions
- Full approval workflows and policy editor

Acceptance:
- 20 percent reduction in manual executive ops tasks
- 30 percent of morning brief items auto-resolved overnight

## 9. Frontend Surfaces

New pages under app router:

- /dashboard/automation
- /dashboard/automation/runs/[runId]
- /dashboard/automation/recipes
- /dashboard/assets
- /dashboard/meetings
- /dashboard/investor
- /dashboard/briefing

Shared components:

- AutomationRunTimeline
- RiskBadge
- ApprovalPanel
- ArtifactPreviewCard
- MorningBriefCard

## 10. Observability and Analytics

Track per run:
- queue latency
- execution duration
- completion status
- approvals required and granted
- estimated business impact

Track weekly:
- autonomous completion rate
- approval bypass rate by policy
- hours saved estimate
- incident count by risk level

## 11. Testing and Reliability

Required test layers:

- Unit tests for policy engine and risk scoring
- Integration tests for route authorization and worker dispatch
- Deterministic browser replay tests on fixture websites
- Sandbox kill-switch tests for timeout and memory limits
- Synthetic daily brief generation monitor

## 12. Rollout Strategy

1. Internal dogfood with staff accounts
2. Pilot with 5 design partner companies
3. Controlled GA with feature flags by module

Feature flags:
- ENABLE_AUTOMATION_BROWSER
- ENABLE_SANDBOX_PYTHON
- ENABLE_ASSET_STUDIO
- ENABLE_MEETING_INTEL
- ENABLE_INVESTOR_WORKSPACE
- ENABLE_MORNING_BRIEF

## 13. Initial Engineering Ticket Set

Platform
- Create AutomationRun schema and repository functions
- Build run state machine with retries and dead-letter handling
- Add policy evaluator middleware

Browser
- Implement browser worker dispatcher and session lifecycle
- Add recipe CRUD and execution route
- Add screenshot and log persistence

Sandbox
- Implement python execution worker contract
- Add script registry and approval state transitions
- Add resource limiter enforcement and failure taxonomy

Asset Studio
- Build asset generation endpoint and artifact storage metadata
- Add approval and publish APIs

Meeting Intel
- Build transcript ingestion and commitment extraction pipeline
- Add Business Pulse update adapter with confidence thresholds

Investor OS
- Build investor overview aggregates
- Add update and board packet generation endpoints

Morning Brief
- Build scheduled triage route and delivery adapters
- Build briefing UI and daily history

## 14. Dependencies and Procurement

Likely external dependencies:
- Browser automation runtime infrastructure
- Speech to text provider
- Presentation generation provider or template engine
- Optional creative generation model provider

Procurement decision criteria:
- tenancy isolation
- predictable pricing
- webhook reliability
- compliance posture and data retention controls

## 15. Open Decisions

1. Worker runtime target: Cloud Run vs alternate container platform
2. Transcript retention defaults by region
3. Preferred channel order for morning brief delivery
4. Investor module depth for v1 legal and compliance boundaries

## 16. Definition of Done

This initiative is done when:

- Each module has production-grade API, UI, and telemetry
- Guardrails and approvals are enforced for all mutating actions
- Morning brief runs daily with SLA and recovery mechanisms
- Pilot accounts report measurable executive time savings
