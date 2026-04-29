import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Separator } from "@/components/ui/separator";
import { getSessionUser } from "@/services/auth/session";
import { SideNav } from "@/components/app/side-nav";
import { UserMenu } from "@/components/app/user-menu";

export async function AppShell(props: { children: ReactNode }) {
  const session = await getSessionUser();
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <Link href="/" className="text-sm font-semibold tracking-tight">
            Central de Clientes
          </Link>
          <UserMenu name={session.user.name} email={session.user.email} />
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 py-6 md:grid-cols-[240px_1fr]">
        <aside className="hidden md:block">
          <div className="rounded-lg border bg-card p-3">
            <SideNav role={session.user.role} department={session.user.department ?? null} />
          </div>
        </aside>
        <main className="min-w-0">
          <div className="md:hidden">
            <div className="rounded-lg border bg-card p-3">
              <SideNav role={session.user.role} department={session.user.department ?? null} />
            </div>
            <Separator className="my-6" />
          </div>
          {props.children}
        </main>
      </div>
    </div>
  );
}
