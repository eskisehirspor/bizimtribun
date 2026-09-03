import assert from "node:assert/strict";
import { test } from "node:test";
import { moderateForumContent } from "./engine";
import { normalizeForumContent } from "./normalize";
import type { ModerationRule } from "./types";

const ctx = { surface: "post" as const, userId: 1 };

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

const INSULT_RULE: ModerationRule = {
  id: "test.review-insult",
  category: "insult",
  severity: "low",
  action: "review",
  pattern: "jabtoken",
};

function run(content: string, rules: ModerationRule[], structural = false) {
  return moderateForumContent(content, ctx, {
    rules,
    includeStructural: structural,
  });
}

test("temiz mesaj allow", () => {
  const original = "Maç güzeldi, herkese saygı.";
  const result = run(original, [BLOCK_RULE, REVIEW_RULE]);
  assert.equal(original, "Maç güzeldi, herkese saygı.");
  assert.equal(result.decision, "allow");
  assert.equal(result.severity, "none");
  assert.deepEqual(result.categories, []);
  assert.deepEqual(result.matchedRules, []);
});

test("mixed case kuralı yakalar", () => {
  const result = run("Bugün MaRkErWoRd yazdım", [BLOCK_RULE]);
  assert.equal(result.decision, "block");
  assert.equal(result.severity, "high");
  assert.deepEqual(result.categories, ["profanity"]);
  assert.equal(result.matchedRules[0]?.id, "test.block-marker");
});

test("whitespace varyasyonu compact haystack ile yakalanır", () => {
  const result = run("marker    word", [BLOCK_RULE]);
  assert.equal(result.decision, "block");
});

test("Unicode / homoglyph varyasyonu yakalanır", () => {
  const cyrillicA = "m\u0430rkerword";
  const result = run(cyrillicA, [BLOCK_RULE]);
  assert.equal(result.decision, "block");
  const folded = normalizeForumContent(cyrillicA);
  assert.match(folded.compact, /markerword/);
});

test("fullwidth Unicode NFKC ile yakalanır", () => {
  const result = run("ｍａｒｋｅｒｗｏｒｄ", [BLOCK_RULE]);
  assert.equal(result.decision, "block");
});

test("spam benzeri karakter tekrarı review", () => {
  const result = moderateForumContent("gol " + "x".repeat(12) + " gol", ctx);
  assert.equal(result.decision, "review");
  assert.equal(result.categories.includes("spam"), true);
  assert.equal(
    result.matchedRules.some((r) => r.id === "struct.char-repeat"),
    true,
  );
});

test("spam benzeri kelime tekrarı review", () => {
  const result = moderateForumContent(
    "echo echo echo echo echo echo echo",
    ctx,
  );
  assert.equal(result.decision, "review");
  assert.equal(
    result.matchedRules.some((r) => r.id === "struct.token-repeat"),
    true,
  );
});

test("rule eklendiğinde allow / review / block ayrışır", () => {
  const allow = run("sakin bir yorum", [BLOCK_RULE, REVIEW_RULE, INSULT_RULE]);
  const review = run("bu bir holditem notu", [
    BLOCK_RULE,
    REVIEW_RULE,
    INSULT_RULE,
  ]);
  const block = run("burada markerword var", [
    BLOCK_RULE,
    REVIEW_RULE,
    INSULT_RULE,
  ]);

  assert.equal(allow.decision, "allow");
  assert.equal(review.decision, "review");
  assert.equal(review.severity, "medium");
  assert.deepEqual(review.categories, ["political"]);
  assert.equal(block.decision, "block");
  assert.equal(block.severity, "high");
});

test("block, review eşleşmesini ezer", () => {
  const result = run("holditem ve markerword", [BLOCK_RULE, REVIEW_RULE]);
  assert.equal(result.decision, "block");
  assert.equal(result.matchedRules.length, 2);
});
