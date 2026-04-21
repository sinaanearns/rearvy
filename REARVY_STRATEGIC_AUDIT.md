# Rearvy Strategic Audit

Verified on April 21, 2026 using:
- local repo and route/component inspection
- current public site copy in this workspace
- current official competitor pages and pricing pages

## 1. What Rearvy currently does

Rearvy today is a Next.js + Firebase product that combines:
- AI chat over connected business data
- integrations for Shopify, Google Analytics, YouTube, Instagram, Facebook, Gmail, Excel, GitHub, and Razorpay
- project-based collaboration and saved chat context
- generated insights and alerts
- a public demo chat
- a separate trading copilot workstream

The strongest practical use case in the repo is not "AI for every business." It is:

**Turn scattered client data into a fast explanation and next action.**

That is especially useful for:
- small-to-mid-sized growth agencies
- DTC consultants
- agency account managers running weekly client reviews
- founders serving multiple Shopify/DTC brands

### Pain level and willingness to pay

This is painful enough to pay for if Rearvy can reliably do three things:
- shorten weekly reporting and review prep by 2-5 hours per client
- help agencies explain performance shifts faster
- package client-facing recommendations cleanly

That is a real budget line item for agencies. It is much less compelling as a generic "AI business advisor" because that story is too broad and too easy to dismiss.

### Beachhead ICP

The best first buyer is not "any business" and not even "any marketer."

Rearvy's most credible beachhead customer is:

**A small growth agency or DTC consultant managing 5-20 Shopify brands that has to prepare weekly or biweekly client performance reviews.**

This customer is attractive because:
- they already feel reporting pain every week
- they switch between multiple tools and tabs
- they need explanations, not just charts
- they can justify spending if Rearvy saves time across several accounts
- they are small enough to buy quickly but valuable enough to pay for recurring workflow help

### Activation and success metrics

Rearvy should not measure success by signups alone. It should measure whether agencies actually use it in their review workflow.

Recommended metrics:
- North star: weekly client briefs generated per active workspace
- Activation: connect at least 2 data sources and generate 1 brief within 7 days
- Retention: at least 3 briefs or exports per workspace per month
- Sales proof: at least 5 agencies using Rearvy on real client accounts each week

## 2. Brutal product analysis

### What is confusing or weak

- The public story is broader than the actual product.
- The site previously marketed unsupported or unclear integrations like `Meta Ads`, `Stripe`, `WooCommerce`, and `Klaviyo`, while the repo's real first-class integrations are narrower.
- The site previously said `100% Free Forever`, while the repo already contains Razorpay billing flows for a Pro checkout path.
- The product contains adjacent but distracting surfaces: public-profile behavior, follow requests, direct-message/admin-chat patterns, GitHub analytics, and trading.
- Several surfaces weaken trust by feeling fake or unfinished rather than product-led.

### What should be removed or de-prioritized from the main story

- fake or unverifiable social proof
- unsupported integration claims
- "for every business" positioning
- any social-network style narrative in the core product story
- static placeholder panels as if they are finished product value

### Hard kill list for the next 90 days

These may remain in the codebase temporarily, but they should not receive roadmap priority, homepage space, or demo focus:
- trading copilot as a core Rearvy narrative
- public-profile and follow-request style behavior
- DM-like or community-style surfaces unrelated to agency review work
- GitHub analytics as a primary buyer story
- any "AI for every business" framing
- any integration claim not already working end-to-end for real users
- any fake counters, fake testimonials, or inflated proof elements
- placeholder analytics panels presented as finished value

### What users actually want

Agencies do not want another dashboard. They want:
- one fast answer to "what changed?"
- one defensible explanation
- one client-ready summary
- one recommended next move

### UX and trust friction

- too many product identities at once
- weak public differentiation
- pricing story was not internally consistent
- some stray files in `src/components/ui` were repo-hygiene red flags
- automated test coverage exists but is still sparse

## 3. Feature strategy

### Must-have features

