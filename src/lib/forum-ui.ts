export function formatForumDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("tr-TR", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      // Same zone on the server (UTC) and in the browser, so the HTML matches.
      timeZone: "Europe/Istanbul",
    });
  } catch {
    return iso;
  }
}

export function forumApiError(status: number, fallback?: string) {
  if (status === 401) return "Bu işlem için giriş yapman gerekiyor.";
  if (status === 403) {
    return fallback || "Bu işlem için yetkin yok veya hesabın askıda.";
  }
  if (status === 404) return "Kayıt bulunamadı.";
  if (status === 409) return "Bu konu kilitli veya işlem çakıştı.";
  if (status === 429) return "Çok fazla deneme. Biraz sonra tekrar dene.";
  return fallback || "Bir şey ters gitti.";
}

/**
 * Same-site path only. Browsers treat a backslash like "/", so "/\\evil.com" would
 * leave the site; backslashes and control characters are refused outright.
 */
export function safeNextPath(raw: string | null) {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(raw)) {
    return "/takimlar";
  }
  return raw;
}
