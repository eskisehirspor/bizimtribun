"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  AdminNotice,
  AdminPager,
  adminJson,
  formatWhen,
  useConfirmAction,
} from "@/components/admin/AdminUi";

type Item = {
  id: number;
  targetType: "topic" | "post" | "user";
  targetId: number;
  reason: string;
  note: string | null;
  status: string;
  createdAt: string;
  reporter: string | null;
  handledBy: string | null;
  handledAt: string | null;
  resolutionNote: string | null;
  preview: string | null;
  topicId: number | null;
  authorId: number | null;
  authorUsername: string | null;
  sameTargetOpen: number;
};
type Res = { items: Item[]; total: number; limit: number };

const REASON: Record<string, string> = {
  hakaret: "Hakaret",
  nefret: "Nefret",
  spam: "Spam",
  kisisel_veri: "Kişisel veri",
  siddet: "Şiddet",
  diger: "Diğer",
};
const TYPE: Record<string, string> = { topic: "Konu", post: "Yorum", user: "Üye" };

export default function AdminReportsPage() {
  const { ask, dialog } = useConfirmAction();
  const [status, setStatus] = useState<"open" | "closed">("open");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Res | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await adminJson<Res>(`/api/admin/reports?status=${status}&page=${page}&limit=25`));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Yüklenemedi.");
    }
  }, [status, page]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  function close(item: Item, outcome: "resolved" | "dismissed") {
    ask({
      title: outcome === "resolved" ? "İŞLEM YAPILDI" : "REDDET",
      body:
        outcome === "resolved"
          ? "İçeriği kaldırdıysan veya üyeyi banladıysan bildirimi kapat. Aynı içerikteki tüm açık bildirimler kapanır."
          : "Kural ihlali yok. Aynı içerikteki tüm açık bildirimler kapanır.",
      confirmLabel: "KAPAT",
      onConfirm: async (reason) => {
        await adminJson(`/api/admin/reports/${item.id}`, {
          method: "POST",
          body: JSON.stringify({ outcome, reason }),
        });
        await load();
      },
    });
  }

  return (
    <div>
      {dialog}
      <h2 className="font-anton text-[32px] leading-none">ÜYE BİLDİRİMLERİ</h2>
      <p className="font-mono text-[12px] mt-2">
        Üyelerin şikâyet ettiği konu, yorum ve hesaplar. İçeriği kaldırmak için Forum ekranındaki
        silme işlemini, hesap için ban işlemini kullan; ikisi de denetim kaydına yazılır.
      </p>
      <div className="flex gap-2 mt-3">
        {(["open", "closed"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              setStatus(s);
              setPage(1);
            }}
            className={`font-anton border-[3px] border-black px-3 py-1 ${status === s ? "bg-[#FFEA00]" : "bg-white"}`}
          >
            {s === "open" ? "AÇIK" : "KAPANMIŞ"}
          </button>
        ))}
      </div>
      {error && <div className="mt-3"><AdminNotice kind="error">{error}</AdminNotice></div>}
      {!data && !error && <div className="mt-3"><AdminNotice kind="loading">Yükleniyor…</AdminNotice></div>}
      {data && data.items.length === 0 && (
        <div className="mt-3"><AdminNotice kind="empty">Bildirim yok.</AdminNotice></div>
      )}
      {data && data.items.length > 0 && (
        <ul className="mt-3 space-y-2">
          {data.items.map((r) => (
            <li key={r.id} className="border-[3px] border-black bg-[#FFFEFA] p-3 font-mono text-[12px]">
              <div className="flex flex-wrap gap-2 items-center">
                <span className="bg-black text-[#FFEA00] px-1">{TYPE[r.targetType]}</span>
                <span className="border-[2px] border-black px-1">{REASON[r.reason] ?? r.reason}</span>
                {r.sameTargetOpen > 1 && (
                  <span className="bg-[#C8102E] text-white px-1">{r.sameTargetOpen} açık bildirim</span>
                )}
                <span className="opacity-60">
                  {formatWhen(r.createdAt)} • bildiren @{r.reporter ?? "?"}
                </span>
              </div>
              <p className="mt-2 whitespace-pre-wrap break-words">{r.preview ?? "(içerik bulunamadı)"}</p>
              {r.note && <p className="mt-1 opacity-70">Not: {r.note}</p>}
              <div className="mt-2 flex flex-wrap gap-3 items-center">
                {r.topicId && (
                  <Link className="underline" href={`/forum/konu/${r.topicId}${r.targetType === "post" ? `#yorum-${r.targetId}` : ""}`}>
                    içeriği aç
                  </Link>
                )}
                {r.authorId && (
                  <Link className="underline" href={`/admin/uyeler/${r.authorId}`}>
                    @{r.authorUsername}
                  </Link>
                )}
                {r.status === "open" ? (
                  <>
                    <button type="button" className="font-anton border-[2px] border-black px-2 bg-[#FFEA00]" onClick={() => close(r, "resolved")}>
                      İŞLEM YAPILDI
                    </button>
                    <button type="button" className="font-anton border-[2px] border-black px-2 bg-white" onClick={() => close(r, "dismissed")}>
                      REDDET
                    </button>
                  </>
                ) : (
                  <span className="opacity-70">
                    {r.status === "resolved" ? "işlem yapıldı" : "reddedildi"} • @{r.handledBy} •{" "}
                    {formatWhen(r.handledAt)} • {r.resolutionNote}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {data && (
        <div className="mt-3">
          <AdminPager page={page} total={data.total} limit={data.limit} onPage={setPage} />
        </div>
      )}
    </div>
  );
}
