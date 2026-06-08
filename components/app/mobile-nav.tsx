"use client";

import { MenuIcon } from "lucide-react";
import type { Department, Role } from "@prisma/client";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SideNav } from "@/components/app/side-nav";

export function MobileNav(props: { role: Role; department: Department | null }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="border-slate-200 bg-white text-slate-700 shadow-[0_12px_28px_-22px_rgba(15,23,42,0.25)] hover:bg-slate-50 lg:hidden"
          aria-label="Abrir navegação"
        >
          <MenuIcon className="size-4" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f7fbff_100%)] p-0 text-slate-950">
        <div className="h-full p-5">
          <SheetHeader className="mb-5 pr-10">
            <SheetTitle className="text-slate-950">Central de Clientes</SheetTitle>
            <SheetDescription className="text-slate-500">
              Navegação operacional do portal, ajustada para o seu perfil.
            </SheetDescription>
          </SheetHeader>
          <SideNav role={props.role} department={props.department} variant="mobile" />
        </div>
      </SheetContent>
    </Sheet>
  );
}
