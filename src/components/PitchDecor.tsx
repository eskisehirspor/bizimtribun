export default function PitchDecor() {
  return (
    <div className="pointer-events-none absolute inset-0 z-[1] overflow-hidden" aria-hidden>
      <img
        src="/stickers/sticker-mesale.png"
        alt=""
        className="hidden md:block absolute top-10 left-2 w-[86px] h-[86px] md:w-[110px] md:h-[110px] -rotate-12 mix-blend-multiply drop-shadow-[3px_3px_0_black] animate-[floaty_6s_ease-in-out_infinite]"
      />
      <img
        src="/stickers/sticker-top-klasik.png"
        alt=""
        className="hidden md:block absolute top-14 right-3 w-[78px] h-[78px] md:w-[100px] md:h-[100px] rotate-12 mix-blend-multiply drop-shadow-[3px_3px_0_black] animate-[floaty_7s_ease-in-out_infinite]"
      />
      <img
        src="/stickers/sticker-krampon.png"
        alt=""
        className="absolute top-[420px] left-1 w-[90px] h-[90px] md:w-[120px] md:h-[120px] -rotate-6 mix-blend-multiply drop-shadow-[3px_3px_0_black]"
        style={{ animationDelay: "0.4s" }}
      />
      <img
        src="/stickers/sticker-cim.png"
        alt=""
        className="absolute top-[520px] right-2 w-[88px] h-[88px] md:w-[115px] md:h-[115px] rotate-[-10deg] mix-blend-multiply drop-shadow-[3px_3px_0_black]"
      />
      <img
        src="/stickers/sticker-mesale.png"
        alt=""
        className="absolute bottom-28 right-8 w-[70px] h-[70px] md:w-[92px] md:h-[92px] rotate-12 scale-x-[-1] mix-blend-multiply opacity-90 drop-shadow-[3px_3px_0_black] animate-[floaty_8s_ease-in-out_infinite]"
      />
      <img
        src="/stickers/sticker-top.png"
        alt=""
        className="hidden md:block absolute bottom-40 left-[18%] w-[72px] h-[72px] rotate-[-18deg] mix-blend-multiply drop-shadow-[3px_3px_0_black]"
      />
    </div>
  );
}
