import type { ReactNode } from "react";
import { AppShell } from "@/components/app/app-shell";

export default function AppLayout(props: { children: ReactNode }) {
  return <AppShell>{props.children}</AppShell>;
}

