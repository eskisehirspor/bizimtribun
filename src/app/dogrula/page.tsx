"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { getTeam } from "@/lib/teams";

function Confirm() {
  const params = useSearchParams();
  const token = params.get("token") || "";
  const [state, setState] = useState<
    | { status: "idle" }
    | {
        status: "ok";
        teamId: string;
        city: string;
        phoneVerified: boolean;
        phoneVerificationRequired: boolean;
        voted: boolean;
      }
    | { status: "err"; error: string }
  >({ status: "idle" });
  const [busy, setBusy] = useState(false);
  const [voteMsg, setVoteMsg] = useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    const res = await fetch("/api/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const data = await res.json();
    if (!res.ok) setState({ status: "err", error: data.error });
    else {
      window.history.replaceState(null, "", "/dogrula");
      setState({
        status: "ok",
        teamId: data.teamId,
        city: data.city,
        phoneVerified: Boolean(data.phoneVerified),
        phoneVerificationRequired: Boolean(data.phoneVerificationRequired),
        voted: Boolean(data.voted),
      });
    }
    setBusy(false);
  }

  async function castVote() {
    setBusy(true);
    setVoteMsg(null);
    const res = await fetch("/api/vote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    if (!res.ok) setVoteMsg(data.error || "Oy verilemedi.");
    else {
      setState((prev) =>
        prev.status === "ok"
          ? {
              ...prev,
              voted: true,
              teamId: data.teamId || prev.teamId,
              city: data.city || prev.city,
            }
          : prev,
      );
      setVoteMsg(data.message);
    }
    setBusy(false);
  }

  const team = state.status === "ok" ? getTeam(state.teamId) : undefined;

  return (
    <main className="min-h-screen bg-[#F2EFE6] paper-bg flex items-center justify-center p-6">
      <div className="w-full max-w-[520px] bg-[#FFFEFA] border-[4px] border-black shadow-[12px_12px_0_black] p-7 -rotate-[0.5deg]">
        <div className="font-mono text-[10px] tracking-[0.2em]">BİZİM TRİBÜN • MÜHÜR</div>
        {state.status === "ok" ? (
          <>
            <h1 className="font-anton text-[44px] leading-[0.85] mt-3">
              E-POSTA
              <br />
              <span className="bg-[#FFEA00] px-2 inline-block rotate-1">TAMAM</span>
            </h1>
            <p className="font-marker text-[22px] mt-4">
              {team?.name} • {state.city}
            </p>
            {state.voted ? (
              <p className="font-mono text-[13px] mt-3">
                Mührün basıldı. Sayımda yerin var.
              </p>
            ) : state.phoneVerified || !state.phoneVerificationRequired ? (
              <>
                <p className="font-mono text-[13px] mt-3">
                  {state.phoneVerified
                    ? "Kimliğin doğrulandı. Oyunu açıkça bas."
                    : "E-posta doğrulandı. Oyunu açıkça bas."}
                </p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void castVote()}
                  className="mt-5 w-full font-anton text-[18px] py-3 bg-black text-white border-[3px] border-black disabled:bg-zinc-300"
                >
                  {busy ? "…" : "OYUMU VER"}
                </button>
              </>
            ) : (
              <p className="font-mono text-[13px] mt-3">
                E-posta doğrulandı. Telefon doğrulaması bitince oyunu verebilirsin.
              </p>
            )}
            {voteMsg && <p className="font-mono text-[12px] mt-3">{voteMsg}</p>}
          </>
        ) : state.status === "err" ? (
          <>
            <h1 className="font-anton text-[44px] leading-[0.85] mt-3">
              LİNK
              <br />
              <span className="bg-[#C8102E] text-white px-2 inline-block">YIRTIK</span>
            </h1>
            <p className="font-mono text-[13px] mt-4">{state.error}</p>
          </>
        ) : (
          <>
            <h1 className="font-anton text-[44px] leading-[0.85] mt-3">
              SON
              <br />
              <span className="bg-black text-[#FFEA00] px-2 inline-block">ADIM</span>
            </h1>
            <p className="font-mono text-[13px] mt-4">
              Bu e-postanın sahibi sen isen doğrula. Oy, ayrı bir adımda basılır.
            </p>
            <button
              type="button"
              disabled={!token || busy}
              onClick={() => void confirm()}
              className="mt-5 w-full font-anton text-[18px] py-3 bg-black text-white border-[3px] border-black disabled:bg-zinc-300"
            >
              {busy ? "…" : "E-POSTAYI DOĞRULA"}
            </button>
          </>
        )}
        <Link
          href="/"
          className="mt-6 inline-block font-anton text-[16px] bg-white text-black px-4 py-2 border-[3px] border-black"
        >
          TRİBÜNE DÖN
        </Link>
      </div>
    </main>
  );
}

export default function DogrulaPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#F2EFE6]" />}>
      <Confirm />
    </Suspense>
  );
}
