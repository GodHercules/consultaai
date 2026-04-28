"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@prisma/client";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; admin?: boolean };

const items: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", admin: true },
  { href: "/companies", label: "Consulta avançada" },
  { href: "/import", label: "Importação Excel", admin: true },
  { href: "/import/history", label: "Histórico importação", admin: true },
  { href: "/admin/users", label: "Gestão usuários", admin: true },
  { href: "/admin/audit", label: "Auditoria", admin: true },
  { href: "/profile", label: "Perfil" },
  { href: "/profile/change-password", label: "Alterar senha" },
];

export function SideNav(props: { role: Role }) {
  const pathname = usePathname();
  const visible = items.filter((i) => !i.admin || props.role === "ADMIN");

  return (
    <nav className="flex flex-col gap-1">
      {visible.map((item) => {
        const active =
          pathname === item.href ||
          (item.href !== "/" && pathname.startsWith(item.href + "/"));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
              active && "bg-accent text-accent-foreground",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
