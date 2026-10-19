"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import Link from "next/link";
import type { Department, Role } from "@/types/roles";
import { MobileNav } from "@/components/app/mobile-nav";
import { SideNav } from "@/components/app/side-nav";
import { UserMenu } from "@/components/app/user-menu";
import { cn } from "@/lib/utils";

const SIDEBAR_STORAGE_KEY = "central-clientes.sidebarPinnedOpen";
const sidebarListeners = new Set<() => void>();

function getSidebarPinnedOpen() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function subscribeSidebar(listener: () => void) {
  sidebarListeners.add(listener);
  return () => sidebarListeners.delete(listener);
}

function setSidebarPinnedOpen(value: boolean) {
  try {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, value ? "1" : "0");
  } catch {
    // Storage is an enhancement; navigation still works without it.
  }
  sidebarListeners.forEach((listener) => listener());
}

export function AppShellFrame(props: { role: Role; department: Department | null; name: string; email: string; children: ReactNode }) {
  const pinnedOpen = useSyncExternalStore(subscribeSidebar, getSidebarPinnedOpen, () => false);
  const sidebarCollapsed = !pinnedOpen;

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-40 bg-card">
        <div className="mx-auto flex h-16 max-w-[1840px] items-center justify-between gap-3 px-4 sm:px-6 xl:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <MobileNav role={props.role} department={props.department} />
            <Link href="/companies" className="group flex min-w-0 items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-semibold text-primary-foreground">CC</span>
              <span className="hidden min-w-0 sm:block"><span className="block text-xs text-muted-foreground">Central de Clientes</span><span className="block truncate text-sm font-semibold text-foreground group-hover:text-primary">Painel operacional</span></span>
            </Link>
          </div>
          <div className="flex items-center gap-3"><span className="hidden text-sm text-muted-foreground md:block">{props.department ?? "Visão geral"}</span><UserMenu name={props.name} email={props.email} /></div>
        </div>
      </header>

      <div className={cn("mx-auto grid w-full max-w-[1840px] grid-cols-1 gap-5 px-4 py-5 sm:px-6 lg:gap-5 lg:px-6 lg:py-6 xl:px-8", sidebarCollapsed ? "lg:grid-cols-[4.5rem_minmax(0,1fr)]" : "lg:grid-cols-[18rem_minmax(0,1fr)]")}>
        <aside className="hidden lg:block"><div className="sticky top-[5.5rem] h-[calc(100dvh-6.5rem)]"><SideNav role={props.role} department={props.department} variant="desktop" collapsed={sidebarCollapsed} pinned={pinnedOpen} onTogglePinned={() => setSidebarPinnedOpen(!pinnedOpen)} /></div></aside>
        <main className="relative min-w-0 pb-8">{props.children}</main>
      </div>
    </div>
  );
}
