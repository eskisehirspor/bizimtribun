import assert from "node:assert/strict";
import { test } from "node:test";
import { moderateForumContent } from "./engine";
import {
  buildAutoModerationRecord,
  forumWriteMode,
  isPublicForumRow,
  publicModerationError,
} from "./forum-gate";
import type { ModerationRule } from "./types";

const ctx = { surface: "post" as const, userId: 7 };

const BLOCK_RULE: ModerationRule = {
  id: "test.block-marker",
  category: "profanity",
  severity: "high",
  action: "block",
  pattern: "markerword",
};

const REVIEW_RULE: ModerationRule = {
  id: "test.review-hold",
  category: "political",
  severity: "medium",
  action: "review",
  pattern: "holditem",
};

test("allow → yayınlanır", () => {
  const result = moderateForumContent("sakin bir yorum", ctx, {
    rules: [BLOCK_RULE, REVIEW_RULE],
    includeStructural: false,
  });
  assert.equal(result.decision, "allow");
  assert.equal(forumWriteMode(result.decision), "publish");
  assert.equal(buildAutoModerationRecord({ userId: 7, result }), null);
  assert.equal(publicModerationError(result.decision), null);
});

test("review → yayınlanmaz", () => {
  const result = moderateForumContent("bu bir holditem notu", ctx, {
    rules: [BLOCK_RULE, REVIEW_RULE],
    includeStructural: false,
  });
  assert.equal(result.decision, "review");
  assert.equal(forumWriteMode(result.decision), "hold");
  assert.equal(
    isPublicForumRow({ deleted_at: null, held_at: "2026-09-03T10:00:00.000Z" }),
    false,
  );
  const error = publicModerationError(result.decision);
  assert.equal(
    error,
    "İçeriğin topluluk kurallarına uygunluk açısından incelenmek üzere beklemeye alındı.",
  );
  assert.equal(error.includes("markerword"), false);
  assert.equal(JSON.stringify(error).includes("test.review-hold"), false);
});

test("block → yayınlanmaz", () => {
  const result = moderateForumContent("burada markerword var", ctx, {
    rules: [BLOCK_RULE, REVIEW_RULE],
    includeStructural: false,
  });
  assert.equal(result.decision, "block");
  assert.equal(forumWriteMode(result.decision), "none");
});

test("review audit kaydı oluşur", () => {
  const result = moderateForumContent("holditem", ctx, {
    rules: [REVIEW_RULE],
    includeStructural: false,
  });
  const row = buildAutoModerationRecord({
    userId: 7,
    result,
    targetTopicId: 42,
    targetPostId: 9,
  });
  assert.ok(row);
  assert.equal(row.action, "auto_review");
  assert.equal(row.moderatorUserId, 7);
  assert.equal(row.targetUserId, 7);
  assert.equal(row.targetTopicId, 42);
  assert.equal(row.targetPostId, 9);
  assert.equal(row.reason, result.reason);
  assert.equal(row.reason.includes("test.review-hold"), false);
});

test("block audit kaydı mevcut davranışını korur", () => {
  const result = moderateForumContent("markerword", ctx, {
    rules: [BLOCK_RULE],
    includeStructural: false,
  });
  const row = buildAutoModerationRecord({
    userId: 7,
    result,
    targetTopicId: 3,
  });
  assert.ok(row);
  assert.equal(row.action, "auto_block");
  assert.equal(row.targetTopicId, 3);
  assert.equal(row.targetPostId, null);
  assert.equal(row.reason, result.reason);
});
