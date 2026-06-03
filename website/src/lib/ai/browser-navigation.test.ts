import assert from "node:assert/strict";
import test from "node:test";
import {
  buildClickyProductBuildDeliverableInstruction,
  buildBrowserTaskInstruction,
  describeQuickOpenTarget,
  hasClickyOperatorBrowserIntent,
  hasClickyProductBuildIntent,
  inferQuickStartUrl,
  shouldAskForSignupAccountIdentifier,
  shouldAskForSignupTarget,
  shouldForceBrowserTaskFirstStep,
} from "./browser-navigation.ts";

test("forces browser routing for short brand-style open commands", () => {
  assert.equal(shouldForceBrowserTaskFirstStep("open rearvy"), true);
  assert.equal(shouldForceBrowserTaskFirstStep("open google"), true);
  assert.equal(shouldForceBrowserTaskFirstStep("go to github"), true);
  assert.equal(shouldForceBrowserTaskFirstStep("login to gmail"), true);
  assert.equal(shouldForceBrowserTaskFirstStep("sign in to example.com"), true);
});

test("does not force browser routing for obvious local targets", () => {
  assert.equal(shouldForceBrowserTaskFirstStep("open settings"), false);
  assert.equal(shouldForceBrowserTaskFirstStep("open C:\\temp\\notes.txt"), false);
  assert.equal(shouldForceBrowserTaskFirstStep("open again"), false);
  assert.equal(shouldForceBrowserTaskFirstStep("open it again"), false);
});

test("forces Clicky operator-style website and competitor workflows", () => {
  assert.equal(
    hasClickyOperatorBrowserIntent(
      "clicky go on competitors page log in find screenshots and show it to me"
    ),
    true
  );
  assert.equal(
    shouldForceBrowserTaskFirstStep(
      "open website goes on competitors page logs in finds screenshot then shows it to user"
    ),
    true
  );
  assert.equal(
    shouldForceBrowserTaskFirstStep("make product like their competitor page"),
    true
  );
  assert.equal(
    hasClickyOperatorBrowserIntent("open C:\\temp\\competitor-notes.txt"),
    false
  );
});

test("infers quick-open URLs for common destinations", () => {
  assert.equal(inferQuickStartUrl("open rearvy"), "https://www.rearvy.com");
  assert.equal(inferQuickStartUrl("open google"), "https://www.google.com");
  assert.equal(inferQuickStartUrl("open github"), "https://github.com");
  assert.equal(
    inferQuickStartUrl("open shooopify"),
    "https://www.shopify.com"
  );
  assert.equal(
    inferQuickStartUrl("signin for shopify"),
    "https://www.shopify.com/login"
  );
  assert.equal(
    inferQuickStartUrl("signin for shooopify"),
    "https://www.shopify.com/login"
  );
  assert.equal(
    inferQuickStartUrl("sign in to shopify.com"),
    "https://www.shopify.com/login"
  );
  assert.equal(
    inferQuickStartUrl("visit docs", "google docs"),
    "https://docs.google.com/document"
  );
});

test("starts broad Clicky competitor research from search results", () => {
  const startUrl = inferQuickStartUrl(
    "Clicky go on competitors page, find screenshots, then make product like that"
  );
  if (!startUrl) {
    throw new Error("Expected a Clicky research search URL.");
  }
  assert.ok(startUrl.startsWith("https://www.google.com/search?q="));
  assert.match(decodeURIComponent(startUrl), /competitors/);
  assert.match(decodeURIComponent(startUrl), /screenshots/);

  const domainCompetitorSearch = inferQuickStartUrl(
    "Clicky research competitors of rearvy.com and find onboarding screenshots"
  );
  if (!domainCompetitorSearch) {
    throw new Error("Expected a domain competitor research search URL.");
  }
  assert.ok(domainCompetitorSearch.startsWith("https://www.google.com/search?q="));
  assert.match(decodeURIComponent(domainCompetitorSearch), /rearvy\.com/);

  assert.equal(
    inferQuickStartUrl("Clicky inspect competitor.com screenshots"),
    "https://competitor.com"
  );
  assert.equal(inferQuickStartUrl("login to shopify"), "https://www.shopify.com/login");
});

