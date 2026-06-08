"use client";

import { useRouter } from "next/navigation";
import { ChevronDownIcon, LogOutIcon, UserCircle2Icon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

export function UserMenu(props: { name: string; email: string }) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="max-w-[260px] justify-between gap-3 rounded-full border-slate-200 bg-white px-3 text-slate-700 shadow-[0_12px_28px_-22px_rgba(15,23,42,0.2)] hover:bg-slate-50"
        >
          <span className="flex min-w-0 items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-full border border-[#bfdbfe] bg-[#1d4ed8] text-xs font-semibold text-white">
              {props.name
                .split(" ")
                .map((part) => part[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </span>
            <span className="min-w-0 truncate text-left">{props.name}</span>
          </span>
          <ChevronDownIcon className="size-4 text-slate-400" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 border-slate-200 bg-popover/98 text-popover-foreground shadow-[0_24px_60px_-34px_rgba(15,23,42,0.2)]">
        <DropdownMenuLabel className="space-y-1">
          <span className="block truncate text-sm text-slate-950">{props.name}</span>
          <span className="block truncate text-xs text-slate-500">{props.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push("/profile")}>
          <UserCircle2Icon className="size-4" />
          Perfil
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive">
          <LogOutIcon className="size-4" />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
