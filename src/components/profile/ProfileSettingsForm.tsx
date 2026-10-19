"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { errorText, inputClass, Notice, postJson, primaryButton } from "@/components/auth/ui";
import { AVATAR_EMOJI, AVATARS, PROFILE_BIO_MAX, PROFILE_DISPLAY_NAME_MAX, type AvatarKey } from "@/lib/profile-options";

type Settings = {
  displayName: string;
  bio: string;
  avatar: AvatarKey | null;
  visibility: "members" | "public";
  showCity: boolean;
  notifyReplies: boolean;
  notifyMentions: boolean;
  notifyLikes: boolean;
};

type Block = { id: number; username: string; createdAt: string };

function Toggle({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label className="flex items-start gap-2 font-mono text-[12px]">
      <input type="checkbox" className="mt-[3px]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{children}</span>
    </label>
  );
}

export default function ProfileSettingsForm({ username }: { username: string }) {
  const [s, setS] = useState<Settings | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    void (async () => {
      const [a, b] = await Promise.all([
        fetch("/api/account/profile").then((r) => r.json()),
        fetch("/api/account/blocks").then((r) => r.json()),
      ]);
      if (a?.settings) setS(a.settings);
      if (Array.isArray(b?.blocks)) setBlocks(b.blocks);
    })().catch(() => setMsg({ tone: "error", text: "Profil ayarları yüklenemedi." }));
  }, []);

  if (!s) return <p className="font-mono text-[12px]">Yükleniyor…</p>;
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => setS({ ...s, [key]: value });

  async function save() {
    setBusy(true);
    setMsg(null);
    const r = await postJson("/api/account/profile", s, "PATCH");
    setBusy(false);
    if (!r.ok) return setMsg({ tone: "error", text: errorText(r) });
    setS(r.data.settings as Settings);
    setMsg({ tone: "success", text: "Profil kaydedildi." });
  }

  async function unblock(id: number) {
    const r = await postJson("/api/account/blocks", { userId: id, blocked: false });
    if (r.ok) setBlocks((prev) => prev.filter((b) => b.id !== id));
    else setMsg({ tone: "error", text: errorText(r) });
  }

  return (
    <div className="space-y-3">
      <p className="font-mono text-[11px]">
        Profilin: <Link className="underline" href={`/u/${username}`}>/u/{username}</Link>. Kullanıcı adı ve takım
        değiştirilemez.
      </p>
      <label className="block">
        <span className="font-mono text-[10px]">GÖRÜNEN AD (İSTEĞE BAĞLI)</span>
        <input
          className={inputClass}
          maxLength={PROFILE_DISPLAY_NAME_MAX}
          value={s.displayName}
          onChange={(e) => set("displayName", e.target.value)}
        />
      </label>
      <label className="block">
        <span className="font-mono text-[10px]">HAKKINDA ({s.bio.length}/{PROFILE_BIO_MAX})</span>
        <textarea
          className={`${inputClass} min-h-[80px]`}
          maxLength={PROFILE_BIO_MAX}
          value={s.bio}
          onChange={(e) => set("bio", e.target.value)}
        />
      </label>
      <div>
        <span className="font-mono text-[10px]">AVATAR</span>
        <div className="mt-1 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => set("avatar", null)}
            className={`w-11 h-11 border-[3px] border-black font-anton text-[12px] ${s.avatar == null ? "bg-[#FFEA00]" : "bg-white"}`}
            aria-label="Baş harfler"
          >
            ABC
          </button>
          {AVATARS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => set("avatar", key)}
              className={`w-11 h-11 border-[3px] border-black text-[22px] ${s.avatar === key ? "bg-[#FFEA00]" : "bg-white"}`}
              aria-label={key}
            >
              {AVATAR_EMOJI[key]}
            </button>
          ))}
        </div>
      </div>
      <fieldset className="space-y-1">
        <legend className="font-mono text-[10px]">GİZLİLİK</legend>
        <Toggle checked={s.visibility === "public"} onChange={(v) => set("visibility", v ? "public" : "members")}>
          Profilim herkese açık olsun (arama motorlarında görünebilir). Kapalıyken yalnızca giriş yapmış üyeler görür.
        </Toggle>
        <Toggle checked={s.showCity} onChange={(v) => set("showCity", v)}>
          Profilimde ilimi göster.
        </Toggle>
      </fieldset>
      <fieldset className="space-y-1">
        <legend className="font-mono text-[10px]">SİTE İÇİ BİLDİRİMLER</legend>
        <Toggle checked={s.notifyReplies} onChange={(v) => set("notifyReplies", v)}>
          Konularıma yorum gelince
        </Toggle>
        <Toggle checked={s.notifyMentions} onChange={(v) => set("notifyMentions", v)}>
          Biri beni @ ile anınca
        </Toggle>
        <Toggle checked={s.notifyLikes} onChange={(v) => set("notifyLikes", v)}>
          Yazım beğenilince
        </Toggle>
        <p className="font-mono text-[10px] opacity-70">
          Moderasyon, rozet ve hesap güvenliği bildirimleri her zaman gelir. SMS veya e-posta bildirimi gönderilmez.
        </p>
      </fieldset>
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      <button type="button" disabled={busy} onClick={() => void save()} className={primaryButton}>
        {busy ? "KAYDEDİLİYOR…" : "PROFİLİ KAYDET"}
      </button>

      <div className="pt-2">
        <h3 className="font-anton text-[16px]">ENGELLEDİKLERİM</h3>
        {blocks.length === 0 ? (
          <p className="font-mono text-[12px] opacity-70">Kimseyi engellemedin.</p>
        ) : (
          <ul className="font-mono text-[12px] space-y-1 mt-1">
            {blocks.map((b) => (
              <li key={b.id} className="flex items-center gap-2">
                <span>@{b.username}</span>
                <button type="button" className="underline text-[11px]" onClick={() => void unblock(b.id)}>
                  Engeli kaldır
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
