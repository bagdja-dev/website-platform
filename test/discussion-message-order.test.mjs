import assert from "node:assert/strict";
import test from "node:test";

import { sortDiscussionMessages } from "../lib/discussion-message-order.mjs";

test("sorts messages from oldest to newest without mutating the input", () => {
  const newestFirst = [
    { id: "c", createdAt: "2026-11-11T03:00:00.000Z" },
    { id: "b", createdAt: "2026-11-11T02:00:00.000Z" },
    { id: "a", createdAt: "2026-11-11T01:00:00.000Z" },
  ];

  assert.deepEqual(
    sortDiscussionMessages(newestFirst).map((message) => message.id),
    ["a", "b", "c"],
  );
  assert.deepEqual(
    newestFirst.map((message) => message.id),
    ["c", "b", "a"],
  );
});

test("uses message id as a deterministic tie breaker for equal timestamps", () => {
  const messages = [
    { id: "second", createdAt: "2026-11-11T01:00:00.000Z" },
    { id: "first", createdAt: "2026-11-11T01:00:00.000Z" },
  ];

  assert.deepEqual(
    sortDiscussionMessages(messages).map((message) => message.id),
    ["first", "second"],
  );
});
