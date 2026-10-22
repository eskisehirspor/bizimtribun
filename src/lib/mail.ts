import fs from "fs";
import path from "path";
import { appUrl } from "./request";

const INK = "#111111";
const PAPER = "#F2EFE6";
const CARD = "#FFFEFA";
const YELLOW = "#FFEA00";
const RED = "#C8102E";
const HEAD = "Impact,'Arial Black','Helvetica Neue',Arial,sans-serif";
const BODY = "'Helvetica Neue',Helvetica,Arial,sans-serif";

function esc(value: string) {
  return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/**
 * The site's look in mail form: paper background, black header with the
 * yellow logo, a card with a thick black border. Tables and inline styles
 * only, so it renders the same in Gmail, Outlook and Apple Mail.
 */
export function mailLayout(opts: { preheader: string; title: string; body: string; footer?: string }) {
  const footer = opts.footer ?? "Bu maili sen istemediysen yok say, hesabında bir şey değişmez.";
  return `<!doctype html>
<html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><title>${esc(opts.title)}</title></head>
<body style="margin:0;padding:0;background:${PAPER};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(opts.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${PAPER};">
<tr><td align="center" style="padding:28px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">
<tr><td style="background:${INK};padding:18px 24px;border:4px solid ${INK};">
<span style="font-family:${HEAD};font-size:30px;line-height:1;letter-spacing:1px;font-weight:bold;color:${YELLOW};text-transform:uppercase;">BİZİM TRİBÜN</span><br>
<span style="font-family:${BODY};font-size:12px;letter-spacing:3px;color:${PAPER};text-transform:uppercase;">Taraftarın sesi</span>
</td></tr>
<tr><td style="background:${RED};height:6px;line-height:6px;font-size:0;border-left:4px solid ${INK};border-right:4px solid ${INK};">&nbsp;</td></tr>
<tr><td style="background:${CARD};border:4px solid ${INK};border-top:0;padding:28px 24px;">
<h1 style="margin:0 0 16px;font-family:${HEAD};font-size:28px;line-height:1.1;font-weight:bold;color:${INK};text-transform:uppercase;">${esc(opts.title)}</h1>
${opts.body}
</td></tr>
<tr><td style="padding:16px 4px;font-family:${BODY};font-size:12px;line-height:1.5;color:#555;">
${esc(footer)}<br>
<a href="${esc(appUrl())}" style="color:${INK};font-weight:bold;">bizimtribun.com</a>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

function para(text: string) {
  return `<p style="margin:0 0 14px;font-family:${BODY};font-size:16px;line-height:1.5;color:${INK};">${text}</p>`;
}

function codeBox(code: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 20px;">
<tr><td style="background:${YELLOW};border:4px solid ${INK};padding:14px 22px;font-family:${HEAD};font-size:40px;line-height:1;letter-spacing:10px;font-weight:bold;color:${INK};">${esc(code)}</td></tr>
</table>`;
}

function button(link: string, label: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 18px;">
<tr><td style="background:${RED};border:4px solid ${INK};">
<a href="${esc(link)}" style="display:inline-block;padding:14px 26px;font-family:${HEAD};font-size:20px;letter-spacing:1px;color:#FFFFFF;text-decoration:none;text-transform:uppercase;">${esc(label)}</a>
</td></tr>
</table>
<p style="margin:0 0 14px;font-family:${BODY};font-size:12px;line-height:1.5;color:#555;word-break:break-all;">Düğme çalışmazsa bu adresi tarayıcına yapıştır:<br><a href="${esc(link)}" style="color:${INK};">${esc(link)}</a></p>`;
}

function isProd() {
  return process.env.NODE_ENV === "production";
}

/** Production needs a Resend key; development writes mails to data/. */
export function mailConfigured() {
  return Boolean(process.env.RESEND_API_KEY?.trim()) || !isProd();
}

/** Development without a Resend key: nothing is sent, the code is shown on screen. */
export function isDevMailInbox() {
  return !isProd() && !process.env.RESEND_API_KEY?.trim();
}

async function sendHtml(to: string, subject: string, html: string, fallbackFile: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    if (isProd()) {
      throw new Error("NOT_CONFIGURED");
    }
    fs.mkdirSync(path.dirname(fallbackFile), { recursive: true });
    fs.writeFileSync(fallbackFile, `${to}\n${html}\n`, "utf8");
    console.log(`[dev mail] ${subject} → ${to}`);
    return { ok: true, dev: true };
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.MAIL_FROM || "Bizim Tribün <noreply@bizimtribun.com>",
      to: [to],
      subject,
      html,
    }),
  });
  if (!res.ok) throw new Error("mail_failed");
  return { ok: true, dev: false };
}

/**
 * Sign-in / sign-up code. The code is only in the mail body: never in the
 * subject, never logged. In development without a key the mail is written
 * to data/last-otp-mail.txt instead of being sent.
 */
export async function sendOtpEmail(to: string, code: string) {
  const html = mailLayout({
    preheader: `Kodun: ${code}. 5 dakika geçerli.`,
    title: "Doğrulama kodun",
    body:
      para("Tribüne girmek için bu kodu siteye yaz:") +
      codeBox(code) +
      para("Kod <b>5 dakika</b> geçerli ve tek kullanımlık. Kimseyle paylaşma, Bizim Tribün sana kodu asla sormaz."),
    footer: "Bu kodu sen istemediysen bu maili yok say, hesabına kimse giremez.",
  });
  const file = path.join(process.cwd(), "data", "last-otp-mail.txt");
  await sendHtml(to, "Doğrulama kodun — Bizim Tribün", html, file);
}

export async function sendVerifyEmail(to: string, token: string) {
  const link = `${appUrl()}/dogrula?token=${token}`;
  const html = mailLayout({
    preheader: "Mührünü doğrula, tribüne bas.",
    title: "Mührünü doğrula",
    body: para("Tribüne basmak için aşağıdaki düğmeye tıkla. Bağlantı 24 saat geçerli.") + button(link, "Mührü doğrula"),
  });
  const file = path.join(process.cwd(), "data", "last-verify-link.txt");
  const result = await sendHtml(to, "Mührünü doğrula — Bizim Tribün", html, file);
  if (result.dev && !isProd()) {
    fs.writeFileSync(file, `${to}\n${link}\n`, "utf8");
    console.log(`[dev mail] ${to} → ${link}`);
  }
  return { ...result, link };
}

export async function sendUserVerifyEmail(to: string, token: string) {
  const link = `${appUrl()}/uye-dogrula?token=${token}`;
  const html = mailLayout({
    preheader: "E-postanı doğrula, forumda yazmaya başla.",
    title: "E-postanı doğrula",
    body:
      para("Forumda yazabilmek için aşağıdaki düğmeye tıkla. Bağlantı 24 saat geçerli ve tek kullanımlık.") +
      button(link, "E-postamı doğrula"),
  });
  const file = path.join(process.cwd(), "data", "last-user-verify-link.txt");
  const result = await sendHtml(to, "E-postanı doğrula — Bizim Tribün", html, file);
  if (result.dev && !isProd()) {
    fs.writeFileSync(file, `${to}\n${link}\n`, "utf8");
  }
  return { ok: result.ok, dev: result.dev };
}

export async function sendDeleteEmail(to: string, token: string) {
  const link = `${appUrl()}/sil-verilerim?token=${token}`;
  const html = mailLayout({
    preheader: "Verilerini silme talebin.",
    title: "Verilerini sil",
    body:
      para("Kaydını ve verilerini silmek için aşağıdaki düğmeye tıkla. Bağlantı 24 saat geçerli.") +
      button(link, "Verilerimi sil"),
    footer: "Bu talebi sen yapmadıysan bu maili yok say, hiçbir şey silinmez.",
  });
  const file = path.join(process.cwd(), "data", "last-delete-link.txt");
  const result = await sendHtml(to, "Verilerini sil — Bizim Tribün", html, file);
  if (result.dev && !isProd()) {
    fs.writeFileSync(file, `${to}\n${link}\n`, "utf8");
    console.log(`[dev delete] ${to} → ${link}`);
  }
  return { ...result, link };
}
