# Agency Performance Atlas Concept

Approval status: pending.

## Why concept generation was required

The requested work is advanced visual design for a data visualization, so the visualization workflow requires a large-screen and mobile concept set before implementation. The built-in image generation tool is not exposed in this session, so this pass uses deterministic SVG concept frames instead of AI-generated bitmap concepts.

## Analytical Job

- Primary job: operational monitoring plus comparison across agency clients.
- Data shape: multivariate time series, client x channel matrix, evidence events, and approval-gated actions.
- Artifact family: operational visualization workspace with a synchronized matrix, evidence trace, and review panel.
- Primary route: code-native SVG/React visualization with data-bound labels and responsive sibling layouts.
- Fallback route: simpler table-plus-sparklines if dense matrix interactions are too expensive for the first release.

## Evidence Lock

Insight title: 3 client moves need review before 3pm.

Takeaway: Luma Naturals has real revenue lift, but paid traffic quality is slipping, so the user should inspect CAC before approving a client brief or campaign action.

Truth invariants:

- Never show a client action without source and caveat placement.
- Do not hide review-before-send approval in mobile.
- Do not fabricate missing metrics; stale or partial states stay visible.
- Revenue lift, CAC risk, content opportunity, and approval status remain separate visual roles.

## Concept Set

- Large screen: `agency-performance-atlas-desktop.svg`
- Mobile portrait: `agency-performance-atlas-mobile-portrait.svg`
- Mobile landscape: `agency-performance-atlas-mobile-landscape.svg`

Mobile landscape is included because the core visualization uses a wide matrix and timeline substrate.

## Design Contract

Locked elements:

- A client x channel signal matrix is the primary visualization on large screens and mobile landscape.
- Mobile portrait switches to a focused signal compass plus a compact evidence trace instead of squeezing the matrix.
- Source/caveat and last-updated state remain visible.
- The right-side or bottom action review area preserves approval-gated action behavior.
- Color roles stay consistent: black/white structure, green for verified upside, red for risk, amber for opportunity or review, blue/cyan for traffic and communication context.

Flexible elements:

- Exact chart geometry, label density, breakpoints, and typography tokens.
- Whether the first implementation uses SVG, Canvas, or a hybrid.
- Exact sample values in the concept, which should become data-bound fields.

## Interaction Plan

- Default state selects the highest-priority client.
- Hover on desktop becomes tap/focus selection on mobile.
- Matrix marks open evidence details; timeline brushing filters visible marks.
- Mobile controls collapse into a bottom sheet and return focus to the visualization after Apply, Cancel, or Reset.
- Reduced-motion mode uses static highlight strokes and no animated trace.
- Offline or spotty connection keeps the last known view with stale status instead of blanking the chart.

## Approval Question

Approve this visual direction, or request specific changes to the layout, density, palette, or mobile behavior before implementation.
