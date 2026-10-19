import Link from "next/link";

export default function ForumAuthorName({
  username,
  isTribunLeader,
  link,
}: {
  username: string;
  isTribunLeader?: boolean;
  /** Link to the profile; off inside rows that are already a link. */
  link?: boolean;
}) {
  const deleted = username.startsWith("silinmis_");
  return (
    <span>
      {link && !deleted ? (
        <Link href={`/u/${username}`} className="underline decoration-1 underline-offset-2">
          {username}
        </Link>
      ) : deleted ? (
        "Silinmiş üye"
      ) : (
        username
      )}
      {isTribunLeader ? (
        <span className="ml-1 inline-block font-anton text-[9px] tracking-wide bg-black text-[#FFEA00] border-[2px] border-black px-1 align-middle">
          🏆 TRİBÜN LİDERİ
        </span>
      ) : null}
    </span>
  );
}
