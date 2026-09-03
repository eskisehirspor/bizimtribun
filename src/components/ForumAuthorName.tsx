export default function ForumAuthorName({
  username,
  isTribunLeader,
}: {
  username: string;
  isTribunLeader?: boolean;
}) {
  return (
    <span>
      {username}
      {isTribunLeader ? (
        <span className="ml-1 inline-block font-anton text-[9px] tracking-wide bg-black text-[#FFEA00] border-[2px] border-black px-1 align-middle">
          🏆 TRİBÜN LİDERİ
        </span>
      ) : null}
    </span>
  );
}
