import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import type { Department, Role } from "@/types/roles";
import { getBackendSession } from "@/lib/server-backend";
import { AppShellFrame } from "@/components/app/app-shell-frame";

export async function AppShell(props: { children: ReactNode }) {
  const user = await getBackendSession() as { role?: string; department?: string | null; name?: string; email?: string } | null;
  if (!user) redirect("/login");

  return (
    <AppShellFrame
      role={user.role as Role}
      department={user.department as Department | null}
      name={user.name ?? ""}
      email={user.email ?? ""}
    >
      {props.children}
    </AppShellFrame>
  );
}