test("describes quick-open targets from known URLs", () => {
  assert.equal(
    describeQuickOpenTarget(null, "https://www.rearvy.com"),
    "Rearvy"
  );
  assert.equal(describeQuickOpenTarget(null, "https://github.com"), "GitHub");
});

test("does not infer ambiguous or overly short brand typos", () => {
  assert.equal(inferQuickStartUrl("open shop"), null);
  assert.equal(inferQuickStartUrl("open gitlub"), null);
});

test("asks for a target before generic signup automation", () => {
  assert.equal(shouldAskForSignupTarget("can u signup for me"), true);
  assert.equal(shouldAskForSignupTarget("can u login for me"), true);
  assert.equal(shouldAskForSignupTarget("sign up for Shopify"), false);
  assert.equal(shouldAskForSignupTarget("login to shooopify"), false);
  assert.equal(shouldAskForSignupTarget("login to Gmail"), false);
  assert.equal(shouldAskForSignupTarget("create an account at example.com"), false);
});

test("asks for an email before known signup automation", () => {
  assert.equal(shouldAskForSignupAccountIdentifier("sign up for Shopify"), true);
  assert.equal(shouldAskForSignupAccountIdentifier("create an account at example.com"), true);
  assert.equal(
    shouldAskForSignupAccountIdentifier("sign up for Shopify with hello@rearvy.com"),
    false
  );
  assert.equal(shouldAskForSignupAccountIdentifier("login to Shopify"), false);
  assert.equal(shouldAskForSignupAccountIdentifier("signup for me"), false);
});

test("builds auth browser tasks that preserve login intent", () => {
  const task = buildBrowserTaskInstruction({
    userText: "signin for shopify",
    startUrl: "https://www.shopify.com/login",
    targetLabel: "Shopify",
  });

  assert.match(task, /Shopify at https:\/\/www\.shopify\.com\/login/);
  assert.match(task, /sign-in/);
  assert.match(task, /Scan the full page text/);
  assert.match(task, /scroll through the page/);
  assert.match(task, /Stop before entering passwords/);
});

test("builds Clicky operator browser tasks with evidence and safety instructions", () => {
  const task = buildBrowserTaskInstruction({
    userText:
      "Clicky open website, go on competitors page, log in, find screenshots, then show user product ideas",
    startUrl: null,
    targetLabel: "the requested page",
  });

  assert.match(task, /Clicky's browser operator/);
  assert.match(task, /competitor pages/);
  assert.match(task, /Capture screenshots or visual evidence/);
  assert.match(task, /pause for the user to complete passwords/);
  assert.match(task, /Do not submit purchases/);
  assert.match(task, /product ideas or implementation notes/);
});

test("builds Clicky product briefs from competitor research requests", () => {
  const userText =
    "Clicky go on competitor pages, find screenshots, then make product like that";
  const task = buildBrowserTaskInstruction({
    userText,
    startUrl: null,
    targetLabel: "the requested page",
  });

  assert.equal(hasClickyProductBuildIntent(userText), true);
  assert.match(task, /build-ready product brief/);
  assert.match(task, /what to copy conceptually and what to avoid copying directly/);
  assert.match(task, /MVP feature list/);
  assert.match(task, /UX flow and screen map/);
  assert.match(task, /data model and API notes/);
  assert.match(task, /first implementation steps for Rearvy\/Clicky/);
  assert.match(task, /Do not submit purchases/);
});

test("product build deliverable instruction is structured", () => {
  const instruction = buildClickyProductBuildDeliverableInstruction();

  assert.match(instruction, /evidence captured/);
  assert.match(instruction, /component\/backlog checklist/);
  assert.match(instruction, /visual asset prompts/);
});
