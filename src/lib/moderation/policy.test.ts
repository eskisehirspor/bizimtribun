import assert from "node:assert/strict";
import { test } from "node:test";
import { moderateForumContent } from "./engine";
import { publicModerationError } from "./forum-gate";

const ctx = { surface: "post" as const, userId: 1 };

function check(content: string) {
  return moderateForumContent(content, ctx);
}

test("futbol tartismasi allow", () => {
  const result = check(
    "Fenerbahçe'nin orta sahası çok yavaştı, aptalca bir hamleydi ama skor adil.",
  );
  assert.equal(result.decision, "allow");
});

test("rakip takim elestirisi allow", () => {
  const result = check("Rakip kaleci büyük hata yaptı, defans da çok açıktı.");
  assert.equal(result.decision, "allow");
});

test("siyaset kelimesi masum allow", () => {
  const result = check("Siyaset konuşmayalım, maça bakalım.");
  assert.equal(result.decision, "allow");
});

test("mac baglaminda siyasi isim allow", () => {
  const result = check("Derbiyi CHP'li başkan da izlemiş, stadyum doluydu.");
  assert.equal(result.decision, "allow");
});

test("kufur kokunun baska kelimede gecmesi allow", () => {
  const result = check("Sıkıntı yok, ikinci yarı toparlarız.");
  assert.equal(result.decision, "allow");
});

test("profanity heavy block", () => {
  const result = check("Bu hakem orospu gibi yönetüyor.");
  assert.equal(result.decision, "block");
  assert.equal(result.severity, "high");
  assert.equal(result.categories.includes("profanity"), true);
  assert.equal(
    result.matchedRules.some((r) => r.id === "profanity.orospu"),
    true,
  );
});

test("profanity light review", () => {
  const result = check("Hakem amk yine ters karar verdi.");
  assert.equal(result.decision, "review");
  assert.equal(result.severity, "medium");
  assert.equal(result.categories.includes("profanity"), true);
});

test("profanity unicode homoglyph block", () => {
  const result = check("Bu \u043erospu karar kabul edilemez.");
  assert.equal(result.decision, "block");
});

test("profanity bosluk bypass block", () => {
  const result = check("o r o s p u gibi hakemlik.");
  assert.equal(result.decision, "block");
});

test("profanity tekrar harf bypass block", () => {
  const result = check("orooosssppu gibi bir yönetim.");
  assert.equal(result.decision, "block");
});

test("insult directed review", () => {
  const result = check("Sen aptalsın, ofsaytı göremedin.");
  assert.equal(result.decision, "review");
  assert.equal(result.categories.includes("insult"), true);
});

test("insult fans directed review", () => {
  const result = check("Rakip takım taraftarı aptal, hiç futbol bilmiyor.");
  assert.equal(result.decision, "review");
  assert.equal(result.categories.includes("insult"), true);
});

test("insult family block", () => {
  const result = check("Senin annen bu maçı görsün.");
  assert.equal(result.decision, "block");
  assert.equal(result.severity, "high");
});

test("insult vs futbol elestirisi false positive", () => {
  const result = check("Bu aptalca bir hamle oldu, orta sahayı boş bırakmışlar.");
  assert.equal(result.decision, "allow");
});

test("threat kill block", () => {
  const result = check("Seni öldüreceğim, tribüne gelme.");
  assert.equal(result.decision, "block");
  assert.equal(result.severity, "critical");
  assert.equal(result.categories.includes("threat"), true);
});

test("threat attack block", () => {
  const result = check("Evinizi yakacağım bu skordan sonra.");
  assert.equal(result.decision, "block");
  assert.equal(result.categories.includes("threat"), true);
});

test("threat false positive is bitirme", () => {
  const result = check("Bu işi ben keserim, ikinci yarıda döneriz.");
  assert.equal(result.decision, "allow");
});

test("hate slur block", () => {
  const result = check("Suriyeliler defolsun buradan.");
  assert.equal(result.decision, "block");
  assert.equal(result.severity, "critical");
  assert.equal(result.categories.includes("hate"), true);
});

test("hate ethnic news mention allow", () => {
  const result = check("Ermeni asıllı oyuncu derbide forma giydi.");
  assert.equal(result.decision, "allow");
});

test("political party vote call block", () => {
  const result = check("CHP'ye oy verin, başka konuşmaya gerek yok.");
  assert.equal(result.decision, "block");
  assert.equal(result.categories.includes("political"), true);
});

test("political campaign review", () => {
  const result = check("Seçim kampanyası için tribünde slogan atmayın.");
  assert.equal(result.decision, "review");
  assert.equal(result.categories.includes("political"), true);
});

test("political kaptana oy verin allow", () => {
  const result = check("Kaptana oy verin, maçın adamı oydu.");
  assert.equal(result.decision, "allow");
});

test("spam promo review", () => {
  const result = check("Deneme bonusu için tıkla, yasal bahis.");
  assert.equal(result.decision, "review");
  assert.equal(result.categories.includes("spam"), true);
});

test("spam tme review", () => {
  const result = check("Katıl t.me/ucuztahmin kanalına.");
  assert.equal(result.decision, "review");
});

test("spam false positive normal link sohbeti allow", () => {
  const result = check("TFF sitesinden fikstüre baktım, derbi pazar.");
  assert.equal(result.decision, "allow");
});

test("kullaniciya rule id sizmamali", () => {
  const blocked = check("Bu hakem orospu gibi yönetiyor.");
  const msg = publicModerationError(blocked.decision);
  assert.equal(
    msg,
    "Bu içerik topluluk kurallarına uygun olmadığı için yayınlanmadı.",
  );
  assert.equal(msg?.includes("profanity.orospu"), false);
  assert.equal(msg?.includes("high"), false);
  assert.ok(blocked.reason.includes("profanity.orospu"));
  assert.ok(blocked.reason.includes("high"));
});

test("review mesaji kullaniciya ic kurallari gostermez", () => {
  const reviewed = check("Deneme bonusu için tıkla, yasal bahis.");
  const msg = publicModerationError(reviewed.decision);
  assert.equal(reviewed.decision, "review");
  assert.equal(
    msg,
    "İçeriğin topluluk kurallarına uygunluk açısından incelenmek üzere beklemeye alındı.",
  );
  assert.equal(msg?.includes("spam"), false);
  assert.equal(msg?.includes("auto:"), false);
  assert.equal(msg?.includes(reviewed.reason), false);
});
