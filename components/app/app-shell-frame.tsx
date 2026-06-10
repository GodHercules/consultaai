"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import type { Department, Role } from "@prisma/client";
import { MobileNav } from "@/components/app/mobile-nav";
import { SideNav } from "@/components/app/side-nav";
import { UserMenu } from "@/components/app/user-menu";

const SIDEBAR_STORAGE_KEY = "central-clientes.sidebarPinnedOpen";

export function AppShellFrame(props: {
  role: Role;
  department: Department | null;
  name: string;
  email: string;
  children: ReactNode;
}) {
  const [pinnedOpen, setPinnedOpen] = useState(false);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
      if (stored === "1") {
        const timer = window.setTimeout(() => setPinnedOpen(true), 0);
        return () => window.clearTimeout(timer);
      }
    } catch {
      // Ignore storage failures and fall back to the default collapsed state.
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, pinnedOpen ? "1" : "0");
    } catch {
      // Ignore storage failures.
    }
  }, [pinnedOpen]);

  const expanded = pinnedOpen || hovered;

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
            <MobileNav role={props.role} department={props.department} />
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
                {props.role}
              </span>
              <span className="max-w-[18rem] truncate text-slate-500">{props.department ?? "Geral"}</span>
            </div>
            <UserMenu name={props.name} email={props.email} />
          </div>
        </div>
      </header>

      <aside
        className="fixed left-4 top-24 bottom-4 z-30 hidden lg:block"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div
          className={[
            "h-full overflow-hidden rounded-[2.35rem] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] text-slate-950 shadow-[0_24px_60px_-44px_rgba(15,23,42,0.16)] transition-[width] duration-300 ease-out",
            expanded ? "w-[19rem]" : "w-[4.75rem]",
          ].join(" ")}
        >
          <SideNav
            role={props.role}
            department={props.department}
            variant="desktop"
            collapsed={!expanded}
            pinned={pinnedOpen}
            onTogglePinned={() => setPinnedOpen((value) => !value)}
          />
        </div>
      </aside>

      <main className="relative min-w-0 pb-6 animate-glass-rise transition-[padding-left] duration-300 lg:pl-[6rem] lg:pr-6 lg:pt-6">
        {props.children}
      </main>
    </div>
  );
}
