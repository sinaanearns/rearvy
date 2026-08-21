import assert from "node:assert/strict";
import test from "node:test";

import { APP_NAME } from "@/lib/utils/constants";
import { getFollowRequestProfileMetadata } from "./follow-requests";

test("getFollowRequestProfileMetadata normalizes user-facing names", () => {
  assert.deepEqual(
    getFollowRequestProfileMetadata({
      full_name: "  RARVILLE  ",
      username: "  agency_owner  ",
    }),
    {
      name: APP_NAME,
      username: "agency_owner",
    }
  );
});

test("getFollowRequestProfileMetadata returns nulls for empty metadata", () => {
  assert.deepEqual(
    getFollowRequestProfileMetadata({
      full_name: "   ",
      username: "",
    }),
    {
      name: null,
      username: null,
    }
  );
  assert.deepEqual(getFollowRequestProfileMetadata(null), {
    name: null,
    username: null,
  });
});
