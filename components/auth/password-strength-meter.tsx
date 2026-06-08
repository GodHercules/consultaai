"use client";

import { cn } from "@/lib/utils";
import { getPasswordStrength, type PasswordStrength } from "@/lib/password-strength";

const strengthMeta: Record<
  PasswordStrength,
  { label: string; bar: string; text: string; bg: string; description: string }
> = {
  weak: {
    label: "Fraca",
    bar: "bg-rose-500",
    text: "text-rose-700",
    bg: "bg-rose-50",
    description: "Ainda precisa de mais comprimento e mistura de caracteres.",
  },
  moderate: {
    label: "Moderada",
    bar: "bg-amber-500",
    text: "text-amber-700",
    bg: "bg-amber-50",
    description: "Está no meio do caminho, mas ainda não é forte o suficiente.",
  },
  strong: {
    label: "Forte",
    bar: "bg-emerald-500",
    text: "text-emerald-700",
    bg: "bg-emerald-50",
    description: "Boa combinação de tamanho e variedade de caracteres.",
  },
};

export function PasswordStrengthMeter(props: {
  password: string;
  minimumStrength?: PasswordStrength;
  className?: string;
}) {
  const current = getPasswordStrength(props.password);
  const minimumStrength = props.minimumStrength ?? "strong";
  const order: Record<PasswordStrength, number> = { weak: 0, moderate: 1, strong: 2 };
  const meetsMinimum = order[current.level] >= order[minimumStrength];
  const meta = strengthMeta[current.level];
  const width = current.level === "weak" ? "33%" : current.level === "moderate" ? "66%" : "100%";

  return (
    <div className={cn("space-y-2 rounded-[1rem] border border-border/70 bg-background/60 p-4", props.className)}>
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="font-medium text-foreground">Força da senha</span>
        <span className={cn("rounded-full px-2.5 py-1 font-semibold", meta.bg, meta.text)}>
          {props.password ? meta.label : "Digite para avaliar"}
        </span>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div className={cn("h-full rounded-full transition-all duration-300", meta.bar)} style={{ width }} />
      </div>

      <p className="text-xs leading-5 text-muted-foreground">{props.password ? meta.description : "A senha será classificada em tempo real como fraca, moderada ou forte."}</p>

      <p className={cn("text-xs font-medium", meetsMinimum ? "text-emerald-700" : "text-amber-700")}>
        Nível mínimo exigido: {strengthMeta[minimumStrength].label.toLowerCase()}.
      </p>
    </div>
  );
}
