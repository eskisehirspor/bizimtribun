import { redirect } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import { requireAdmin } from "@/lib/admin";
import { permissionsFor, ROLE_LABELS } from "@/lib/permissions";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // security.self is the one staff permission that works before 2FA is on,
  // so a new admin can reach /admin/guvenlik to set it up.
  const gate = await requireAdmin(undefined, "security.self");
  if (!gate.ok) {
    if (gate.status === 401) redirect("/giris?next=/admin");
    return (
      <div className="min-h-screen bg-[#F2EFE6] p-6">
        <div className="max-w-[520px] mx-auto border-[4px] border-black bg-[#FFFEFA] p-6 shadow-[8px_8px_0_black]">
          <p className="font-mono text-[11px] tracking-[0.2em]">403</p>
          <h1 className="font-anton text-[40px] leading-none mt-1">YETKİN YOK</h1>
          <p className="font-mono text-[13px] mt-3">
            Bu alan yalnızca moderatör ve yöneticilere açık. Menüde görünmemesi güvenlik değildir; sunucu
            da reddeder.
          </p>
        </div>
      </div>
    );
  }

  const role = gate.user.role;
  return (
    <AdminShell
      viewer={{
        role,
        roleLabel: ROLE_LABELS[role] ?? role,
        permissions: permissionsFor(role),
      }}
      needs2fa={Number(gate.user.totp_enabled) !== 1}
    >
      {children}
    </AdminShell>
  );
}
