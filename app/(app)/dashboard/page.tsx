import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRightIcon,
  BarChart3Icon,
  CircleGaugeIcon,
  FileUpIcon,
  InboxIcon,
  ShieldCheckIcon,
  SparklesIcon,
  UsersRoundIcon,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/services/auth/session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function percent(value: number, total: number) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

function statusMeta(status?: string | null) {
  switch (status) {
    case "FAILED":
      return {
        label: "Falhou",
        className: "border-rose-200 bg-rose-50 text-rose-700",
      };
    case "DONE":
    default:
      return {
        label: "Concluída",
        className: "border-emerald-200 bg-emerald-50 text-emerald-700",
      };
  }
}

function MetricBars(props: { percent: number; tone: "royal" | "sky" | "cobalt" | "navy" }) {
  const palette = {
    royal: ["#dbeafe", "#93c5fd", "#3b82f6", "#1d4ed8"],
    sky: ["#eff6ff", "#bfdbfe", "#60a5fa", "#2563eb"],
    cobalt: ["#e0f2fe", "#7dd3fc", "#38bdf8", "#0ea5e9"],
    navy: ["#e0e7ff", "#c7d2fe", "#818cf8", "#1e40af"],
  }[props.tone];

  const heights = [6, 9, 8, 11, 10, 14, 13, 16, 18, 20, 19, 24];
  const filled = Math.round((props.percent / 100) * heights.length);

  return (
    <div className="mt-4 flex h-10 items-end gap-1.5" aria-label={`Indicador de ${props.percent}%`}>
      {heights.map((height, index) => {
        const isFilled = index < filled;
        const shade = isFilled
          ? palette[Math.min(palette.length - 1, Math.floor((index / Math.max(1, filled)) * palette.length))]
          : "#e2e8f0";

        return (
          <span
            key={`${props.tone}-${index}`}
            className="origin-bottom flex-1 rounded-full transition-all duration-500 ease-out group-hover:scale-y-110 group-hover:brightness-110"
            style={{
              height: `${height}px`,
              backgroundColor: shade,
              opacity: isFilled ? 1 : 0.55,
              transitionDelay: `${index * 18}ms`,
            }}
          />
        );
      })}
    </div>
  );
}

