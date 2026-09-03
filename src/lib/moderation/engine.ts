import { normalizeForumContent } from "./normalize";
import { FORUM_CONTENT_RULES } from "./rules";
import type {
  ForumModerationContext,
  ForumModerationResult,
  MatchedRule,
  ModerateForumOptions,
  ModerationCategory,
  ModerationDecision,
  ModerationRule,
  ModerationSeverity,
} from "./types";

const DECISION_RANK: Record<ModerationDecision, number> = {
  allow: 0,
  review: 1,
  block: 2,
};

const SEVERITY_RANK: Record<ModerationSeverity, number> = {
  none: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

const compiled = new Map<string, RegExp>();

function ruleRegex(rule: ModerationRule) {
  const key = `${rule.id}:${typeof rule.pattern === "string" ? rule.pattern : rule.pattern.source}`;
  let re = compiled.get(key);
  if (re) return re;
  re =
    typeof rule.pattern === "string"
      ? new RegExp(escapeRegExp(rule.pattern), "i")
      : new RegExp(rule.pattern.source, rule.pattern.flags.includes("i") ? rule.pattern.flags : `${rule.pattern.flags}i`);
  compiled.set(key, re);
  return re;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function haystacks(normalized: string, compact: string, aggressive: string) {
  return [normalized, compact, aggressive];
}

function structuralHits(
  normalized: string,
  longestRepeat: number,
): MatchedRule[] {
  const hits: MatchedRule[] = [];
  if (longestRepeat >= 10) {
    hits.push({
      id: "struct.char-repeat",
      category: "spam",
      severity: "medium",
      action: "review",
    });
  }

  const tokens = normalized.split(" ").filter((tok) => tok.length >= 3);
  const counts = new Map<string, number>();
  let streak = 1;
  let maxStreak = 1;
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i]!;
    counts.set(tok, (counts.get(tok) || 0) + 1);
    if (i > 0 && tok === tokens[i - 1]) {
      streak += 1;
      if (streak > maxStreak) maxStreak = streak;
    } else {
      streak = 1;
    }
  }
  const maxCount = Math.max(0, ...counts.values());
  if (maxStreak >= 6 || maxCount >= 10) {
    hits.push({
      id: "struct.token-repeat",
      category: "spam",
      severity: "medium",
      action: "review",
    });
  }
  return hits;
}

function uniqueCategories(rules: MatchedRule[]): ModerationCategory[] {
  const seen = new Set<ModerationCategory>();
  const out: ModerationCategory[] = [];
  for (const rule of rules) {
    if (seen.has(rule.category)) continue;
    seen.add(rule.category);
    out.push(rule.category);
  }
  return out;
}

function pickDecision(rules: MatchedRule[]): {
  decision: ModerationDecision;
  severity: ModerationSeverity;
} {
  if (rules.length === 0) return { decision: "allow", severity: "none" };
  let decision: ModerationDecision = "allow";
  let severity: ModerationSeverity = "none";
  for (const rule of rules) {
    if (DECISION_RANK[rule.action] > DECISION_RANK[decision]) {
      decision = rule.action;
    }
    if (SEVERITY_RANK[rule.severity] > SEVERITY_RANK[severity]) {
      severity = rule.severity;
    }
  }
  return { decision, severity };
}

function internalReason(
  decision: ModerationDecision,
  severity: ModerationSeverity,
  categories: ModerationCategory[],
  matchedRules: MatchedRule[],
) {
  if (decision === "allow") return "allow";
  const cats = categories.join(",") || "content";
  const ids = matchedRules
    .map((rule) => rule.id)
    .filter((id) => !id.startsWith("test."))
    .slice(0, 6);
  const tail = ids.length ? `:${ids.join(",")}` : "";
  return `auto:${decision}:${cats}:${severity}${tail}`.slice(0, 500);
}

export function mergeModerationResults(
  results: ForumModerationResult[],
): ForumModerationResult {
  if (results.length === 0) {
    return {
      decision: "allow",
      severity: "none",
      categories: [],
      matchedRules: [],
      normalizedContent: "",
      reason: "allow",
    };
  }
  const matchedRules: MatchedRule[] = [];
  const seen = new Set<string>();
  for (const result of results) {
    for (const rule of result.matchedRules) {
      if (seen.has(rule.id)) continue;
      seen.add(rule.id);
      matchedRules.push(rule);
    }
  }
  const { decision, severity } = pickDecision(matchedRules);
  const categories = uniqueCategories(matchedRules);
  const body = results.find((r) => r.normalizedContent.length > 0);
  return {
    decision,
    severity,
    categories,
    matchedRules,
    normalizedContent: body?.normalizedContent ?? results[0]!.normalizedContent,
    reason: internalReason(decision, severity, categories, matchedRules),
  };
}

export function moderateForumContent(
  content: string,
  _context: ForumModerationContext,
  options: ModerateForumOptions = {},
): ForumModerationResult {
  const folded = normalizeForumContent(content);
  const matchedRules: MatchedRule[] = [];

  if (options.includeStructural !== false) {
    matchedRules.push(
      ...structuralHits(folded.normalized, folded.longestRepeat),
    );
  }

  const rules = [...FORUM_CONTENT_RULES, ...(options.rules ?? [])];
  const texts = haystacks(folded.normalized, folded.compact, folded.aggressive);
  for (const rule of rules) {
    const re = ruleRegex(rule);
    if (texts.some((text) => re.test(text))) {
      matchedRules.push({
        id: rule.id,
        category: rule.category,
        severity: rule.severity,
        action: rule.action,
      });
    }
    re.lastIndex = 0;
  }

  const { decision, severity } = pickDecision(matchedRules);
  const categories = uniqueCategories(matchedRules);
  return {
    decision,
    severity,
    categories,
    matchedRules,
    normalizedContent: folded.normalized,
    reason: internalReason(decision, severity, categories, matchedRules),
  };
}
