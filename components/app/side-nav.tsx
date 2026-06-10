"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Department, Role } from "@prisma/client";
import type { LucideIcon } from "lucide-react";
import {
  ActivityIcon,
  ChartGanttIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleGaugeIcon,
  FileUpIcon,
  HistoryIcon,
  InboxIcon,
  SearchIcon,
  ShieldCheckIcon,
  SparklesIcon,
  UsersRoundIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  hint: string;
  icon: LucideIcon;
  admin?: boolean;
  department?: Department;
  tone: "cyan" | "violet" | "emerald" | "amber";
};

type NavGroup = {
  title: string;
  subtitle: string;
  items: NavItem[];
};

const groups: NavGroup[] = [
  {
    title: "Operação",
    subtitle: "Fluxo diário, busca e importação.",
    items: [
      { href: "/dashboard", label: "Dashboard", hint: "Painel executivo", icon: CircleGaugeIcon, admin: true, tone: "cyan" },
      { href: "/companies", label: "Consulta avançada", hint: "Busca por empresa", icon: SearchIcon, tone: "violet" },
      { href: "/import", label: "Importação Excel", hint: "Carga em lote", icon: FileUpIcon, admin: true, tone: "amber" },
      { href: "/import/history", label: "Histórico importação", hint: "Últimas execuções", icon: HistoryIcon, admin: true, tone: "cyan" },
      {
        href: "/contabil/andamentos",
        label: "Andamentos (Contábil)",
        hint: "Fluxo operacional",
        icon: ChartGanttIcon,
        department: "CONTABIL",
        tone: "emerald",
      },
    ],
  },
  {
    title: "Administração",
    subtitle: "Governança, auditoria e fila de entrada.",
    items: [
      { href: "/admin/users", label: "Gestão usuários", hint: "Perfis e acessos", icon: UsersRoundIcon, admin: true, tone: "violet" },
      { href: "/admin/pending-companies", label: "Empresas recebidas", hint: "Fila webhook", icon: InboxIcon, admin: true, tone: "amber" },
      { href: "/admin/integrations/fundarmf", label: "Integrações FundarMF", hint: "Eventos e retry", icon: ActivityIcon, admin: true, tone: "cyan" },
      { href: "/admin/audit", label: "Auditoria", hint: "Rastro de eventos", icon: ShieldCheckIcon, admin: true, tone: "emerald" },
      { href: "/admin/andamentos-gantt", label: "Andamentos (Gantt)", hint: "Linha do tempo", icon: ChartGanttIcon, admin: true, tone: "cyan" },
    ],
  },
];

function isVisible(item: NavItem, role: Role, department: Department | null) {
  if (item.admin && role !== "ADMIN") return false;
  if (item.department && role !== "ADMIN" && department !== item.department) return false;
  return true;
}

function toneStyles(active: boolean) {
  return active
    ? "bg-[#1d4ed8] text-white ring-[#bfdbfe]"
    : "bg-slate-100 text-slate-600 ring-slate-200";
}

function activeAccent() {
  return "from-[#dbeafe] via-[#60a5fa] to-[#1d4ed8]";
}

function NavLink(props: { item: NavItem; active: boolean; collapsed?: boolean }) {
  const Icon = props.item.icon;
  const compact = Boolean(props.collapsed);

  return (
    <Link
      href={props.item.href}
      title={compact ? props.item.label : undefined}
      aria-label={props.item.label}
      className={cn(
        "group relative flex items-center gap-3 overflow-hidden rounded-[1.35rem] border px-3 py-3.5 text-sm transition-all duration-200",
        compact ? "justify-center px-2 py-3" : "",
        props.active
          ? "border-[#bfdbfe] bg-white text-slate-950 shadow-[0_14px_36px_-26px_rgba(29,78,216,0.18)]"
          : "border-slate-200 bg-white/80 text-slate-700 hover:border-slate-300 hover:bg-white hover:text-slate-950"
      )}
      aria-current={props.active ? "page" : undefined}
    >
      {props.active ? (
        <span aria-hidden="true" className={cn("absolute inset-x-3 top-0 h-px bg-gradient-to-r opacity-80", activeAccent())} />
      ) : null}

      <span
        aria-hidden="true"
        className={cn(
          "relative flex shrink-0 items-center justify-center rounded-[1rem] border ring-1 transition-transform duration-200 group-hover:scale-[1.02]",
          compact ? "size-10" : "size-11",
          toneStyles(props.active)
        )}
      >
        <Icon className={compact ? "size-4" : "size-4"} />
        {props.active && !compact ? <span className="absolute inset-0 rounded-[1rem] border border-slate-100 opacity-70" /> : null}
      </span>

      {compact ? null : (
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{props.item.label}</span>
          <span className={cn("mt-0.5 block truncate text-xs", props.active ? "text-slate-600" : "text-slate-500")}>
            {props.item.hint}
          </span>
        </span>
      )}

      {props.active && !compact ? (
        <span className="flex size-2.5 items-center justify-center rounded-full bg-[#2563eb] shadow-[0_0_0_7px_rgba(37,99,235,0.12)]" />
      ) : compact ? null : (
        <span className="size-2 rounded-full bg-slate-300 opacity-0 transition group-hover:opacity-100" />
      )}
    </Link>
  );
}

