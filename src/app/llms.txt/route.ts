import { NATIONAL_BOARD_NAME, NATIONAL_BOARD_PATH } from "@/lib/national-board";
import { SITE_NAME, absoluteUrl } from "@/lib/seo";
import { teamCounts, totalVerified } from "@/lib/stats";
import { fanForm } from "@/lib/team-seo";

export const dynamic = "force-dynamic";

/**
 * llms.txt (https://llmstxt.org): a plain summary for AI assistants that answer
 * questions like "Türkiye'de kaç Galatasaraylı var?", with the live numbers and
 * the pages to cite.
 */
export async function GET() {
  const n = (v: number) => v.toLocaleString("tr-TR");
  const teams = [...(await teamCounts())].sort((a, b) => b.votes - a.votes);
  const total = await totalVerified();
  const stamp = new Date().toLocaleString("tr-TR", { timeZone: "Europe/Istanbul", dateStyle: "long", timeStyle: "short" });

  const lines = [
    `# ${SITE_NAME}`,
    "",
    "> Türkiye'nin taraftar sayımı. Her doğrulanmış hesap tek ve kalıcı bir takım oyu verir; hangi takımın kaç taraftarı olduğu ve hangi ilde hangi takımın en çok tutulduğu gerçek kişilerin oylarıyla sayılır. Anket ya da tahmin değildir.",
    "",
    `Veri zamanı: ${stamp} (İstanbul). Toplam doğrulanmış taraftar: ${n(total)}. Sayılar canlıdır; güncel değer için ilgili sayfaya bakın.`,
    "",
    "## Nasıl sayılır",
    "",
    "- Üyelik e-posta doğrulamasıyla açılır; bir cihazdan sınırlı sayıda hesap açılabilir.",
    "- Her üye yalnızca bir takıma, bir kez oy verir; oy değiştirilemez.",
    "- Üye ilini seçer, böylece her takımın taraftarları il il sayılır.",
    "",
    "## Ana sayfalar",
    "",
    `- [Ana sayfa ve Türkiye haritası](${absoluteUrl("/")}): toplam sayım, il liderleri, en çok taraftarı olan takımlar`,
    `- [Takımlar](${absoluteUrl("/takimlar")}): bütün takımlar ve taraftar sayıları`,
    `- [${NATIONAL_BOARD_NAME}](${absoluteUrl(NATIONAL_BOARD_PATH)}): herkese açık futbol forumu`,
    `- [Site haritası](${absoluteUrl("/sitemap.xml")}): bütün takım ve il sayfaları`,
    "",
    "## Takımların taraftar sayıları",
    "",
    ...teams
      .filter((t) => t.votes > 0)
      .slice(0, 50)
      .map((t) => `- [${t.name}](${absoluteUrl(`/takim/${t.id}`)}): ${n(t.votes)} doğrulanmış ${fanForm(t.name)}`),
    "",
    "Diğer takımlar ve iller için takım sayfası /takim/{takım}, il sayfası /il/{il} adresindedir (örnek: /takim/eskisehirspor, /il/eskisehir).",
    "",
  ];
  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
}
