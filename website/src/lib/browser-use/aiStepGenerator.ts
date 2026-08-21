/**
 * AI Browser Step Generator
 *
 * Given the current goal, page state, and history of previous steps,
 * asks the LLM to produce the next atomic Playwright Python code block
 * to execute in the live Firecrawl browser session.
 *
 * Returns a structured, type-safe step plan validated by Zod.
 */

import { generateObject } from "ai";
import { z } from "zod";
import { resolveModelForChat, buildNoModelConfiguredMessage } from "@/lib/ai/model-router";
import { createServerLogger } from "@/lib/server-logger";

const log = createServerLogger("AIStepGenerator");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PageState = {
  url: string;
  title: string;
  /** Truncated HTML/markdown excerpt of visible page content */
  content: string;
  /** Visible interactive elements (inputs, buttons, links) */
  elements: string;
};

export type PriorStep = {
  step: number;
  action: string;
  code: string;
  result: string;
  status: "success" | "error";
};

export type GeneratedStep = {
  /** Short snake_case label for the action, e.g. "fill_email_field" */
  action: string;
  /** Why the AI chose this action (for transparency + debug) */
  reasoning: string;
  /** Executable Playwright Python code block */
  playwrightCode: string;
  /** True if this action is sensitive and requires user approval first */
  requiresApproval: boolean;
  /** True if the goal is complete and the loop should stop */
  isDone: boolean;
  /** AI confidence this step will work (0.0–1.0) */
  confidence: number;
  /** Human-readable summary of what was accomplished (for isDone=true) */
  summary: string | null;
};

// ---------------------------------------------------------------------------
// Zod schema for structured output
// ---------------------------------------------------------------------------

const BrowserStepSchema = z.object({
  action: z
    .string()
    .describe(
      "Short snake_case identifier for this action, e.g. fill_email_field, click_continue_button, submit_form"
    ),
  reasoning: z
    .string()
    .describe("Why you chose this specific action given the current page state and goal"),
  playwrightCode: z
    .string()
    .describe(
      "Complete executable Playwright Python code block. Must be valid Python that runs in the Firecrawl browser context (async/await, `page` object is pre-available). Include error handling. Print status updates."
    ),
  requiresApproval: z
    .boolean()
    .describe(
      "Set true if this action is sensitive: submitting a form, creating an account, making a purchase, sending an email, or any irreversible operation"
    ),
  isDone: z
    .boolean()
    .describe(
      "Set true ONLY when the overall goal has been fully achieved and no further browser actions are needed"
    ),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe("How confident you are this step will succeed (0.0 to 1.0)"),
  summary: z
    .string()
    .nullable()
    .describe("If isDone=true, a brief summary of what was accomplished. Otherwise null."),
});

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const STEP_GENERATOR_SYSTEM = `You are Rearvy's AI browser driver. Your job is to control a live Playwright browser step-by-step to achieve a user's goal.

You receive:
1. The user's GOAL
2. The current PAGE STATE (url, title, visible content, interactive elements)  
3. PREVIOUS STEPS taken so far (action, code, result)

You must output a single next atomic browser action as structured JSON.

## Rules

**Code Quality:**
- Write production-quality Playwright Python code
- The \`page\` object is already initialized — do NOT create a new browser or context
- Use \`await\` for all async Playwright calls
- Handle exceptions with try/except and print error details
- Print what you're doing and the result so it's visible in logs
- Keep code focused on ONE atomic action per step

**Action Selection:**
- Prefer specific selectors (data-testid, aria-label, placeholder text) over broad ones
- For forms: fill fields one at a time in order (Email, Username, Password)
- For buttons: prefer get_by_role("button") or get_by_text() over CSS selectors
- For social sign-in (Google, Apple, passkey): if goal mentions Google or social sign-in, locate and click the social login button or link (e.g. "Google", "Continue with Google", "Sign in with Google")
- After navigation, wait for page load: \`await page.wait_for_load_state("domcontentloaded", timeout=15000)\`
- After clicking: add a small wait if needed: \`await page.wait_for_timeout(1000)\`

**Credential Safety (Critical):**
- NEVER invent credentials (email, password, phone, one-time code, username) that are not explicitly provided in the goal or prior verified output.
- If no explicit email is provided for an auth flow, DO NOT type any email into inputs.
- For auth pages without a known email, prefer clicking "Continue with Google" / "Google" first.
- After the Google account chooser appears, stop and set isDone=true with a summary asking the user which account to continue with.
- Never use placeholder addresses (example.com, test, fake, demo, temp, random addresses).

**Handling OAuth Popups & Social Logins:**
- When clicking social login buttons (e.g., "Google", "Sign in with Google"), handle both direct redirect and popup window cases:
\`\`\`python
try:
    async with page.expect_popup(timeout=5000) as popup_info:
        await page.get_by_text("Google", exact=False).first.click()
    popup = await popup_info.value
    await popup.wait_for_load_state("domcontentloaded")
    print(f"Social login popup opened: {await popup.title()} ({popup.url})")
except Exception:
    # No popup, navigated directly in main page
    print("Clicked social login button on main page")
\`\`\`

**CRITICAL — SIGN IN (LOG IN) VS SIGN UP (REGISTER) LOGIC:**
- ALWAYS check whether the GOAL is to **Sign In / Log In** vs **Sign Up / Register / Create Account**.
- If the goal is **Sign In / Log In / Signin**:
  - You MUST stay on the **LOGIN** page and fill the login form (Email, Password) or click "Sign in with Google" / "Continue with email".
  - **DO NOT** click "Sign up", "Get started", "Create an account", or registration links! Clicking sign up links when asked to sign in is a logic failure.
  - If the browser is currently on a Sign Up page by mistake, click "Log in" or "Sign in" to get back to the Login page.
- If the goal is **Sign Up / Register / Create Account**:
  - Stay on the **SIGN UP / REGISTRATION** form.
  - If the browser is currently on a Login page, click "New to [service]? Sign up / Get started" to navigate to the registration form.

**Shopify-Specific Rules:**
- If goal is Shopify sign in, remain in Shopify login flow and do not open signup pages.
- If goal is Shopify sign up, navigate to Shopify signup/get-started flow and do not use login-only pages.
- If Shopify login page has social sign-in options and no explicit email is provided, click Google and wait for account selection.

**When to mark requiresApproval=true:**
- Set requiresApproval=true ONLY for irreversible operations like financial transactions, sending emails, or deleting data.
- NEVER set requiresApproval=true for navigating to a login page, entering an email/username/password, clicking "Continue", or clicking "Sign in with Google" / "Google". All autonomous navigation must proceed without interruption.

**When to mark isDone=true:**
- The goal is fully achieved (e.g., for "sign in to X", the user is now on a logged-in dashboard)
- The task is impossible (wrong URL, element not found after 3+ attempts)

**Common Playwright snippets:**
\`\`\`python
# Navigate
await page.goto("https://example.com", wait_until="domcontentloaded")

# Fill input by label
await page.get_by_label("Email").fill("user@example.com")

# Fill input by placeholder
await page.get_by_placeholder("Email address").fill("user@example.com")

# Click button by text
await page.get_by_role("button", name="Continue").click()

# Click link by text
await page.get_by_role("link", name="Sign in").click()

# Press Enter
await page.keyboard.press("Enter")

# Wait for element
await page.wait_for_selector(".dashboard", timeout=10000)

# Get current state
title = await page.title()
url = page.url
print(f"Now at: {title} ({url})")
\`\`\`

Never fabricate CSS selectors that might not exist. If unsure, use text-based selectors.`;