- Multi-client agency dashboard
- Weekly client brief generator
- Anomaly and risk alerts
- Source-linked AI explanations
- One-click client-ready report export
- Action playbooks tied to detected issues

### Differentiating features

- Explain + recommend + package for client delivery
- Agency meeting-prep briefs, not just metrics views
- Recommendations tied to underlying data source context
- Recurring digests that surface retention and performance risk early

### Future features

- benchmark library by vertical or client type
- task creation into PM tools
- client portal views
- approval-based execution loops for lifecycle or campaign actions

### MVP scope to ship first

Rearvy does not need a broad platform MVP. It needs one workflow that an agency will pay for.

The first tight MVP should be:
- connect Shopify + at least one traffic/marketing source
- normalize the last 30-90 days of core metrics
- detect meaningful changes in the last 7 days
- generate a weekly client brief with wins, risks, explanation, and next actions
- export that brief into a client-ready format

What to delay until after this works:
- advanced social features
- broad marketplace-style integrations
- complex execution loops
- benchmark products that require more data volume
- anything that does not make the weekly review workflow faster

### Automation and AI opportunities

- Monday morning auto-brief per client
- auto-drafted "what changed this week" email
- anomaly-to-investigation checklist
- save recurring client context and goals as memory
- auto-tag chats and notes by workspace

### Onyx features Rearvy should import

Onyx is not the product Rearvy should become. It is broader, more enterprise-oriented, and more horizontal. But it does have several product patterns Rearvy should borrow because they make AI workflows more reusable, inspectable, and team-friendly.

Verified from the current Onyx repo and official docs on April 21, 2026:
- Onyx repo: custom agents, deep research, agentic RAG, actions/MCP, code execution, artifacts, voice, image generation, collaboration, analytics, and query history are all positioned as core platform features
- Onyx docs: chat UI supports file and URL context, action toggles, deep research mode, model selection, source sidebars, projects, chat sharing, feedback, and regenerate flows

Rearvy should import these product ideas in this priority order:

**1. Custom agents for repeat agency jobs**
- `Weekly Brief Agent`
- `Performance Shift Explainer`
- `Client QBR Prep Agent`
- `Competitor Research Agent`
- `Retention Risk Agent`

Why this matters:
- turns generic chat into repeatable workflows
- makes onboarding easier because users choose a job, not a blank chat box
- creates a stronger path to team sharing and later monetization

**2. Internal search over indexed client knowledge**
- searchable briefs, notes, chats, uploaded files, linked pages, and synced source summaries
- search mode separate from chat when users want documents, not just answers
- source and date filters so agencies can find evidence quickly

Why this matters:
- agencies often remember that they saw an answer before, but not where
- this makes Rearvy more defensible than a transient chat experience

**3. Deep research mode**
- multi-step research flow for competitor analysis, landing-page teardowns, content audits, and strategic investigations
- explicit "this may take longer" mode rather than forcing all chats into the same interaction style

Why this matters:
- high-value agency work often needs synthesis across internal signals and external web context
- this is easier to sell than generic "AI chat"

**4. Action layer with toggles**
- `Internal Search`
- `Web Research`
- `Report Export`
- `Spreadsheet Update`
- `Code/Data Analysis` later

Why this matters:
- users should understand what Rearvy is allowed to use for a response
- this improves trust and gives agencies more control over cost and behavior

**5. Artifacts and downloadable outputs**
- client-ready PDF or doc brief
- internal strategy memo
- investigation checklist
- campaign or reporting template output

Why this matters:
- agencies get paid for deliverables, not just answers
- artifact generation converts analysis into something billable and shareable

**6. Shared agents, shared chats, and stronger team collaboration**
- agent sharing across workspace members
- standardized starter prompts
- shared workspace templates for recurring client review flows

Why this matters:
- agencies work in teams, and the product should feel usable beyond a single operator

**7. Query history and workspace analytics**
- track top prompts, most-used agents, most-used data sources, and export activity
- see which workspaces are actually active

Why this matters:
- helps Rearvy identify retention signals
- gives agencies and admins visibility into adoption and usefulness

