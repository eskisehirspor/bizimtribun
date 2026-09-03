import fs from "fs";
import path from "path";
import { appUrl } from "./request";

function isProd() {
  return process.env.NODE_ENV === "production";
}

async function sendHtml(to: string, subject: string, html: string, fallbackFile: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    if (isProd()) {
      throw new Error("RESEND_API_KEY yok.");
    }
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

export async function sendVerifyEmail(to: string, token: string) {
  const link = `${appUrl()}/dogrula?token=${token}`;
  const html = `
    <div style="font-family:sans-serif;max-width:480px">
      <h1>Bizim Tribün — mühürü doğrula</h1>
      <p>Tribüne basmak için bu bağlantıya tıkla. Link 24 saat geçerli.</p>
      <p><a href="${link}">${link}</a></p>
      <p style="color:#666;font-size:12px">Bu maili sen istemediysen yok say.</p>
    </div>
  `;
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
  const html = `
    <div style="font-family:sans-serif;max-width:480px">
      <h1>Bizim Tribün — e-postanı doğrula</h1>
      <p>Forumda yazabilmek için bu bağlantıya tıkla. Link 24 saat geçerli ve tek kullanımlık.</p>
      <p><a href="${link}">${link}</a></p>
      <p style="color:#666;font-size:12px">Bu maili sen istemediysen yok say.</p>
    </div>
  `;
  const file = path.join(process.cwd(), "data", "last-user-verify-link.txt");
  const result = await sendHtml(to, "E-postanı doğrula — Bizim Tribün", html, file);
  if (result.dev && !isProd()) {
    fs.writeFileSync(file, `${to}\n${link}\n`, "utf8");
  }
  return { ok: result.ok, dev: result.dev };
}

export async function sendDeleteEmail(to: string, token: string) {
  const link = `${appUrl()}/sil-verilerim?token=${token}`;
  const html = `
    <div style="font-family:sans-serif;max-width:480px">
      <h1>Bizim Tribün — silme talebi</h1>
      <p>Kaydını silmek için bağlantıya tıkla. 24 saat geçerli.</p>
      <p><a href="${link}">${link}</a></p>
    </div>
  `;
  const file = path.join(process.cwd(), "data", "last-delete-link.txt");
  const result = await sendHtml(to, "Verilerini sil — Bizim Tribün", html, file);
  if (result.dev && !isProd()) {
    fs.writeFileSync(file, `${to}\n${link}\n`, "utf8");
    console.log(`[dev delete] ${to} → ${link}`);
  }
  return { ...result, link };
}
