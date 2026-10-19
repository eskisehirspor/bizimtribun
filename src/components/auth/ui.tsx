export const inputClass =
  "mt-1 w-full border-[3px] border-black px-3 py-2 font-mono text-[14px] outline-none bg-white focus-visible:ring-4 focus-visible:ring-[#FFEA00]";

export const primaryButton =
  "w-full font-anton text-[18px] py-3 border-[3px] border-black bg-black text-white disabled:bg-zinc-300 disabled:text-zinc-600 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-4 focus-visible:outline-[#FFEA00]";

export const secondaryButton =
  "w-full font-anton text-[16px] py-2 border-[3px] border-black bg-white disabled:opacity-50 focus-visible:outline focus-visible:outline-4 focus-visible:outline-[#FFEA00]";

export function Notice({
  tone,
  children,
}: {
  tone: "error" | "info" | "success";
  children: React.ReactNode;
}) {
  const bg =
    tone === "error" ? "bg-[#C8102E]/10" : tone === "success" ? "bg-[#1B7A3A]/10" : "bg-[#FFEA00]/50";
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={`font-mono text-[12px] border-[2px] border-dashed border-black p-2 ${bg}`}
    >
      {children}
    </p>
  );
}

export async function postJson(url: string, body: unknown) {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { ok: res.ok, status: res.status, data };
  } catch {
    return {
      ok: false,
      status: 0,
      data: { error: "Bağlantı kurulamadı. İnternetini kontrol edip tekrar dene." },
    };
  }
}

export function errorText(r: { status: number; data: Record<string, unknown> }) {
  if (typeof r.data.error === "string") return r.data.error;
  if (r.status === 429) return "Çok fazla deneme. Biraz sonra tekrar dene.";
  return "Bir şey ters gitti. Tekrar dene.";
}
