import Link from "next/link";

/** Small torch worn by last week's "Haftanın Taraftarı" of a team. */
function FanOfWeekTorch() {
  return (
    <span
      role="img"
      aria-label="Haftanın Taraftarı"
      title="Haftanın Taraftarı"
      className="ml-1 inline-block align-[-2px]"
    >
      <svg width="12" height="16" viewBox="0 0 12 16" aria-hidden="true">
        <path
          d="M6 0.6C7.9 2.6 9.4 4.3 9.4 6.1C9.4 7.9 7.9 9 6 9C4.1 9 2.6 7.9 2.6 6.1C2.6 4.9 3.3 3.9 4.1 3.2C4.2 4.4 4.8 5 5.4 5.2C5 3.7 5.3 2 6 0.6Z"
          fill="#FF6A00"
          stroke="black"
          strokeWidth="0.9"
          strokeLinejoin="round"
        />
        <path d="M6 4.4C6.9 5.3 7.4 6 7.4 6.7C7.4 7.4 6.8 7.9 6 7.9C5.2 7.9 4.6 7.4 4.6 6.7C4.6 6 5.2 5.3 6 4.4Z" fill="#FFEA00" />
        <path d="M2.4 9.6H9.6L8.2 11.2H3.8Z" fill="black" />
        <path d="M4.3 11.2H7.7L6.9 15.4H5.1Z" fill="#8B5A2B" stroke="black" strokeWidth="0.9" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

export default function ForumAuthorName({
  username,
  isFanOfWeek,
  link,
}: {
  username: string;
  isFanOfWeek?: boolean;
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
      {isFanOfWeek && !deleted ? <FanOfWeekTorch /> : null}
    </span>
  );
}
