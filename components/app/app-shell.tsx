import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/services/auth/session";
import { SideNav } from "@/components/app/side-nav";
import { MobileNav } from "@/components/app/mobile-nav";
import { UserMenu } from "@/components/app/user-menu";

export async function AppShell(props: { children: ReactNode }) {
  const session = await getSessionUser();
  if (!session) redirect("/login");

  return (
    <div className="relative min-h-screen overflow-hidden bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] text-slate-950">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_14%,rgba(148,163,184,0.08),transparent_18%),radial-gradient(circle_at_88%_10%,rgba(148,163,184,0.06),transparent_18%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 animate-slow-grid bg-[linear-gradient(rgba(148,163,184,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.045)_1px,transparent_1px)] bg-[size:92px_92px] opacity-20 [mask-image:radial-gradient(circle_at_center,black_42%,transparent_90%)]"
      />

      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/92 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-[1840px] items-center justify-between gap-3 px-4 sm:px-6 xl:px-10 2xl:px-12">
          <div className="flex min-w-0 items-center gap-3">
            <MobileNav role={session.user.role} department={session.user.department ?? null} />
            <Link href="/companies" className="group flex min-w-0 items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-[1.1rem] border border-[#bfdbfe] bg-[#1d4ed8] text-sm font-semibold text-white shadow-[0_16px_40px_-28px_rgba(29,78,216,0.45)]">
                CC
              </span>
              <span className="hidden min-w-0 sm:block">
                <span className="block text-[0.66rem] font-semibold uppercase tracking-[0.38em] text-slate-500">
                  Central de Clientes
                </span>
                <span className="block truncate text-sm font-medium text-slate-900 transition group-hover:text-slate-700">
                  Workspace operacional
                </span>
              </span>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 shadow-[0_16px_40px_-32px_rgba(15,23,42,0.18)] lg:flex">
              <span className="rounded-full border border-[#bfdbfe] bg-[#dbeafe] px-2.5 py-1 font-medium text-[#1d4ed8]">
                {session.user.role}
              </span>
              <span className="max-w-[18rem] truncate text-slate-500">{session.user.department ?? "Geral"}</span>
            </div>
            <UserMenu name={session.user.name} email={session.user.email} />
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1840px] grid-cols-1 gap-6 px-4 py-6 sm:px-6 xl:px-10 2xl:px-12 lg:grid-cols-[344px_minmax(0,1fr)] lg:py-8 2xl:grid-cols-[368px_minmax(0,1fr)] 2xl:py-10">
        <aside className="hidden lg:block">
          <div className="sticky top-24">
            <SideNav role={session.user.role} department={session.user.department ?? null} />
          </div>
        </aside>

        <main className="min-w-0 pb-6 animate-glass-rise">{props.children}</main>
      </div>
    </div>
  );
}