export function SideNav(props: {
  role: Role;
  department: Department | null;
  variant?: "desktop" | "mobile";
  collapsed?: boolean;
  pinned?: boolean;
  onTogglePinned?: () => void;
}) {
  const pathname = usePathname();
  const visibleGroups = groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => isVisible(item, props.role, props.department)),
    }))
    .filter((group) => group.items.length > 0);
  const flattenedItems = visibleGroups.flatMap((group) => group.items);
  const compact = props.variant === "desktop" && Boolean(props.collapsed);

  if (props.variant === "mobile") {
    return (
      <nav className="relative overflow-hidden rounded-[2.35rem] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-4 pb-6 text-slate-950 shadow-[0_24px_60px_-44px_rgba(15,23,42,0.16)]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top_right,rgba(148,163,184,0.12),transparent_34%),radial-gradient(circle_at_top_left,rgba(148,163,184,0.08),transparent_28%)]"
        />

        <div className="relative rounded-[2rem] border border-slate-200 bg-white/92 p-4 backdrop-blur-xl">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[0.62rem] font-semibold uppercase tracking-[0.4em] text-slate-500">Central de Clientes</p>
              <p className="mt-2 font-display text-[1.05rem] leading-tight tracking-[-0.03em] text-slate-950">
                Painel operacional clean
              </p>
            </div>
            <Badge className="border-[#bfdbfe] bg-[#dbeafe] px-2.5 text-[#1d4ed8]">{props.role}</Badge>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-2.5">
              <div className="text-[0.62rem] uppercase tracking-[0.3em] text-slate-500">Modo</div>
              <div className="mt-1 text-sm font-medium text-slate-900">Contextual</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-2.5">
              <div className="text-[0.62rem] uppercase tracking-[0.3em] text-slate-500">Escopo</div>
              <div className="mt-1 text-sm font-medium text-slate-900">{props.department ?? "Geral"}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-2.5">
              <div className="text-[0.62rem] uppercase tracking-[0.3em] text-slate-500">Status</div>
              <div className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-[#2563eb]">
                <SparklesIcon className="size-3.5" />
                Ao vivo
              </div>
            </div>
          </div>

          <p className="mt-4 max-w-xs text-sm leading-6 text-slate-600">
            {props.department
              ? `Acesso segmentado para ${props.department}. A navegação prioriza as rotas mais úteis no seu contexto.`
              : "Navegação segura para consultas, gestão e auditoria com leitura mais limpa e rápida."}
          </p>
        </div>

        <div className="relative mt-5 space-y-5">
          {visibleGroups.map((group) => (
            <section key={group.title} className="space-y-3">
              <div className="flex items-end justify-between gap-3 px-1">
                <div>
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.42em] text-slate-500">{group.title}</p>
                  <p className="mt-1 text-xs text-slate-500">{group.subtitle}</p>
                </div>
                <span className="hidden h-px flex-1 bg-gradient-to-r from-transparent via-slate-200 to-transparent sm:block" />
              </div>
              <div className="space-y-2">
                {group.items.map((item) => {
                  const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(`${item.href}/`));
                  return <NavLink key={item.href} item={item} active={active} />;
                })}
              </div>
            </section>
          ))}
        </div>

        <div className="relative mt-5 rounded-[1.45rem] border border-slate-200 bg-white/85 p-4">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-[1rem] border border-[#bfdbfe] bg-[#dbeafe] text-[#1d4ed8]">
              <SparklesIcon className="size-4" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium text-slate-950">Contexto ativo</div>
              <div className="mt-1 text-xs leading-5 text-slate-500">
                {props.department ?? "Geral"} · {props.role} · leitura otimizada para decisões.
              </div>
            </div>
          </div>
        </div>
      </nav>
    );
  }

  return (
    <nav
      className={cn(
        "relative h-full overflow-hidden rounded-[2.35rem] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] text-slate-950 shadow-[0_24px_60px_-44px_rgba(15,23,42,0.16)]",
        compact ? "p-3" : "p-4"
      )}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top_right,rgba(148,163,184,0.12),transparent_34%),radial-gradient(circle_at_top_left,rgba(148,163,184,0.08),transparent_28%)]"
      />

      <div className={cn("relative rounded-[2rem] border border-slate-200 bg-white/92 backdrop-blur-xl", compact ? "p-3" : "p-4")}>
        <div className={cn("flex items-start", compact ? "justify-center" : "justify-between gap-4")}>
          {compact ? (
            <div className="flex min-w-0 flex-col items-center gap-2">
              <div className="flex size-11 items-center justify-center rounded-[1.1rem] border border-[#bfdbfe] bg-[#1d4ed8] text-sm font-semibold text-white shadow-[0_16px_40px_-28px_rgba(29,78,216,0.45)]">
                CC
              </div>
              <div className="text-[0.6rem] font-semibold uppercase tracking-[0.34em] text-slate-500">Menu</div>
            </div>
          ) : (
            <div className="min-w-0">
              <p className="text-[0.62rem] font-semibold uppercase tracking-[0.4em] text-slate-500">Central de Clientes</p>
              <p className="mt-2 font-display text-[1.05rem] leading-tight tracking-[-0.03em] text-slate-950">
                Painel operacional clean
              </p>
            </div>
          )}

          <div className={cn("flex items-center", compact ? "absolute right-3 top-3" : "gap-2")}>
            <Badge className={cn("border-[#bfdbfe] bg-[#dbeafe] px-2.5 text-[#1d4ed8]", compact && "hidden")}>
              {props.role}
            </Badge>
            {props.onTogglePinned ? (
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-9 rounded-full border-slate-200 bg-white text-slate-600 shadow-none hover:bg-slate-50"
                onClick={props.onTogglePinned}
                aria-label={props.pinned ? "Recolher sidebar" : "Fixar sidebar"}
                title={props.pinned ? "Recolher sidebar" : "Fixar sidebar"}
              >
                {props.pinned ? <ChevronLeftIcon className="size-4" /> : <ChevronRightIcon className="size-4" />}
              </Button>
            ) : null}
          </div>
        </div>

        {compact ? (
          <div className="mt-4 space-y-2">
            {flattenedItems.map((item) => {
              const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(`${item.href}/`));
              return <NavLink key={item.href} item={item} active={active} collapsed />;
            })}
          </div>
        ) : (
          <>
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-2.5">
                <div className="text-[0.62rem] uppercase tracking-[0.3em] text-slate-500">Modo</div>
                <div className="mt-1 text-sm font-medium text-slate-900">Contextual</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-2.5">
                <div className="text-[0.62rem] uppercase tracking-[0.3em] text-slate-500">Escopo</div>
                <div className="mt-1 text-sm font-medium text-slate-900">{props.department ?? "Geral"}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-2.5">
                <div className="text-[0.62rem] uppercase tracking-[0.3em] text-slate-500">Status</div>
                <div className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-[#2563eb]">
                  <SparklesIcon className="size-3.5" />
                  Ao vivo
                </div>
              </div>
            </div>

            <p className="mt-4 max-w-xs text-sm leading-6 text-slate-600">
              {props.department
                ? `Acesso segmentado para ${props.department}. A navegação prioriza as rotas mais úteis no seu contexto.`
                : "Navegação segura para consultas, gestão e auditoria com leitura mais limpa e rápida."}
            </p>
          </>
        )}
      </div>

      {compact ? null : (
        <div className="relative mt-5 space-y-5">
          {visibleGroups.map((group) => (
            <section key={group.title} className="space-y-3">
              <div className="flex items-end justify-between gap-3 px-1">
                <div>
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.42em] text-slate-500">{group.title}</p>
                  <p className="mt-1 text-xs text-slate-500">{group.subtitle}</p>
                </div>
                <span className="hidden h-px flex-1 bg-gradient-to-r from-transparent via-slate-200 to-transparent sm:block" />
              </div>
              <div className="space-y-2">
                {group.items.map((item) => {
                  const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(`${item.href}/`));
                  return <NavLink key={item.href} item={item} active={active} />;
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {compact ? null : (
        <div className="relative mt-5 rounded-[1.45rem] border border-slate-200 bg-white/85 p-4">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-[1rem] border border-[#bfdbfe] bg-[#dbeafe] text-[#1d4ed8]">
              <SparklesIcon className="size-4" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium text-slate-950">Contexto ativo</div>
              <div className="mt-1 text-xs leading-5 text-slate-500">
                {props.department ?? "Geral"} · {props.role} · leitura otimizada para decisões.
              </div>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
