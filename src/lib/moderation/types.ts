export const MODERATION_CATEGORIES = [
  "profanity",
  "insult",
  "threat",
  "hate",
  "political",
  "spam",
] as const;

export type ModerationCategory = (typeof MODERATION_CATEGORIES)[number];

export const MODERATION_DECISIONS = ["allow", "block", "review"] as const;
export type ModerationDecision = (typeof MODERATION_DECISIONS)[number];

export const MODERATION_SEVERITIES = [
  "none",
  "low",
  "medium",
  "high",
  "critical",
] as const;
export type ModerationSeverity = (typeof MODERATION_SEVERITIES)[number];

export type ModerationRule = {
  id: string;
  category: ModerationCategory;
  severity: ModerationSeverity;
  action: Exclude<ModerationDecision, "allow">;
  pattern: string | RegExp;
};

export type MatchedRule = {
  id: string;
  category: ModerationCategory;
  severity: ModerationSeverity;
  action: Exclude<ModerationDecision, "allow">;
};

export type ForumModerationContext = {
  surface: "topic" | "post";
  field?: "title" | "body";
  userId?: number;
  teamId?: string;
  topicId?: number;
};

export type ForumModerationResult = {
  decision: ModerationDecision;
  severity: ModerationSeverity;
  categories: ModerationCategory[];
  matchedRules: MatchedRule[];
  normalizedContent: string;
  reason: string;
};

export type ModerateForumOptions = {
  /** Extra rules (tests / later list loading). Production list stays empty for now. */
  rules?: ModerationRule[];
  includeStructural?: boolean;
};
