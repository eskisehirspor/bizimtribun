import type { ModerationRule } from "./types";
import { bounded, boundedPhrase, leadingBounded } from "./tr-pattern";

function rule(
  id: string,
  category: ModerationRule["category"],
  severity: ModerationRule["severity"],
  action: ModerationRule["action"],
  pattern: RegExp,
): ModerationRule {
  return { id, category, severity, action, pattern };
}

/**
 * Production forum policy. One readable rule per pattern — not a single mega-regex.
 * Matching uses token boundaries so stems like "sikinti" do not hit "siktir".
 */
export const FORUM_CONTENT_RULES: readonly ModerationRule[] = [
  rule("profanity.orospu", "profanity", "high", "block", leadingBounded(["orospu"])),
  rule(
    "profanity.orospucocugu",
    "profanity",
    "high",
    "block",
    boundedPhrase([["orospu", "cocugu"], ["orospu", "cocuk"]]),
  ),
  rule("profanity.amcik", "profanity", "high", "block", leadingBounded(["amcik"])),
  rule(
    "profanity.amina-koy",
    "profanity",
    "high",
    "block",
    boundedPhrase([
      ["amina", "koyayim"],
      ["amina", "koyim"],
      ["amini", "sikeyim"],
    ]),
  ),
  rule(
    "profanity.siktir",
    "profanity",
    "high",
    "block",
    leadingBounded(["siktir", "hassiktir", "sikerim", "sikeyim"]),
  ),
  rule("profanity.yarrak", "profanity", "high", "block", leadingBounded(["yarrak"])),
  rule(
    "profanity.pic-word",
    "profanity",
    "high",
    "block",
    bounded(["pici", "picler"]),
  ),
  rule("profanity.pezevenk", "profanity", "high", "block", bounded(["pezevenk"])),
  rule("profanity.kahpe", "profanity", "high", "block", bounded(["kahpe"])),
  rule("profanity.gavat", "profanity", "high", "block", bounded(["gavat"])),
  rule(
    "profanity.got-target",
    "profanity",
    "high",
    "block",
    bounded(["gotune", "gotunu", "gotunden"]),
  ),
  rule("profanity.amk", "profanity", "medium", "review", bounded(["amk", "aq"])),
  rule("profanity.sikko", "profanity", "medium", "review", bounded(["sikko"])),

  rule(
    "insult.family-annen",
    "insult",
    "high",
    "block",
    boundedPhrase([
      ["senin", "annen"],
      ["ananin", "ami"],
      ["ananin", "amcigi"],
      ["anani", "sikeyim"],
      ["bacini", "sikeyim"],
    ]),
  ),
  rule(
    "insult.you-medium",
    "insult",
    "medium",
    "review",
    boundedPhrase([
      ["sen", "aptalsin"],
      ["sen", "salaksin"],
      ["sen", "gerizekalisin"],
      ["sen", "ahmak"],
    ]),
  ),
  rule(
    "insult.fans-directed",
    "insult",
    "medium",
    "review",
    boundedPhrase([
      ["taraftari", "aptal"],
      ["taraftarlari", "aptal"],
      ["taraftari", "salak"],
      ["taraftarlari", "salak"],
      ["taraftari", "gerizekali"],
    ]),
  ),

  rule(
    "threat.kill",
    "threat",
    "critical",
    "block",
    boundedPhrase([
      ["seni", "oldurecegim"],
      ["seni", "oldururum"],
      ["sizi", "oldurecegiz"],
      ["gebertirim"],
      ["katledecegim"],
    ]),
  ),
  rule(
    "threat.attack",
    "threat",
    "critical",
    "block",
    boundedPhrase([
      ["seni", "vuracagim"],
      ["kafani", "kiracagim"],
      ["boynunu", "keserim"],
      ["seni", "keserim"],
      ["evini", "yakacagim"],
      ["evinizi", "yakacagim"],
      ["stadi", "yakacagim"],
      ["saldiracagim"],
    ]),
  ),

  rule("hate.slur-ibne", "hate", "critical", "block", bounded(["ibne", "ibneler"])),
  rule(
    "hate.expel-group",
    "hate",
    "critical",
    "block",
    boundedPhrase([
      ["suriyeliler", "defolsun"],
      ["multeciler", "defolsun"],
      ["multecileri", "kovun"],
      ["hepsini", "oldurun"],
    ]),
  ),
  rule(
    "hate.ethnic-slur-phrase",
    "hate",
    "critical",
    "block",
    boundedPhrase([
      ["ermeni", "pici"],
      ["yahudi", "pici"],
    ]),
  ),
  rule(
    "hate.unclear-cleanse",
    "hate",
    "high",
    "review",
    boundedPhrase([["irkci", "cozum"]]),
  ),

  rule(
    "political.party-vote-call",
    "political",
    "high",
    "block",
    /(?:^|[^a-z0-9])(?:akp|chp|mhp|hdp|ysp)[^a-z0-9]{0,4}ye oy verin(?:[^a-z0-9]|$)|(?:^|[^a-z0-9])(?:akp|chp|mhp|hdp|ysp)yeoyverin(?:[^a-z0-9]|$)|(?:^|[^a-z0-9])adayimizi destekleyin(?:[^a-z0-9]|$)/i,
  ),
  rule(
    "political.campaign",
    "political",
    "medium",
    "review",
    boundedPhrase([
      ["secim", "kampanyasi"],
      ["mitinge", "gelin"],
      ["parti", "propagandasi"],
      ["sandiga", "gidin"],
      ["siyasi", "kutuplasma"],
    ]),
  ),

  rule(
    "spam.promo-bonus",
    "spam",
    "medium",
    "review",
    boundedPhrase([
      ["deneme", "bonusu"],
      ["yasal", "bahis"],
      ["takipci", "satisi"],
      ["ucuz", "takipci"],
    ]),
  ),
  rule(
    "spam.promo-channel",
    "spam",
    "medium",
    "review",
    boundedPhrase([["telegram", "kanali"], ["telegramdan", "yazin"]]),
  ),
  rule(
    "spam.tme",
    "spam",
    "medium",
    "review",
    /(?:^|[^a-z0-9])t\.me(?:[^a-z0-9]|$)|(?:^|[^a-z0-9])tme(?:[^a-z0-9]|$)/i,
  ),
  rule(
    "spam.click-win",
    "spam",
    "medium",
    "review",
    boundedPhrase([
      ["tikla", "kazan"],
      ["linkten", "katil"],
    ]),
  ),
];
