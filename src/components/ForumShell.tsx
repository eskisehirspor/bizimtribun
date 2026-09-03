export default function ForumShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F2EFE6] text-black relative">
      <div className="pointer-events-none fixed inset-0 z-0 opacity-[0.18] mix-blend-multiply paper-bg" />
      <div className="relative z-10 max-w-[960px] mx-auto px-4 sm:px-5 py-6 md:py-8">
        {children}
      </div>
    </div>
  );
}
