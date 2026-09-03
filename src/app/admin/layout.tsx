import { redirect } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import { requireAdmin } from "@/lib/admin";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const gate = await requireAdmin();
  if (!gate.ok) {
    if (gate.status === 401) redirect("/giris?next=/admin");
    return (
      <div className="min-h-screen bg-[#F2EFE6] p-6">
        <div className="max-w-[520px] mx-auto border-[4px] border-black bg-[#FFFEFA] p-6 shadow-[8px_8px_0_black]">
          <p className="font-mono text-[10px] tracking-[0.2em]">403</p>
          <h1 className="font-anton text-[40px] leading-none mt-1">YETKİN YOK</h1>
          <p className="font-mono text-[13px] mt-3">
            Bu alan yalnızca yöneticilere açık. Menüde görünmemesi güvenlik değildir; sunucu
            da reddeder.
          </p>
        </div>
      </div>
    );
  }

  return <AdminShell>{children}</AdminShell>;
}
