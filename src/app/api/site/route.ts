import { getSettings } from "@/lib/site-settings";

/** Public site state for the banner and footer. Contains no per-user data. */
export async function GET() {
  const s = getSettings();
  return Response.json(
    {
      announcement: s.announcement.active && s.announcement.text ? s.announcement : null,
      maintenance: s.maintenance.enabled ? s.maintenance : null,
      features: s.features,
      socialLinks: s.socialLinks,
    },
    { headers: { "Cache-Control": "public, max-age=15, s-maxage=15" } },
  );
}