**8. Permissions and access control**
- owner/admin/editor/viewer style roles at the workspace level
- eventually separate permissions for integrations, reports, agents, and member management

Why this matters:
- required for agency teams and client-facing collaboration
- supports a real multi-user product instead of a single-user tool with invites

**9. MCP or OpenAPI action integration**
- allow Rearvy agents to connect to external tools in a structured way
- use this for PM tools, CRM actions, reporting sinks, or workflow triggers later

Why this matters:
- avoids hardcoding every future integration
- creates a more scalable execution layer

**10. Scheduled and approval-based workflows**
- Monday brief generation
- anomaly alerts that can escalate into tasks
- optional approval before sending client-facing output or executing actions

Why this matters:
- turns Rearvy from a chat surface into an operating workflow
- increases retention because work happens on a recurring schedule

### What Rearvy already has versus Onyx

Rearvy already has partial versions of several Onyx-like features:
- workspaces via projects
- file upload in chat
- voice input
- web research tools
- model selection
- shared chat and project invites
- source strip and citations on researched answers
- regenerate and feedback patterns
- saved memory and workspace notes

That is good news. It means Rearvy does not need to copy Onyx from scratch.

The bigger gap is not basic UI capability. The bigger gap is productization:
- reusable agents instead of generic chat
- searchable knowledge instead of only conversational recall
- artifact outputs instead of mostly ephemeral answers
- explicit action controls instead of hidden tool behavior
- permissions and analytics for real team usage

### What Rearvy should not copy from Onyx

Rearvy should not blindly import everything just because Onyx has it.

Rearvy should avoid prioritizing:
- generic enterprise knowledge management as the main story
- broad "works for every team" messaging
- image generation as a headline feature
- horizontal platform sprawl before weekly brief and review workflows are excellent
- infrastructure complexity that only makes sense at much larger scale

## 4. Product logic and system design

### Recommended product model

Rearvy should converge on this domain:

`agency workspace -> client workspace -> data source -> normalized daily facts -> insight -> brief -> playbook action`

The current `Project` model is the best migration path to a future `Client Workspace`.

### Architecture recommendation

Keep now:
- Next.js app shell
- Firebase Auth
- Firestore for operational state, users, workspaces, chats, integration state, insights
- scheduled sync jobs and background generation

Move later:
- heavy analytics facts and cross-source joins into Postgres
- precomputed daily summaries and health scores for low-latency reporting

### Practical data model

Rearvy's current product model should move toward a small set of stable objects:
- `AgencyWorkspace`: the agency account and billing boundary
- `ClientWorkspace`: one client brand or account under the agency
- `DataSourceConnection`: Shopify, GA, Meta-adjacent, email, spreadsheet, or other source state
- `DailyFact`: normalized metrics per day, source, and client
- `Insight`: detected anomaly, trend, or risk with citations
- `Brief`: generated weekly summary for internal or client-facing use
- `PlaybookAction`: recommended next step tied to an insight

Recommended storage split:
- Firestore for users, workspaces, chats, connection state, insight metadata, brief metadata, and app state
- Postgres later for large fact tables, joins, precomputed reporting windows, and benchmark aggregates
- object storage for exports, generated reports, and large artifacts if needed

### Suggested workflow

1. Sync raw source data into normalized daily facts per client.
2. Compute rolling baseline windows for each important metric.
3. Flag anomalies and classify them by severity and source.
4. Pull client context, prior notes, and recent alerts.
5. Generate a brief with citations and recommended actions.
6. Store the brief, notify the user, and make it exportable.

### Practical tooling recommendation

- Keep Next.js for the product shell and authenticated app
- Keep Firebase Auth for fast iteration and simple access control
- Keep Firestore while the data volume is still manageable
- Use scheduled jobs or queue workers for sync and brief generation
- Add Postgres only when analytics queries become the bottleneck
- Use a single LLM provider with structured outputs for briefs and playbooks to reduce product complexity

### Why this is the right tradeoff

- lowest-cost path for current product iteration
- fast shipping with existing team setup
- enough structure to support an agency workflow without premature platform work

