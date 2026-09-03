export async function deviceFingerprint() {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.textBaseline = "top";
    ctx.font = "14px Arial";
    ctx.fillStyle = "#C8102E";
    ctx.fillRect(0, 0, 80, 20);
    ctx.fillStyle = "#FFEA00";
    ctx.fillText("bizim-tribun", 2, 2);
  }
  const raw = [
    navigator.userAgent,
    navigator.language,
    navigator.languages?.join(","),
    screen.width,
    screen.height,
    screen.colorDepth,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    navigator.hardwareConcurrency,
    navigator.maxTouchPoints,
    canvas.toDataURL(),
  ].join("|");
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(raw),
  );
  return [...new Uint8Array(buf)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
