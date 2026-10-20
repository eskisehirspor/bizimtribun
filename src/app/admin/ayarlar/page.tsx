"use client";

import { useEffect, useState } from "react";
import { AdminNotice, adminJson, formatWhen } from "@/components/admin/AdminUi";
import { LEAGUE_LABEL, LEAGUE_ORDER } from "@/lib/teams";
import { btnSmPrimary, checkLabelClass, checkboxClass, fieldClass, hintClass, labelClass } from "@/components/ui";

type Settings = {
  announcement: { active: boolean; text: string; tone: "info" | "warning"; link: string };
  featuredTopics: { ids: number[] };
  socialLinks: { x: string; instagram: string; youtube: string; tiktok: string };
  seo: { siteTitle: string; siteDescription: string };
  homeLeagues: { ids: string[] };
  maintenance: { enabled: boolean; message: string };
  features: {
    signupsOpen: boolean;
    teamRequestsOpen: boolean;
    likesEnabled: boolean;
    generalBoardOpen: boolean;
    cityBoardsOpen: boolean;
  };
};
type Key = keyof Settings;
type Meta = { key: string; updatedAt: string; updatedBy: string | null };

const input = fieldClass;

const FEATURE_LABELS: Record<keyof Settings["features"], string> = {
  signupsOpen: "Yeni üyelik açık",
  teamRequestsOpen: "Takım talepleri açık",
  likesEnabled: "Beğeniler açık",
  generalBoardOpen: "Genel Tribün açık",
  cityBoardsOpen: "İl tribünleri açık",
};

