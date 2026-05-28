import assert from "node:assert/strict";
import test from "node:test";
import {
  buildBrowserTaskInstruction,
  describeQuickOpenTarget,
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
