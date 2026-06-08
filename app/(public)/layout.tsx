import type { ReactNode } from "react";
import Link from "next/link";
import { CheckCircle2Icon, SparklesIcon, ShieldCheckIcon } from "lucide-react";

export default function PublicLayout(props: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[linear-gradient(180deg,#fbfcfe_0%,#f4f7fb_100%)] px-4 py-4 text-slate-900 sm:px-6 lg:px-8 lg:py-8 xl:px-10 2xl:px-12">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 animate-aurora-drift bg-[radial-gradient(circle_at_18%_18%,rgba(29,78,216,0.09),transparent_24%),radial-gradient(circle_at_84%_16%,rgba(96,165,250,0.08),transparent_22%),radial-gradient(circle_at_82%_82%,rgba(37,99,235,0.06),transparent_18%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 animate-slow-grid bg-[linear-gradient(115deg,transparent_0%,rgba(255,255,255,0.55)_48%,transparent_100%)] opacity-45"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-[10%] top-[16%] h-80 w-80 rounded-full bg-[#1d4ed8]/12 blur-3xl animate-aurora-pulse"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-[10%] bottom-[14%] h-72 w-72 rounded-full bg-[#2563eb]/8 blur-3xl animate-aurora-drift"
      />

      <div className="relative mx-auto grid min-h-[calc(100vh-2rem)] max-w-[1840px] gap-6 lg:grid-cols-[minmax(0,1.18fr)_minmax(420px,600px)] lg:gap-8">
        <section className="animate-glass-rise relative hidden overflow-hidden rounded-[2.5rem] border border-slate-200/80 bg-white/75 p-8 shadow-[0_30px_80px_-48px_rgba(15,23,42,0.22)] backdrop-blur-xl lg:flex lg:flex-col lg:justify-between">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-10 top-12 h-[30rem] w-[30rem] rounded-full bg-[radial-gradient(circle,rgba(29,78,216,0.12)_0%,rgba(37,99,235,0.06)_18%,transparent_62%)] blur-3xl animate-aurora-drift"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-[44%] top-[10%] h-[20rem] w-[20rem] rounded-full border border-[#bfdbfe] animate-aurora-pulse"
          />

          <div className="relative max-w-2xl">
            <Link href="/" className="inline-flex items-center gap-4">
              <span className="flex size-14 items-center justify-center rounded-[1.2rem] border border-[#bfdbfe] bg-white text-2xl font-semibold text-[#1d4ed8] shadow-[0_14px_32px_-24px_rgba(29,78,216,0.42)]">
                CC
              </span>
              <span className="space-y-1">
                <span className="block text-[0.68rem] font-semibold uppercase tracking-[0.42em] text-slate-500">
                  Central de Clientes
                </span>
                <span className="block text-sm font-medium uppercase tracking-[0.18em] text-[#2563eb]">
                  Portal operacional
                </span>
              </span>
            </Link>

            <div className="mt-16 max-w-4xl space-y-6">
              <p className="text-balance font-display text-[4rem] leading-[0.96] tracking-[-0.07em] text-slate-950 xl:text-[5.2rem] 2xl:text-[5.6rem]">
                Inteligência operacional
                <span className="block">
                  para decisões com{" "}
                  <span className="italic text-[#1d4ed8]">clareza e confiança.</span>
                </span>
              </p>
              <p className="max-w-3xl text-pretty text-[1.02rem] leading-8 text-slate-600">
                A Central de Clientes unifica consulta avançada, gestão segura e automações em uma experiência
                mais limpa, leve e confiável.
              </p>
            </div>

            <div className="mt-14 grid max-w-4xl gap-4 sm:grid-cols-3">
              <div className="rounded-[1.4rem] border border-slate-200 bg-white/80 p-4 shadow-[0_16px_40px_-30px_rgba(15,23,42,0.18)]">
                <div className="flex items-center gap-3 text-[#1d4ed8]">
                  <ShieldCheckIcon className="size-5" />
                  <span className="text-[0.72rem] font-semibold uppercase tracking-[0.3em]">
                    Segurança
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  Fluxo seguro, sessão auditável e acesso contextual.
                </p>
              </div>
              <div className="rounded-[1.4rem] border border-slate-200 bg-white/80 p-4 shadow-[0_16px_40px_-30px_rgba(15,23,42,0.18)]">
                <div className="flex items-center gap-3 text-[#2563eb]">
                  <SparklesIcon className="size-5" />
                  <span className="text-[0.72rem] font-semibold uppercase tracking-[0.3em]">
                    Eficiência
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  Menos ruído, menos atrito e mais foco na execução.
                </p>
              </div>
              <div className="rounded-[1.4rem] border border-slate-200 bg-white/80 p-4 shadow-[0_16px_40px_-30px_rgba(15,23,42,0.18)]">
                <div className="flex items-center gap-3 text-slate-700">
                  <CheckCircle2Icon className="size-5 text-[#1e40af]" />
                  <span className="text-[0.72rem] font-semibold uppercase tracking-[0.3em]">
                    Experiência
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  Design limpo, editorial e pronto para múltiplas telas.
                </p>
              </div>
            </div>
          </div>

          <div className="relative mt-10 flex items-center gap-4 rounded-[1.5rem] border border-slate-200 bg-white/80 p-4 text-sm text-slate-600">
            <div className="flex size-12 items-center justify-center rounded-[1.1rem] border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500">
              24/7
            </div>
            <div className="min-w-0">
              <div className="font-medium text-slate-900">Operação contínua e auditável</div>
              <div className="mt-1 text-sm leading-6">
                Um layout pensado para reduzir atrito visual e facilitar a leitura.
              </div>
            </div>
          </div>
        </section>

        <main className="animate-glass-rise relative flex items-center justify-center lg:justify-end [animation-delay:100ms]">
          <div className="w-full max-w-[600px] space-y-4">
            <div className="flex items-center justify-between rounded-[1.4rem] border border-slate-200 bg-white/85 px-4 py-3 text-xs text-slate-500 shadow-[0_16px_40px_-30px_rgba(15,23,42,0.18)] backdrop-blur-xl lg:hidden">
              <Link href="/" className="inline-flex items-center gap-2 text-slate-700">
                <span className="flex size-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-[0.7rem] font-semibold text-[#1d4ed8]">
                  CC
                </span>
                <span className="font-medium">Central de Clientes</span>
              </Link>
              <span className="rounded-full border border-[#bfdbfe] bg-[#dbeafe] px-2.5 py-1 text-[0.68rem] uppercase tracking-[0.26em] text-[#1d4ed8]">
                Ao vivo
              </span>
            </div>

            {props.children}

            <div className="flex items-center justify-between rounded-[1.2rem] border border-slate-200 bg-white/75 px-4 py-3 text-[0.72rem] uppercase tracking-[0.24em] text-slate-500">
              <span>Ambiente protegido</span>
              <span>Leitura contextual</span>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