export default async function DashboardPage() {
  const session = await getSessionUser();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/companies");

  const [companiesActiveResult, companiesInactiveResult, usersActiveResult, usersTotalResult, pendingCompaniesResult, lastImportsResult] =
    await Promise.allSettled([
      prisma.company.count({ where: { ativo: true } }),
      prisma.company.count({ where: { ativo: false } }),
      prisma.user.count({ where: { isActive: true } }),
      prisma.user.count(),
      prisma.pendingCompany.count({ where: { status: "PENDING" } }),
          prisma.importHistory.findMany({
            orderBy: { createdAt: "desc" },
            take: 5,
          select: {
            id: true,
            fileName: true,
            total: true,
            created: true,
            updated: true,
            ignored: true,
            suspectedDuplicates: true,
            status: true,
            createdAt: true,
          },
        }),
    ]);

  const companiesActive = companiesActiveResult.status === "fulfilled" ? companiesActiveResult.value : 0;
  const companiesInactive = companiesInactiveResult.status === "fulfilled" ? companiesInactiveResult.value : 0;
  const usersActive = usersActiveResult.status === "fulfilled" ? usersActiveResult.value : 0;
  const usersTotal = usersTotalResult.status === "fulfilled" ? usersTotalResult.value : Math.max(1, usersActive);
  const pendingCompanies = pendingCompaniesResult.status === "fulfilled" ? pendingCompaniesResult.value : 0;
  const lastImports = lastImportsResult.status === "fulfilled" ? lastImportsResult.value : [];

  const companiesTotal = companiesActive + companiesInactive;
  const activeRatio = percent(companiesActive, companiesTotal);
  const inactiveRatio = percent(companiesInactive, companiesTotal);
  const usersActiveRatio = percent(usersActive, Math.max(1, usersTotal));
  const pendingShare = percent(pendingCompanies, Math.max(1, companiesTotal));
  const topImport = lastImports[0];

  return (
    <div className="space-y-6 lg:space-y-8">
      <section className="animate-glass-rise relative overflow-hidden rounded-[3rem] border border-slate-200 bg-white/92 shadow-[0_28px_80px_-52px_rgba(15,23,42,0.18)]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_14%_18%,rgba(29,78,216,0.08),transparent_20%),radial-gradient(circle_at_86%_12%,rgba(96,165,250,0.05),transparent_18%),linear-gradient(115deg,transparent_0%,rgba(255,255,255,0.78)_42%,transparent_100%)]"
        />

        <div className="relative grid gap-6 p-6 lg:gap-8 lg:p-8 xl:grid-cols-[minmax(0,1.16fr)_minmax(360px,0.84fr)]">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#1d4ed8]/18 bg-[#dbeafe] px-3 py-1 text-[0.72rem] font-medium text-[#1d4ed8]">
              <SparklesIcon className="size-3.5" />
              Visão executiva
            </div>

            <div className="space-y-4">
              <h1 className="font-display max-w-3xl text-4xl leading-[0.92] tracking-[-0.07em] text-slate-950 sm:text-5xl xl:text-[4.6rem]">
                Um painel claro,
                <span className="block text-[#1d4ed8]">preciso e elegante</span>
                para comandar a operação.
              </h1>
              <p className="max-w-2xl text-pretty text-sm leading-7 text-slate-600 sm:text-base">
                Empresas, usuários, importações e recebimentos vivem em uma leitura mais limpa, com contraste
                suave, foco claro e sinais visuais que ajudam a decidir sem ruído.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                asChild
                className="border border-[#1d4ed8] bg-[#1d4ed8] text-white shadow-[0_18px_36px_-22px_rgba(29,78,216,0.55)] hover:-translate-y-0.5 hover:bg-[#1e40af]"
              >
                <Link href="/companies">
                  Consulta de empresas
                  <ArrowRightIcon className="size-4" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
              >
                <Link href="/import">
                  <FileUpIcon className="size-4" />
                  Nova importação
                </Link>
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge className="border-slate-200 bg-white text-slate-700">Admin</Badge>
              <Badge className="border-slate-200 bg-white text-slate-700">Auditoria</Badge>
              <Badge className="border-slate-200 bg-white text-slate-700">Importação</Badge>
              <Badge className="border-slate-200 bg-white text-slate-700">Webhook</Badge>
              <Badge className="border-slate-200 bg-white text-slate-700">Tempo real</Badge>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[1.9rem] border border-slate-200 bg-white/92 p-5 shadow-[0_18px_46px_-34px_rgba(15,23,42,0.18)] backdrop-blur-xl sm:col-span-2">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.32em] text-slate-500">Saúde da base</div>
                  <div className="mt-3 flex items-end gap-3">
                    <div className="font-display text-5xl leading-none tracking-[-0.07em] text-slate-950">
                      {activeRatio}%
                    </div>
                    <div className="pb-1 text-sm text-slate-500">ativos sobre o total</div>
                  </div>
                </div>
                <div className="rounded-full border border-[#1d4ed8]/18 bg-[#dbeafe] px-3 py-1 text-xs text-[#1d4ed8]">
                  {companiesActive} registros
                </div>
              </div>
              <div className="mt-5 h-2 rounded-full bg-slate-100">
                <div
                  className="h-2 rounded-full bg-[linear-gradient(90deg,#dbeafe,#93c5fd,#1d4ed8)]"
                  style={{ width: `${Math.max(12, activeRatio)}%` }}
                />
              </div>
              <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-600">
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">
                  {companiesInactive} inativos
                </span>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">
                  {pendingCompanies} pendentes
                </span>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">
                  {usersActive} usuários ativos
                </span>
              </div>
            </div>

            <div className="rounded-[1.7rem] border border-slate-200 bg-white/92 p-4 shadow-[0_18px_46px_-34px_rgba(15,23,42,0.18)] backdrop-blur-xl">
              <div className="text-xs uppercase tracking-[0.26em] text-slate-500">Pendências</div>
              <div className="mt-2 flex items-end gap-3">
                <div className="font-display text-4xl leading-none tracking-[-0.05em] text-slate-950">
                  {pendingCompanies}
                </div>
                <div className="pb-1 text-xs text-slate-500">{pendingShare}% da base</div>
              </div>
              <div className="mt-4 flex h-2 gap-1 rounded-full bg-slate-100">
                <span className="w-[28%] rounded-full bg-[#dbeafe]" />
                <span className="w-[34%] rounded-full bg-[#93c5fd]" />
                <span className="w-[18%] rounded-full bg-[#1d4ed8]" />
                <span className="flex-1 rounded-full bg-slate-200" />
              </div>
            </div>

            <div className="rounded-[1.7rem] border border-slate-200 bg-white/92 p-4 shadow-[0_18px_46px_-34px_rgba(15,23,42,0.18)] backdrop-blur-xl">
              <div className="text-xs uppercase tracking-[0.26em] text-slate-500">Usuários ativos</div>
              <div className="mt-2 font-display text-4xl leading-none tracking-[-0.05em] text-slate-950">
                {usersActive}
              </div>
              <div className="mt-4 flex items-center gap-2 text-xs text-slate-600">
                <UsersRoundIcon className="size-4 text-[#1d4ed8]" />
                Contas com acesso liberado
              </div>
            </div>

            <div className="rounded-[1.7rem] border border-slate-200 bg-white/92 p-4 shadow-[0_18px_46px_-34px_rgba(15,23,42,0.18)] backdrop-blur-xl">
              <div className="text-xs uppercase tracking-[0.26em] text-slate-500">Inativas</div>
              <div className="mt-2 font-display text-4xl leading-none tracking-[-0.05em] text-slate-950">
                {companiesInactive}
              </div>
              <div className="mt-4 flex items-center gap-2 text-xs text-slate-600">
                <ShieldCheckIcon className="size-4 text-[#1d4ed8]" />
                Registros que pedem revisão
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="animate-glass-rise grid gap-4 sm:grid-cols-2 xl:grid-cols-4 [animation-delay:120ms]">
        <article className="group relative overflow-hidden rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-[0_18px_46px_-34px_rgba(15,23,42,0.18)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_24px_54px_-34px_rgba(29,78,216,0.18)]">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#dbeafe] via-[#93c5fd] to-[#1d4ed8]" />
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.26em] text-slate-500">Empresas ativas</div>
              <div className="mt-3 font-display text-4xl leading-none tracking-[-0.05em] text-slate-950">
                {companiesActive}
              </div>
              <div className="mt-3 text-sm text-slate-600">{activeRatio}% da base total</div>
            </div>
            <div className="flex size-11 items-center justify-center rounded-[1rem] border border-[#1d4ed8]/18 bg-[#dbeafe] text-[#1d4ed8]">
              <CircleGaugeIcon className="size-4" />
            </div>
          </div>
          <MetricBars percent={activeRatio} tone="royal" />
        </article>

        <article className="group relative overflow-hidden rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-[0_18px_46px_-34px_rgba(15,23,42,0.18)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_24px_54px_-34px_rgba(37,99,235,0.18)]">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#dbeafe] via-[#93c5fd] to-[#2563eb]" />
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.26em] text-slate-500">Empresas inativas</div>
              <div className="mt-3 font-display text-4xl leading-none tracking-[-0.05em] text-slate-950">
                {companiesInactive}
              </div>
              <div className="mt-3 text-sm text-slate-600">{inactiveRatio}% da base total</div>
            </div>
            <div className="flex size-11 items-center justify-center rounded-[1rem] border border-[#2563eb]/18 bg-[#dbeafe] text-[#2563eb]">
              <ShieldCheckIcon className="size-4" />
            </div>
          </div>
          <MetricBars percent={inactiveRatio} tone="navy" />
        </article>

        <article className="group relative overflow-hidden rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-[0_18px_46px_-34px_rgba(15,23,42,0.18)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_24px_54px_-34px_rgba(14,165,233,0.18)]">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#eff6ff] via-[#93c5fd] to-[#1d4ed8]" />
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.26em] text-slate-500">Usuários ativos</div>
              <div className="mt-3 font-display text-4xl leading-none tracking-[-0.05em] text-slate-950">
                {usersActive}
              </div>
              <div className="mt-3 text-sm text-slate-600">Contas com acesso liberado</div>
            </div>
            <div className="flex size-11 items-center justify-center rounded-[1rem] border border-[#1d4ed8]/18 bg-[#eff6ff] text-[#1d4ed8]">
              <UsersRoundIcon className="size-4" />
            </div>
          </div>
          <MetricBars percent={usersActiveRatio} tone="cobalt" />
        </article>

        <article className="group relative overflow-hidden rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-[0_18px_46px_-34px_rgba(15,23,42,0.18)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_24px_54px_-34px_rgba(30,64,175,0.18)]">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#dbeafe] via-[#60a5fa] to-[#1e40af]" />
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.26em] text-slate-500">Recebimentos pendentes</div>
              <div className="mt-3 font-display text-4xl leading-none tracking-[-0.05em] text-slate-950">
                {pendingCompanies}
              </div>
              <div className="mt-3 text-sm text-slate-600">Empresas aguardando cadastro</div>
            </div>
            <div className="flex size-11 items-center justify-center rounded-[1rem] border border-[#1e40af]/18 bg-[#dbeafe] text-[#1e40af]">
              <InboxIcon className="size-4" />
            </div>
          </div>
          <MetricBars percent={pendingShare} tone="sky" />
        </article>
      </section>

      <section className="animate-glass-rise grid gap-6 xl:grid-cols-[minmax(0,1.22fr)_minmax(0,0.78fr)] [animation-delay:180ms]">
        <article className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-5 shadow-[0_22px_56px_-40px_rgba(15,23,42,0.18)]">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#dbeafe] via-[#93c5fd] to-[#1d4ed8]" />
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-[0.28em] text-slate-500">Últimas importações</div>
            <h2 className="font-display text-2xl tracking-[-0.03em] text-slate-950">Histórico recente</h2>
            <p className="max-w-2xl text-sm leading-7 text-slate-600">
              Leitura rápida da fila, com o arquivo mais recente destacado para acelerar a conferência.
            </p>
          </div>

          <div className="mt-5 overflow-hidden rounded-[1.6rem] border border-slate-200 bg-slate-50/75">
            <div className="grid grid-cols-[minmax(0,1.55fr)_minmax(136px,0.78fr)_minmax(190px,1fr)_minmax(112px,0.6fr)] gap-3 border-b border-slate-200 px-4 py-3 text-[0.67rem] uppercase tracking-[0.3em] text-slate-500">
              <span>Arquivo</span>
              <span className="text-right">Data / hora</span>
              <span className="text-right">Registros</span>
              <span className="text-right">Status</span>
            </div>

            {lastImports.length ? (
              <div className="divide-y divide-slate-200">
                {lastImports.map((item, index) => (
                  <div
                    key={item.id}
                    className={cn(
                      "grid grid-cols-1 gap-3 px-4 py-4 text-sm lg:grid-cols-[minmax(0,1.55fr)_minmax(136px,0.78fr)_minmax(190px,1fr)_minmax(112px,0.6fr)] lg:items-center",
                      index === 0 && "bg-slate-50/70"
                    )}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {index === 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-[#1d4ed8]/18 bg-[#dbeafe] px-2 py-0.5 text-[0.68rem] font-medium text-[#1d4ed8]">
                            <SparklesIcon className="size-3" />
                            Mais recente
                          </span>
                        ) : null}
                        <div className="truncate font-medium text-slate-950">{item.fileName}</div>
                      </div>
                      <div className="mt-1 text-xs text-slate-500 lg:hidden">
                        {new Date(item.createdAt).toLocaleString("pt-BR")}
                      </div>
                    </div>

                    <div className="hidden text-right text-slate-600 lg:block">
                      {new Date(item.createdAt).toLocaleString("pt-BR")}
                    </div>

                    <div className="flex min-w-0 flex-wrap items-center gap-1.5 lg:justify-end">
                      <Badge className="border-slate-200 bg-white text-slate-700">+{item.created}</Badge>
                      <Badge className="border-slate-200 bg-white text-slate-700">~{item.updated}</Badge>
                      <Badge className="border-slate-200 bg-white text-slate-700">={item.total}</Badge>
                      <Badge className="border-slate-200 bg-white text-slate-700">dup {item.suspectedDuplicates ?? 0}</Badge>
                    </div>

                    <div className="flex lg:justify-end">
                      <Badge className={statusMeta(item.status).className}>{statusMeta(item.status).label}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-5">
                <div className="rounded-[1.35rem] border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">
                  Nenhuma importação encontrada.
                </div>
              </div>
            )}
          </div>

          {topImport ? (
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-[1.35rem] border border-slate-200 bg-slate-50/80 p-4">
                <div className="text-[0.68rem] uppercase tracking-[0.26em] text-slate-500">Arquivo em destaque</div>
                <div className="mt-2 truncate text-sm font-medium text-slate-950">{topImport.fileName}</div>
              </div>
              <div className="rounded-[1.35rem] border border-slate-200 bg-slate-50/80 p-4">
                <div className="text-[0.68rem] uppercase tracking-[0.26em] text-slate-500">Última execução</div>
                <div className="mt-2 text-sm font-medium text-slate-950">
                  {new Date(topImport.createdAt).toLocaleString("pt-BR")}
                </div>
              </div>
              <div className="rounded-[1.35rem] border border-slate-200 bg-slate-50/80 p-4">
                <div className="text-[0.68rem] uppercase tracking-[0.26em] text-slate-500">Total processado</div>
                <div className="mt-2 text-sm font-medium text-slate-950">{topImport.total} registros</div>
              </div>
            </div>
          ) : null}
        </article>

        <div className="space-y-6">
          <article className="rounded-[2rem] border border-slate-200 bg-white p-5 text-slate-950 shadow-[0_22px_56px_-40px_rgba(15,23,42,0.18)]">
            <div className="text-xs uppercase tracking-[0.28em] text-slate-500">Ações rápidas</div>
            <h2 className="mt-2 font-display text-2xl tracking-[-0.03em] text-slate-950">Fluxo direto</h2>
            <div className="mt-5 space-y-3">
              <Button
                asChild
                className="w-full justify-between rounded-[1.2rem] border border-[#1d4ed8] bg-[#1d4ed8] text-white hover:bg-[#1e40af]"
              >
                <Link href="/admin/pending-companies">
                  <span className="inline-flex items-center gap-2">
                    <InboxIcon className="size-4" />
                    Ver fila webhook
                  </span>
                  <ArrowRightIcon className="size-4" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="w-full justify-between rounded-[1.2rem] border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
              >
                <Link href="/admin/users">
                  <span className="inline-flex items-center gap-2">
                    <UsersRoundIcon className="size-4 text-[#1d4ed8]" />
                    Gerir usuários
                  </span>
                  <ArrowRightIcon className="size-4" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="w-full justify-between rounded-[1.2rem] border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
              >
                <Link href="/admin/audit">
                  <span className="inline-flex items-center gap-2">
                    <BarChart3Icon className="size-4 text-[#2563eb]" />
                    Auditar eventos
                  </span>
                  <ArrowRightIcon className="size-4" />
                </Link>
              </Button>
            </div>
          </article>

          <article className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-[0_22px_56px_-40px_rgba(15,23,42,0.18)]">
            <div className="text-xs uppercase tracking-[0.28em] text-slate-500">Leitura executiva</div>
            <h2 className="mt-2 font-display text-2xl tracking-[-0.03em] text-slate-950">Resumo do momento</h2>

            <div className="mt-5 space-y-3">
              <div className="rounded-[1.35rem] border border-slate-200 bg-slate-50/80 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-[1rem] bg-[#dbeafe] text-[#1d4ed8]">
                    <BarChart3Icon className="size-4" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-slate-950">Saúde da base</div>
                    <div className="text-xs text-slate-500">
                      {activeRatio}% ativas, {inactiveRatio}% inativas.
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-[1.35rem] border border-slate-200 bg-slate-50/80 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-[1rem] bg-[#eff6ff] text-[#2563eb]">
                    <InboxIcon className="size-4" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-slate-950">Fila recebida</div>
                    <div className="text-xs text-slate-500">
                      {pendingCompanies} itens aguardando aprovação na entrada.
                    </div>
                  </div>
                </div>
              </div>

              {topImport ? (
                <div className="rounded-[1.35rem] border border-slate-200 bg-slate-50/80 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-[1rem] bg-[#dbeafe] text-[#1e40af]">
                      <FileUpIcon className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-slate-950">Último arquivo</div>
                      <div className="truncate text-xs text-slate-500">{topImport.fileName}</div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}
