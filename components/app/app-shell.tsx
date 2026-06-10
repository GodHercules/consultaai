import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/services/auth/session";
import { AppShellFrame } from "@/components/app/app-shell-frame";

export async function AppShell(props: { children: ReactNode }) {
  const session = await getSessionUser();
  if (!session) redirect("/login");

  return (
    <AppShellFrame
      role={session.user.role}
      department={session.user.department ?? null}
      name={session.user.name}
      email={session.user.email}
    >
      {props.children}
    </AppShellFrame>
  );
}
