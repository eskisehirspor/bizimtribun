"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function Form() {
  const token = useSearchParams().get("token") || "";
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [devLink, setDevLink] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function requestLink(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    setMsg(data.message || data.error);
    if (data.devLink) setDevLink(data.devLink);
  }

  async function confirm() {
    const res = await fetch("/api/delete", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const data = await res.json();
    if (!res.ok) setMsg(data.error);
    else setDone(true);
  }

  return (
    <main className="min-h-screen bg-[#F2EFE6] paper-bg flex items-center justify-center p-6">
      <div className="w-full max-w-[520px] bg-[#FFFEFA] border-[4px] border-black shadow-[8px_8px_0_black] p-7">
        <h1 className="font-anton text-[36px] leading-[0.9]">VERİLERİMİ SİL</h1>
        {done ? (
          <p className="font-mono text-[13px] mt-4">
            Kayıt silindi / anonimleştirildi. Mühür sayımdan düştü.
          </p>
        ) : token ? (
          <>
            <p className="font-mono text-[13px] mt-4">
              Bu işlem geri alınmaz. Açık ad, e-posta ve telefon silinir; mühür
              sayımdan düşer. Aynı e-posta veya telefonla yeni mühür basılamaz.
            </p>
            <button
              type="button"
              onClick={() => void confirm()}
              className="mt-4 font-anton bg-[#C8102E] text-white px-4 py-2 border-[3px] border-black"
            >
              SİLMEYİ ONAYLA
            </button>
          </>
        ) : (
          <form onSubmit={(e) => void requestLink(e)} className="mt-4 space-y-3">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border-[3px] border-black px-3 py-2 font-mono"
              placeholder="kayıtlı e-posta"
            />
            <button className="font-anton bg-black text-white px-4 py-2 border-[3px] border-black">
              SİLME LİNKİ GÖNDER
            </button>
          </form>
        )}
        {msg && <p className="font-mono text-[12px] mt-3">{msg}</p>}
        {devLink && (
          <p className="font-mono text-[11px] mt-2 break-all">
            <a className="underline" href={devLink}>
              {devLink}
            </a>
          </p>
        )}
        <Link href="/" className="mt-6 inline-block font-anton underline">
          Ana sayfa
        </Link>
      </div>
    </main>
  );
}

export default function SilPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#F2EFE6]" />}>
      <Form />
    </Suspense>
  );
}
