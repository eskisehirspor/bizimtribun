export function formatForumDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("tr-TR", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
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

export function safeNextPath(raw: string | null) {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/takimlar";
  return raw;
}
