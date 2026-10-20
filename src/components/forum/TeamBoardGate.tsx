"use client";

import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import ForumShell from "@/components/ForumShell";

export const TEAM_BOARD_CODES = ["TEAM_BOARD_LOGIN", "TEAM_BOARD_OTHER_TEAM"] as const;

export function isTeamBoardCode(code: unknown): code is (typeof TEAM_BOARD_CODES)[number] {
  return TEAM_BOARD_CODES.includes(code as (typeof TEAM_BOARD_CODES)[number]);
}

/** Shown instead of a team tribune to visitors who are not that team's fans. */
export default function TeamBoardGate({ title, next }: { title: string; next: string }) {
  const { user } = useAuth();
  const ownBoard = user?.teamId ? `/takim/${user.teamId}/forum` : null;
  return (
    <ForumShell>
      <div className="max-w-[560px] bg-white border-[4px] border-black shadow-[6px_6px_0_black] p-5">
        <p className="font-mono text-[12px] uppercase tracking-wide">Taraftarlara özel</p>
        <h1 className="font-anton text-[32px] leading-none mt-1">{title.toLocaleUpperCase("tr")}</h1>
        <p className="font-mono text-[14px] mt-3">
          {user
            ? "Takım tribünleri yalnızca o takıma oy veren taraftarlara açık. Kendi takımının tribününde yazabilir, Genel Tribün ve il tribünlerinde herkesle konuşabilirsin."
            : "Takım tribünleri yalnızca o takıma oy veren taraftarlara açık. Giriş yaparsan kendi takımının tribününe girebilirsin."}
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          {!user ? (
            <Link
              href={`/giris?next=${encodeURIComponent(next)}`}
              className="inline-flex min-h-12 items-center font-anton text-[16px] bg-[#FFEA00] border-[3px] border-black px-5"
            >
              GİRİŞ YAP
            </Link>
          ) : ownBoard ? (
            <Link
              href={ownBoard}
              className="inline-flex min-h-12 items-center font-anton text-[16px] bg-black text-white border-[3px] border-black px-5"
            >
              KENDİ TRİBÜNÜME GİT
            </Link>
          ) : (
            <Link
              href="/takim-sec"
              className="inline-flex min-h-12 items-center font-anton text-[16px] bg-[#FFEA00] border-[3px] border-black px-5"
            >
              TAKIMINI SEÇ
            </Link>
          )}
          <Link
            href="/forum/genel"
            className="inline-flex min-h-12 items-center font-anton text-[16px] bg-white border-[3px] border-black px-5"
          >
            GENEL TRİBÜN
          </Link>
        </div>
      </div>
    </ForumShell>
  );
}
