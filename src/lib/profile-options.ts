/** Profile constants shared by the server and the settings form. */
export const PROFILE_BIO_MAX = 280;
export const PROFILE_DISPLAY_NAME_MAX = 40;

/** Preset avatars; no photo uploads yet (no file storage is configured). */
export const AVATARS = ["atki", "bayrak", "davul", "megafon", "top", "kupa", "yildiz", "kartal"] as const;
export type AvatarKey = (typeof AVATARS)[number];
export const AVATAR_EMOJI: Record<AvatarKey, string> = {
  atki: "🧣",
  bayrak: "🚩",
  davul: "🥁",
  megafon: "📣",
  top: "⚽",
  kupa: "🏆",
  yildiz: "⭐",
  kartal: "🦅",
};
