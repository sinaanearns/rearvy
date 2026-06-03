import assert from "node:assert/strict";
import test from "node:test";

import { buildMailto, PRIVACY_CONTACT_EMAIL, PUBLIC_CONTACT_EMAIL, SECURITY_CONTACT_EMAIL } from "./public-contact";

test("public contact emails resolve to one shared inbox", () => {
  assert.equal(PUBLIC_CONTACT_EMAIL, "myrearvy@gmail.com");
  assert.equal(PRIVACY_CONTACT_EMAIL, PUBLIC_CONTACT_EMAIL);
  assert.equal(SECURITY_CONTACT_EMAIL, PUBLIC_CONTACT_EMAIL);
});

test("buildMailto encodes subject and body", () => {
  const mailto = buildMailto(PUBLIC_CONTACT_EMAIL, "Rearvy contact", "Hello team\nNeed help");

  assert.equal(
    mailto,
    "mailto:myrearvy@gmail.com?subject=Rearvy+contact&body=Hello+team%0ANeed+help"
  );
});
