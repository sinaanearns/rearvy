import assert from "node:assert/strict";
import test from "node:test";

import { metadata as blogMetadata } from "./blog/page";
import { metadata as contactMetadata } from "./contact/page";
import { metadata as downloadMetadata } from "./download/layout";
import { metadata as privacyMetadata } from "./privacy-policy/page";
import { metadata as reportIssueMetadata } from "./report-issue/page";
import { metadata as securityMetadata } from "./security/page";
import { metadata as termsMetadata } from "./terms/page";

const publicMetadata = [
  ["/blog", blogMetadata],
  ["/contact", contactMetadata],
  ["/download", downloadMetadata],
  ["/privacy-policy", privacyMetadata],
  ["/report-issue", reportIssueMetadata],
  ["/security", securityMetadata],
  ["/terms", termsMetadata],
] as const;

test("public marketing pages expose explicit titles and descriptions", () => {
  for (const [pathname, metadata] of publicMetadata) {
    assert.equal(typeof metadata.title, "string", pathname);
    assert.match(String(metadata.title), /Rearvy/, pathname);
    assert.equal(typeof metadata.description, "string", pathname);
    assert.ok(String(metadata.description).length >= 40, pathname);
  }
});