export default function SettingsPage() {
  const [data, setData] = useState<{ settings: Settings; meta: Meta[]; canManageSystem: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminJson<{ settings: Settings; meta: Meta[]; canManageSystem: boolean }>("/api/admin/settings")
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error) return <AdminNotice kind="error">{error}</AdminNotice>;
  if (!data) return <AdminNotice kind="loading">Yükleniyor…</AdminNotice>;
  const meta = (key: Key) => data.meta.find((m) => m.key === key);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-anton text-[32px] leading-none">SİTE AYARLARI</h2>
        <p className="font-mono text-[12px] mt-1 opacity-70">
          Her kayıt denetim kaydına yazılır. Metinler düz yazı olarak gösterilir; HTML veya kod çalışmaz.
        </p>
      </div>

      <Section k="announcement" title="DUYURU BANDI" initial={data.settings.announcement} meta={meta("announcement")}>
        {(v, set) => (
          <>
            <Check label="Duyuruyu göster" value={v.active} onChange={(active) => set({ ...v, active })} />
            <Field label="Metin (en fazla 200 karakter)">
              <input className={input} maxLength={200} value={v.text} onChange={(e) => set({ ...v, text: e.target.value })} />
            </Field>
            <Field label="Bağlantı (isteğe bağlı, https:// veya /forum gibi)">
              <input className={input} value={v.link} onChange={(e) => set({ ...v, link: e.target.value })} />
            </Field>
            <Field label="Ton">
              <select className={input} value={v.tone} onChange={(e) => set({ ...v, tone: e.target.value as "info" | "warning" })}>
                <option value="info">Bilgi (sarı)</option>
                <option value="warning">Uyarı (kırmızı)</option>
              </select>
            </Field>
          </>
        )}
      </Section>

      <Section k="featuredTopics" title="ÖNE ÇIKAN KONULAR" initial={data.settings.featuredTopics} meta={meta("featuredTopics")}>
        {(v, set) => (
          <Field label="Konu numaraları, virgülle (en fazla 5; ana sayfada bu sırayla görünür)">
            <input
              className={input}
              defaultValue={v.ids.join(", ")}
              onChange={(e) =>
                set({
                  ids: e.target.value
                    .split(/[,\s]+/)
                    .map((x) => Number(x))
                    .filter((x) => Number.isInteger(x) && x > 0),
                })
              }
            />
          </Field>
        )}
      </Section>

      <Section k="homeLeagues" title="ANA SAYFADA GÖSTERİLEN LİGLER" initial={data.settings.homeLeagues} meta={meta("homeLeagues")}>
        {(v, set) => (
          <div className="flex flex-wrap gap-3">
            {LEAGUE_ORDER.map((id) => (
              <Check
                key={id}
                label={LEAGUE_LABEL[id]}
                value={v.ids.includes(id)}
                onChange={(on) =>
                  set({ ids: on ? LEAGUE_ORDER.filter((l) => l === id || v.ids.includes(l)) : v.ids.filter((l) => l !== id) })
                }
              />
            ))}
          </div>
        )}
      </Section>

      <Section k="seo" title="ANA SAYFA SEO" initial={data.settings.seo} meta={meta("seo")}>
        {(v, set) => (
          <>
            <Field label="Başlık (en fazla 70)">
              <input className={input} maxLength={70} value={v.siteTitle} onChange={(e) => set({ ...v, siteTitle: e.target.value })} />
            </Field>
            <Field label="Açıklama (en fazla 160)">
              <input
                className={input}
                maxLength={160}
                value={v.siteDescription}
                onChange={(e) => set({ ...v, siteDescription: e.target.value })}
              />
            </Field>
          </>
        )}
      </Section>

      <Section k="socialLinks" title="SOSYAL MEDYA" initial={data.settings.socialLinks} meta={meta("socialLinks")}>
        {(v, set) => (
          <>
            {(["x", "instagram", "youtube", "tiktok"] as const).map((key) => (
              <Field key={key} label={`${key} (https://…)`}>
                <input className={input} value={v[key]} onChange={(e) => set({ ...v, [key]: e.target.value })} />
              </Field>
            ))}
          </>
        )}
      </Section>

      {data.canManageSystem ? (
        <>
          <Section k="maintenance" title="BAKIM MODU" initial={data.settings.maintenance} meta={meta("maintenance")} danger>
            {(v, set) => (
              <>
                <p className="font-mono text-[12px]">
                  Açıkken site okunabilir kalır; üyeler kayıt olamaz, oy veremez, yazamaz ve beğenemez. Yetkililer
                  çalışmaya devam eder.
                </p>
                <Check label="Bakım modu açık" value={v.enabled} onChange={(enabled) => set({ ...v, enabled })} />
                <Field label="Üyelere gösterilecek mesaj">
                  <input className={input} maxLength={200} value={v.message} onChange={(e) => set({ ...v, message: e.target.value })} />
                </Field>
              </>
            )}
          </Section>
          <Section k="features" title="ÖZELLİK AÇ / KAPAT" initial={data.settings.features} meta={meta("features")} danger>
            {(v, set) => (
              <div className="grid sm:grid-cols-2 gap-1">
                {(Object.keys(FEATURE_LABELS) as (keyof Settings["features"])[]).map((key) => (
                  <Check key={key} label={FEATURE_LABELS[key]} value={v[key]} onChange={(on) => set({ ...v, [key]: on })} />
                ))}
              </div>
            )}
          </Section>
        </>
      ) : (
        <AdminNotice kind="empty">Bakım modu ve özellik anahtarları yalnızca süper adminlere açık.</AdminNotice>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      {children}
    </label>
  );
}

function Check({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className={checkLabelClass}>
      <input type="checkbox" className={checkboxClass} checked={value} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

function Section<K extends Key>({
  k,
  title,
  initial,
  meta,
  danger,
  children,
}: {
  k: K;
  title: string;
  initial: Settings[K];
  meta?: Meta;
  danger?: boolean;
  children: (value: Settings[K], set: (v: Settings[K]) => void) => React.ReactNode;
}) {
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saved, setSaved] = useState(meta);

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await adminJson<{ value: Settings[K] }>("/api/admin/settings", {
        method: "PUT",
        body: JSON.stringify({ key: k, value }),
      });
      setValue(res.value);
      setSaved({ key: k, updatedAt: new Date().toISOString(), updatedBy: "sen" });
      setMsg({ ok: true, text: "Kaydedildi." });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Kaydedilemedi." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={`border-[3px] ${danger ? "border-[#C8102E]" : "border-black"} bg-[#FFFEFA] p-4 space-y-2`}>
      <h3 className="font-anton text-[20px]">{title}</h3>
      {children(value, setValue)}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => void save()}
          className={btnSmPrimary}
        >
          {busy ? "KAYDEDİLİYOR…" : "KAYDET"}
        </button>
        {msg && <span className={`font-mono text-[12px] ${msg.ok ? "" : "text-[#C8102E]"}`}>{msg.text}</span>}
        {saved && (
          <span className={hintClass}>
            Son değişiklik: {formatWhen(saved.updatedAt)} {saved.updatedBy ? `• ${saved.updatedBy}` : ""}
          </span>
        )}
      </div>
    </section>
  );
}
