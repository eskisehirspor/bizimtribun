"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAdminCan } from "@/components/admin/AdminShell";
import { AdminCard, AdminNotice, adminJson, formatWhen } from "@/components/admin/AdminUi";
import { btnAccent, btnSecondary, btnSm, btnSmAccent, hintClass } from "@/components/ui";

type Dashboard = {
  totalMembers: number;
  activeMembers: number;
  totalTopics: number;
  totalPosts: number;
  activeBans: number;
  activeForumTeams: number;
  validVotes: number;
  phoneVerifiedMembers: number;
  emailVerifiedMembers: number;
  legacyCensusVotes: number;
  signups: { day: number; week: number; month: number };
  newTopicsWeek: number;
  newPostsWeek: number;
  openReports: number;
  heldItems: number;
  teamDistribution: { teamId: string; name: string; votes: number }[];
  provinceDistribution: { province: string; votes: number }[];
  votesWithoutProvince: number;
  suspicious: {
    otpRequests: number;
    otpLockouts: number;
    signupPeakHour: number;
    deniedAdminAttempts: number;
    failedStaffLogins: number;
    votesVoided30d: number;
  };
  recentAdmin: {
    id: number;
    action: string;
    targetType: string | null;
    targetId: string | null;
    reason: string | null;
    createdAt: string;
    actor: string | null;
  }[];
  recent: Array<{
    id: number;
    action: string;
    reason: string | null;
    createdAt: string;
    moderatorUsername: string;
    targetUsername: string | null;
    targetTopicId: number | null;
    targetPostId: number | null;
  }>;
};

export default function AdminDashboardPage() {
  const can = useAdminCan();
  if (!can("dashboard.view")) return <ModeratorHome />;
  return <DashboardView />;
}

function ModeratorHome() {
  return (
    <div>
      <h2 className="font-anton text-[32px] leading-[1.05]">MODERATÖR</h2>
      <p className="font-mono text-[12px] mt-2">
        Forum içeriğini yönetebilir, bekleyen içerikleri onaylayabilir ve normal üyeleri
        banlayabilirsin. Rol, oy ve site ayarları yöneticilere açık.
      </p>
      <div className="flex flex-wrap gap-2 mt-4">
        <Link href="/admin/moderasyon" className={btnAccent}>
          MODERASYON KUYRUĞU
        </Link>
        <Link href="/admin/forum" className={btnSecondary}>
          FORUM
        </Link>
      </div>
    </div>
  );
}