### Pseudocode

```ts
async function generateWeeklyClientBrief(clientId: string) {
  const facts = await loadNormalizedDailyFacts(clientId, { days: 7 });
  const anomalies = detectAnomalies(facts, "7d");
  const sourceContext = await loadSourceContext(clientId);
  const narrative = await llm.summarize({
    facts,
    anomalies,
    sourceContext,
    output: ["wins", "risks", "why", "next_actions"],
  });

  return {
    clientId,
    timeframe: "last_7_days",
    generatedAt: new Date().toISOString(),
    wins: narrative.wins,
    risks: narrative.risks,
    explanation: narrative.why,
    nextActions: narrative.next_actions,
    citations: narrative.citations,
  };
}
```

```ts
function detectAnomalies(clientFacts: DailyFact[], timeframe: "7d" | "30d") {
  const baseline = buildBaseline(clientFacts, timeframe);
  const current = getCurrentWindow(clientFacts, timeframe);

  return current
    .map((metric) => ({
      metric: metric.name,
      deltaPct: percentChange(baseline[metric.name], metric.value),
      severity: scoreSeverity(metric),
      source: metric.source,
    }))
    .filter((item) => Math.abs(item.deltaPct) >= 15 || item.severity === "high");
}
```

```ts
function buildActionPlaybook(alert: Alert, clientContext: ClientContext) {
  if (alert.metric === "conversion_rate" && alert.deltaPct < 0) {
    return [
      "Check traffic-source mix against previous period",
      "Review landing pages with the sharpest drop",
      "Inspect offer, pricing, and checkout friction changes",
      "Prepare a client note with cause hypotheses and next test",
    ];
  }

  return [
    "Verify the signal against source data",
    "Explain likely causes in plain language",
    "Propose the next test or fix",
  ];
}
```

## 5. Monetization strategy

### Fastest route to first Rs 1 lakh

Do not wait for pure SaaS scale. Sell service-led outcomes first.

Recommended offers:
- `INR 10k-INR 25k`: agency data audit + setup
- `INR 25k-INR 60k/month`: weekly agency intelligence layer for a small client roster
- `INR 60k-INR 1L/month`: premium reporting + strategy support for agencies managing multiple DTC clients

### Product pricing approach

- Free access as current lead magnet
- Agency subscription once weekly brief + report export + alerts are solid
- Done-with-you onboarding for agencies that want fast setup
- White-label/reporting tier later

### Suggested monetization logic

- Free: connect data, basic chat, demo, limited projects
- Agency: recurring briefs, alerting, report packaging, better collaboration
- Premium / Done-with-you: implementation, client reporting setup, custom briefing workflows

### Suggested pricing table

| Plan | Monthly price | Best for | Includes |
| --- | --- | --- | --- |
| Free | `₹0` | solo testing and demos | limited workspaces, limited source connections, basic chat, demo brief preview |
| Agency | `₹12,000-₹25,000/mo` | small agencies managing a live roster | multi-client workspaces, weekly briefs, anomaly alerts, report export, shared notes, priority sync |
| Done-with-you | `₹25,000-₹60,000/mo` | agencies that want Rearvy plus setup/support | onboarding, source cleanup, custom templates, briefing workflow setup, monthly strategy support |
| Premium agency support | `₹60,000-₹1L/mo` | agencies with larger portfolios and high-touch needs | everything above plus custom reporting ops, leadership review support, white-label options, faster support |

### Fastest route to revenue in plain numbers

The fastest route to the first `₹1 lakh` is not waiting for self-serve SaaS.

A realistic path:
- 5 agencies at `₹20,000/mo` each = `₹1,00,000/mo`
- or 2 premium setup projects at `₹25,000` plus 2 recurring clients at `₹25,000/mo`
- or 1 premium support client at `₹60,000/mo` plus 2 smaller agencies at `₹20,000/mo`

This works because agencies buy time savings and client-delivery clarity faster than they buy generic AI software.

## 6. Market and competitor analysis

