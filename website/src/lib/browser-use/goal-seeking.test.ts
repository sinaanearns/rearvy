import assert from "node:assert/strict";
import test from "node:test";

import {
  rankGoalCandidates,
  isGoalLikelySatisfied,
} from "./goal-seeking.ts";

test("candidate extraction ranks signup links before generic links", () => {
  const ranked = rankGoalCandidates(
    {
      links: [
        { kind: "link", text: "Privacy Policy", href: "/privacy-policy", visible: true },
        { kind: "link", text: "Start free trial", href: "/start", visible: true },
        { kind: "link", text: "Learn more", href: "/features", visible: true },
      ],
      buttons: [
        { kind: "button", text: "Create account", selector: "#create", visible: true },
      ],
    },
    "signup my shopify account"
  );

  assert.equal(ranked[0].text, "Start free trial");
  assert.equal(ranked.some((candidate) => candidate.text === "Privacy Policy"), false);
});

test("goal satisfaction detects account creation pages", () => {
  assert.equal(
    isGoalLikelySatisfied(
      {
        title: "Create your account",
        url: "https://example.com/signup",
        text: "Create your account with email to start your free trial.",
      },
      "sign up for example"
    ),
    true
  );
});