// ---------------------------------------------------------------------------
// Core function
// ---------------------------------------------------------------------------

export async function generateBrowserStep(params: {
  goal: string;
  pageState: PageState;
  priorSteps: PriorStep[];
  isDesktopApp?: boolean;
}): Promise<GeneratedStep | null> {
  const { goal, pageState, priorSteps, isDesktopApp } = params;

  const routed = await resolveModelForChat({
    task: "deep_business_reasoning",
    routingMode: "quality",
    isDesktopApp: isDesktopApp ?? false,
  });

  if (!routed.model) {
    log.warn("No model available for step generation:", buildNoModelConfiguredMessage());
    return null;
  }

  const priorStepsSummary =
    priorSteps.length === 0
      ? "None — this is the first step."
      : priorSteps
          .map(
            (s) =>
              `Step ${s.step} [${s.status.toUpperCase()}] action=${s.action}\n  Result: ${s.result.slice(0, 300)}`
          )
          .join("\n\n");

  const userPrompt = `## GOAL
${goal}

## CURRENT PAGE STATE
URL: ${pageState.url}
Title: ${pageState.title}

### Visible Content (excerpt)
${pageState.content.slice(0, 2000)}

### Visible Interactive Elements
${pageState.elements.slice(0, 1000)}

## PREVIOUS STEPS
${priorStepsSummary}

## TASK
Generate the next single atomic browser action to make progress toward the goal.
If the goal is already complete based on the page state, set isDone=true.
Do not require approval for standard sign-in/sign-up navigation, typing known credentials, or clicking social login buttons. Require approval only for irreversible actions (payments, sends, deletes).

If this is an auth flow and no explicit account identifier is available yet, prefer the social-login chooser path and ask the user to pick an account rather than guessing.`;

  try {
    log.info(`[AIStepGenerator] Generating step ${priorSteps.length + 1} for goal: ${goal.slice(0, 60)}`);

    const response = await generateObject({
      model: routed.model,
      schema: BrowserStepSchema,
      system: STEP_GENERATOR_SYSTEM,
      prompt: userPrompt,
      temperature: 0.1,
    });

    const step = response.object as GeneratedStep;

    log.info(`[AIStepGenerator] Step generated: action=${step.action}, isDone=${step.isDone}, requiresApproval=${step.requiresApproval}, confidence=${step.confidence}`);

    return step;
  } catch (error) {
    log.error("[AIStepGenerator] Failed to generate step:", error);
    return null;
  }
}