### Agency reporting tools

| Company | What they do well | Official pricing snapshot | Weakness | Rearvy wedge |
| --- | --- | --- | --- | --- |
| AgencyAnalytics | Agency-native reporting, white-labeling, client portal, alerts, AI summaries | `AgencyAnalytics get-started`: Freelancer `$59/mo` annual, Agency `$179/mo`, Agency Pro `$349/mo`, Enterprise custom | Strong reporting, but still dashboard/report centered | Be the "explain + brief + next action" layer |
| DashThis | Clean reporting, fast dashboard setup, unlimited integrations in plan, AI add-on | `DashThis pricing`: Individual `$44/mo` annual, Professional `$139/mo`, Business `$279/mo`; AI Insights Pro `$19/mo` add-on | Dashboard-first, lighter on deeper operating context | Win on client review prep and narrative |
| Supermetrics | Best-known connector/data movement layer, flexible destinations | `Supermetrics pricing`: Starter from `$37/mo` annual, Growth from `$177/mo`, Enterprise quote | Excellent pipes, weaker as an end workflow for agencies | Build the end workflow, not just plumbing |

### DTC analytics platforms

| Company | What they do well | Official pricing snapshot | Weakness | Rearvy wedge |
| --- | --- | --- | --- | --- |
| Triple Whale | DTC attribution, benchmarks, unified commerce lens, AI agents | `Triple Whale pricing`: Free `$0`, Starter `$299/mo`, revenue-based paid tiers with dynamic pricing examples shown on page | Built for brands more than agencies; pricing rises fast with scale | Serve agency portfolios and review workflows |
| Polar Analytics | Ecommerce BI, attribution, Snowflake-backed data stack, agency-friendly messaging | `Polar official pages`: pricing starts around `$400/mo` and scales with transaction volume; pricing presentation is still bundle-heavy | Powerful, but heavier and more data-platform oriented | Offer a lighter, faster workflow product |
| Northbeam | Higher-end attribution and measurement | `Northbeam pricing`: Starter starts at `$1,500/mo`, Pro/Enterprise custom | Premium pricing, advanced measurement focus, harder for smaller agencies | Win on accessibility and speed to value |

### Automation and execution platforms

| Company | What they do well | Official pricing snapshot | Weakness | Rearvy wedge |
| --- | --- | --- | --- | --- |
| Klaviyo | Best-in-class DTC lifecycle automation and reporting | `Klaviyo pricing`: free plan up to `250 profiles`, `500 emails/month`, `150 mobile credits`; paid cost scales with profiles/messages | Strong execution, but not a full agency review OS | Feed better analysis into lifecycle action |
| HubSpot Marketing Hub | Broad marketing suite with strong enterprise breadth | `HubSpot legal/catalog`: Starter from `$20/seat/mo`, Professional from `$890/mo`, Enterprise `$3,600/mo` | Heavy, expensive, broad, and often overkill for small agencies | Be the focused AI review and briefing layer |

## 7. Positioning

### Best positioning

Rearvy should be positioned as:

**The AI review workspace for growth agencies managing Shopify and DTC client accounts.**

### One clear message

**Rearvy helps growth agencies spot what changed across client data, explain why it happened, and show the next action in minutes.**

### Why this positioning works

- specific customer
- specific job
- specific moment of pain
- easier to sell than "AI business assistant"

## 8. Growth strategy

### First 100 users

- manually recruit 20-30 agencies and DTC consultants from founder network, LinkedIn, X, and WhatsApp
- offer free setup in exchange for weekly feedback
- run a live demo around "how to prepare faster for client review calls"
- publish teardown content of common agency reporting pain

### First paying customers

- sell a done-with-you reporting and briefing setup
- offer a 2-week pilot for 1-3 client accounts
- price by outcome and time saved, not by "AI chat"

### Organic channels

- founder-led LinkedIn content
- short X threads on weekly reporting pain
- YouTube or Loom walkthroughs of client-review prep
- comparison content versus AgencyAnalytics, DashThis, Triple Whale

### Short-form content ideas