function Distribution({
  title,
  rows,
  total,
  footnote,
}: {
  title: string;
  rows: { key: string; label: string; votes: number }[];
  total: number;
  footnote?: string;
}) {
  return (
    <div className="border-[3px] border-black bg-[#FFFEFA] p-3">
      <h4 className="font-anton text-[16px]">{title}</h4>
      {rows.length === 0 ? (
        <p className="font-mono text-[12px] opacity-70 mt-1">Henüz geçerli oy yok.</p>
      ) : (
        <ul className="mt-2 space-y-1">
          {rows.map((r) => {
            const pct = total ? Math.round((r.votes / total) * 1000) / 10 : 0;
            return (
              <li key={r.key} className="font-mono text-[12px]">
                <div className="flex justify-between gap-2">
                  <span className="truncate">{r.label}</span>
                  <span className="tabular-nums">
                    {r.votes.toLocaleString("tr-TR")} • %{pct.toLocaleString("tr-TR")}
                  </span>
                </div>
                <div className="h-[6px] bg-black/10">
                  <div className="h-full bg-black" style={{ width: `${pct}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {footnote && <p className={`mt-2 ${hintClass}`}>{footnote}</p>}
    </div>
  );
}

function DashboardView() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminJson<Dashboard>("/api/admin/dashboard")
      .then(setData)
      .catch((err: Error) => setError(err.message));
  }, []);

  if (error) return <AdminNotice kind="error">{error}</AdminNotice>;
  if (!data) return <AdminNotice kind="loading">Yükleniyor…</AdminNotice>;

  return (
    <div>
      <h2 className="font-anton text-[32px] leading-[1.05]">DASHBOARD</h2>
      <p className="font-mono text-[12px] mt-1 opacity-60">
        Canlı veritabanı sayıları. Silinmiş hesaplar ve kaldırılmış içerik sayılmaz.
      </p>
      <h3 className="font-anton text-[20px] mt-5">ÜYELER VE OYLAR</h3>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-2">
        <AdminCard title="AKTİF HESAP" value={data.activeMembers} hint="Silinmemiş ve banlı olmayan" />
        <AdminCard title="TELEFONU DOĞRULANMIŞ" value={data.phoneVerifiedMembers} hint="SMS ile doğrulanmış, silinmemiş" />
        <AdminCard title="E-POSTASI DOĞRULANMIŞ" value={data.emailVerifiedMembers} hint="Yalnızca e-posta ile doğrulanmış, silinmemiş" />
        <AdminCard title="GEÇERLİ TAKIM OYU" value={data.validVotes} hint="Durumu aktif fan_votes kaydı" />
        <AdminCard title="AKTİF BAN" value={data.activeBans} />
        <AdminCard title="YENİ KAYIT (24 SAAT)" value={data.signups.day} />
        <AdminCard title="YENİ KAYIT (7 GÜN)" value={data.signups.week} />
        <AdminCard title="YENİ KAYIT (30 GÜN)" value={data.signups.month} />
        <AdminCard
          title="ESKİ SAYIM OYU"
          value={data.legacyCensusVotes}
          hint="E-postalı eski sayım; hiçbir sayaca girmez"
        />
      </div>

      <h3 className="font-anton text-[20px] mt-5">FORUM VE MODERASYON</h3>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-2">
        <AdminCard title="YENİ KONU (7 GÜN)" value={data.newTopicsWeek} hint={`Toplam yayında: ${data.totalTopics}`} />
        <AdminCard title="YENİ YORUM (7 GÜN)" value={data.newPostsWeek} hint={`Toplam yayında: ${data.totalPosts}`} />
        <AdminCard title="AÇIK RAPOR" value={data.openReports} />
        <AdminCard title="ONAY BEKLEYEN" value={data.heldItems} hint="Otomatik incelemeye düşen konu ve yorum" />
      </div>
      <div className="flex flex-wrap gap-2 mt-3">
        <Link href="/admin/moderasyon" className={btnSmAccent}>
          MODERASYON KUYRUĞU
        </Link>
        <Link href="/admin/bildirimler" className={btnSm}>
          ÜYE BİLDİRİMLERİ
        </Link>
      </div>

      <h3 className="font-anton text-[20px] mt-5">ŞÜPHELİ HAREKET GÖSTERGELERİ</h3>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mt-2">
        <AdminCard title="SMS KODU TALEBİ (24 SAAT)" value={data.suspicious.otpRequests} hint="Üretimde her biri ücretli SMS" />
        <AdminCard title="KİLİTLENEN KOD (24 SAAT)" value={data.suspicious.otpLockouts} hint="Çok fazla yanlış deneme" />
        <AdminCard title="EN YOĞUN SAATTE KAYIT" value={data.suspicious.signupPeakHour} hint="Son 24 saatte tek saatteki en çok kayıt" />
        <AdminCard title="YETKİSİZ YÖNETİM DENEMESİ" value={data.suspicious.deniedAdminAttempts} hint="Son 24 saat, giriş yapmış üyeler" />
        <AdminCard title="BAŞARISIZ YÖNETİCİ GİRİŞİ" value={data.suspicious.failedStaffLogins} hint="Son 24 saat, şifre/2FA" />
        <AdminCard title="İPTAL EDİLEN OY (30 GÜN)" value={data.suspicious.votesVoided30d} hint="Gerekçeli, denetim kaydında" />
      </div>

      <div className="grid md:grid-cols-2 gap-4 mt-5">
        <Distribution
          title="TAKIM DAĞILIMI (İLK 10)"
          rows={data.teamDistribution.map((r) => ({ key: r.teamId, label: r.name, votes: r.votes }))}
          total={data.validVotes}
        />
        <Distribution
          title="İL DAĞILIMI (İLK 10)"
          rows={data.provinceDistribution.map((r) => ({ key: r.province, label: r.province, votes: r.votes }))}
          total={data.validVotes}
          footnote={data.votesWithoutProvince ? `${data.votesWithoutProvince} oyda il seçilmemiş.` : undefined}
        />
      </div>

      <h3 className="font-anton text-[22px] mt-6">SON YÖNETİM İŞLEMLERİ</h3>
      {data.recentAdmin.length === 0 ? (
        <AdminNotice kind="empty">Henüz kayıt yok.</AdminNotice>
      ) : (
        <ul className="mt-2 border-[3px] border-black bg-[#FFFEFA] divide-y-[2px] divide-black font-mono text-[12px]">
          {data.recentAdmin.map((row) => (
            <li key={row.id} className="p-2 flex flex-wrap gap-x-3">
              <span className="opacity-60">{formatWhen(row.createdAt)}</span>
              <span>{row.actor ?? "sistem"}</span>
              <span className="font-bold">{row.action}</span>
              <span className="opacity-70">
                {row.targetType ? `${row.targetType} ${row.targetId ?? ""}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
      <Link href="/admin/denetim" className="inline-block mt-2 font-mono text-[12px] underline">
        Tüm denetim kaydı
      </Link>

      <h3 className="font-anton text-[22px] mt-6">SON MODERASYON</h3>
      {data.recent.length === 0 ? (
        <AdminNotice kind="empty">Henüz kayıt yok.</AdminNotice>
      ) : (
        <div className="overflow-x-auto border-[3px] border-black bg-[#FFFEFA] mt-2">
          <table className="w-full text-left font-mono text-[12px]">
            <thead className="bg-black text-[#FFEA00]">
              <tr>
                <th className="p-2">Tarih</th>
                <th className="p-2">Mod</th>
                <th className="p-2">İşlem</th>
                <th className="p-2">Hedef</th>
                <th className="p-2">Gerekçe</th>
              </tr>
            </thead>
            <tbody>
              {data.recent.map((row) => (
                <tr key={row.id} className="border-t-[2px] border-black">
                  <td className="p-2 whitespace-nowrap">{formatWhen(row.createdAt)}</td>
                  <td className="p-2">{row.moderatorUsername}</td>
                  <td className="p-2">{row.action}</td>
                  <td className="p-2">
                    {row.targetUsername ||
                      (row.targetTopicId ? `konu #${row.targetTopicId}` : "") ||
                      (row.targetPostId ? `mesaj #${row.targetPostId}` : "—")}
                  </td>
                  <td className="p-2 max-w-[240px] truncate">{row.reason || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
