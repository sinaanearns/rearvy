import assert from "node:assert/strict";
import test from "node:test";

import {
  buildGmailComposeUrl,
  buildMailto,
  PRIVACY_CONTACT_EMAIL,
  PUBLIC_CONTACT_EMAIL,
  SECURITY_CONTACT_EMAIL,
} from "./public-contact";

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

test("buildGmailComposeUrl opens a pre-addressed Gmail web draft", () => {
  const gmailUrl = buildGmailComposeUrl(
    "sinaan030@gmail.com",
    "Rearvy contact",
    "Hi Rearvy team,\n\nI wanted to get in touch about...\n"
  );

  assert.equal(
    gmailUrl,
    "https://mail.google.com/mail/?view=cm&fs=1&to=sinaan030%40gmail.com&su=Rearvy+contact&body=Hi+Rearvy+team%2C%0A%0AI+wanted+to+get+in+touch+about...%0A"
  );
});