- "3 reasons your agency review call feels chaotic"
- "What changed this week? Here's the 5-minute prep workflow"
- "Dashboard tools show numbers. Clients pay for explanations."
- "Why agencies don't need more dashboards, they need a briefing layer"

### 30-day founder sales motion

Rearvy should not wait for inbound demand before validating willingness to pay.

Weekly operating target:
- reach out to 50 agency operators or consultants per week
- book 10 discovery calls per week
- run 3-5 live demos per week
- close 1 pilot every 1-2 weeks

Simple outreach angle:
- "We help Shopify-focused agencies prep for client review calls faster by turning scattered data into a weekly brief with explanation and next steps."

Pilot structure:
- 2-week setup and usage period
- 1-3 client accounts
- founder-supported onboarding
- fixed fee or discounted pilot that converts into monthly recurring support

### Validation assumptions to prove in the next 30 days

Rearvy should explicitly validate these before expanding the roadmap:
- agencies trust the product enough to connect real client data
- the weekly brief is materially better than manual prep
- users will pay for explanation and packaging, not just dashboards
- at least one workflow produces repeated weekly use
- one positioning message consistently converts interest into demos

## 9. Final verdict

### Score

**6.5/10**

Why not lower:
- real integrations exist
- real chat and insight infrastructure exists
- the agency wedge is credible

Why not higher:
- product sprawl
- trust issues in prior messaging
- weak focus
- sparse automated coverage

### Biggest risk

Rearvy keeps trying to be too many products at once and never becomes the obvious best tool for one buyer.

### Biggest opportunity

Rearvy becomes the fastest way for a small agency to answer "what changed, why, and what should we do next?" before every client call.

### 30 / 60 / 90 day execution roadmap

**30 days**
- finish public positioning cleanup
- keep only truthful integration claims
- tighten demo around agency workflow
- rename projects in UI copy to workspaces where sensible
- manually onboard first agencies
- define activation metric and track it in product analytics
- launch a paid or semi-paid pilot offer with clear deliverables

**60 days**
- ship weekly client brief generator
- ship anomaly-to-playbook flow
- add report export / send-ready summary
- define agency onboarding offer and pricing
- ship at least one reusable agent for a repeat agency job
- prove at least one agency use case repeats weekly without heavy founder intervention

**90 days**
- ship multi-client command center
- add recurring digests and alert tuning
- convert service-led onboarding into a repeatable paid offer
- validate whether billing should become pure SaaS, hybrid, or service-led for longer
- add internal workspace search and artifact-style brief outputs
- decide what gets permanently cut from the product narrative and roadmap

## Notes from technical validation

- `npm run build` passes in this workspace.
- Automated tests exist, but coverage is still narrow.
- Trust and hygiene issues were real enough to matter: unsupported claims, inconsistent pricing story, and stray UI files that did not belong in production code.

## Official source links

- AgencyAnalytics pricing and plans: https://agencyanalytics.com/get-started and https://agencyanalytics.com/pricing
- DashThis pricing: https://dashthis.com/pricing
- Supermetrics pricing: https://supermetrics.com/pricing
- Triple Whale pricing: https://www.triplewhale.com/pricing
- Polar Analytics pricing pages and official comparison pages: https://www.polaranalytics.com/pricing and https://www.polaranalytics.com/alternatives/triple-whale
- Northbeam pricing: https://www.northbeam.io/pricing
- Klaviyo pricing: https://www.klaviyo.com/pricing/
- HubSpot Marketing Hub pricing/catalog: https://legal.hubspot.com/services/hubspot-services-descriptions and https://blog.hubspot.com/marketing/hubspot-marketing-hub-pricing
- Onyx repo: https://github.com/onyx-dot-app/onyx
- Onyx feature docs: https://docs.onyx.app/overview/core_features/chat , https://docs.onyx.app/overview/core_features/agents , https://docs.onyx.app/overview/core_features/actions , https://docs.onyx.app/overview/core_features/internal_search , https://docs.onyx.app/admins/permissions/whats_changing
