"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeftIcon, ArrowRightIcon, KeyRoundIcon, LockIcon, MailIcon, ShieldCheckIcon, UserRoundIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TEST_ADMIN_DISPLAY_EMAIL } from "@/services/auth/testAdmin";

function messageForError(error?: string | null) {
  switch (error) {
    case "TEMP_PASSWORD_EXPIRED":
      return "Senha temporária expirada. Use 'Esqueci minha senha'.";
    case "INVALID_INPUT":
      return "E-mail inválido. Use um formato como nome@dominio.com.";
    case "EMAIL_ALREADY_EXISTS":
      return "Este e-mail já está cadastrado. Tente entrar ou use outro e-mail.";
    case "WEAK_PASSWORD":
      return "A senha deve ter pelo menos 12 caracteres, com maiúsculas, minúsculas, números e símbolos.";
    case "PASSWORDS_DO_NOT_MATCH":
      return "As senhas informadas não coincidem.";
    case "RATE_LIMITED":
      return "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
    case "SERVICE_UNAVAILABLE":
      return "O acesso está indisponível no momento. Tente novamente em instantes.";
    case "INVALID_CREDENTIALS":
    default:
      return "Verifique seu e-mail e senha.";
  }
}

export function LoginForm(props: { next?: string | null; error?: string | null; registered?: boolean }) {
  const [registering, setRegistering] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [registeringRequest, setRegisteringRequest] = useState(false);
  const action = new URLSearchParams();
  action.set("redirect", "1");
  if (props.next) action.set("next", props.next);

  return (
    <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white/90 shadow-[0_28px_80px_-40px_rgba(15,23,42,0.24)] backdrop-blur-xl">
      <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-[1rem] border border-[#bfdbfe] bg-[#1d4ed8] text-sm font-semibold text-white">
            CC
          </span>
          <div className="min-w-0">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.34em] text-slate-500">
              Acesso seguro
            </p>
            <p className="mt-1 text-sm text-slate-500">Central de Clientes</p>
          </div>
        </div>
      </div>

      <div className="p-5 sm:p-6">
        <div className="space-y-3">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.34em] text-[#1d4ed8]">
            {registering ? "Criar acesso" : "Acessar a base"}
          </p>
          <h1 className="max-w-sm font-display text-3xl leading-[1.02] tracking-[-0.05em] text-slate-950 sm:text-[2.5rem]">
            {registering ? "Crie seu acesso à Central de Clientes." : "Entre com suas credenciais corporativas."}
          </h1>
          <p className="max-w-md text-sm leading-7 text-slate-600">
            {registering
              ? "Preencha seus dados para criar uma conta de usuário e começar a acessar a plataforma."
              : "Consulte empresas, acompanhe auditorias e navegue pelos fluxos operacionais com uma interface mais limpa e objetiva."}
          </p>
        </div>

        <div className="mt-6 h-px bg-[linear-gradient(90deg,transparent,rgba(29,78,216,0.45),rgba(96,165,250,0.35),transparent)]" />

        {props.registered ? (
          <div className="mt-5 rounded-[1.2rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-700">
            Cadastro realizado com sucesso. Entre com seu e-mail e senha para continuar.
          </div>
        ) : null}

        {(props.error || registerError) ? (
          <div className="mt-5 rounded-[1.2rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700">
            {messageForError(registerError ?? props.error)}
          </div>
        ) : null}

        <form
          method={registering ? "post" : undefined}
          action={registering ? undefined : `/api/auth/login?${action.toString()}`}
          onSubmit={registering ? async (event) => {
            event.preventDefault();
            setRegisteringRequest(true);
            setRegisterError(null);
            const formData = new FormData(event.currentTarget);
            const response = await fetch("/api/auth/register", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(Object.fromEntries(formData.entries())),
            });
            const data = await response.json().catch(() => ({}));
            setRegisteringRequest(false);
            if (response.ok) {
              window.location.href = "/login?registered=1";
            } else {
              setRegisterError(data.error ?? "INVALID_INPUT");
            }
          } : undefined}
          className="mt-5 space-y-4"
        >
          {registering ? <div className="space-y-2">
            <Label htmlFor="name" className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-slate-500">Nome completo</Label>
            <div className="relative">
              <UserRoundIcon className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input id="name" name="name" type="text" autoComplete="name" required placeholder="Seu nome completo" className="h-12 rounded-[1rem] border-slate-200 bg-slate-50 pl-11 text-slate-900 placeholder:text-slate-400 shadow-none focus-visible:bg-white" />
            </div>
          </div> : null}

          <div className="space-y-2">
            <Label
              htmlFor="email"
              className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-slate-500"
            >
              E-mail
            </Label>
            <div className="relative">
              <MailIcon className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                key={registering ? "register-email" : "login-email"}
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                required
                defaultValue={registering ? "" : TEST_ADMIN_DISPLAY_EMAIL}
                placeholder="seu.email@empresa.com"
                className="h-12 rounded-[1rem] border-slate-200 bg-slate-50 pl-11 text-slate-900 placeholder:text-slate-400 shadow-none focus-visible:bg-white"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="password"
              className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-slate-500"
            >
              Senha
            </Label>
            <div className="relative">
              <LockIcon className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete={registering ? "new-password" : "current-password"}
                required
                placeholder="••••••••••••"
                className="h-12 rounded-[1rem] border-slate-200 bg-slate-50 pl-11 text-slate-900 placeholder:text-slate-400 shadow-none focus-visible:bg-white"
              />
            </div>
          </div>

          {registering ? <div className="space-y-2">
            <Label htmlFor="confirmPassword" className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-slate-500">Confirmar senha</Label>
            <div className="relative">
              <LockIcon className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required placeholder="Repita sua senha" className="h-12 rounded-[1rem] border-slate-200 bg-slate-50 pl-11 text-slate-900 placeholder:text-slate-400 shadow-none focus-visible:bg-white" />
            </div>
          </div> : null}

            <Button
            type="submit"
            className="h-12 w-full rounded-[1rem] border border-[#1d4ed8] bg-[#1d4ed8] text-[0.98rem] font-semibold text-white shadow-[0_14px_28px_-18px_rgba(29,78,216,0.8)] transition hover:translate-y-[-1px] hover:bg-[#1e40af]"
          >
            {registeringRequest ? "Criando acesso..." : registering ? "Criar minha conta" : "Entrar"}
            <ArrowRightIcon className="size-4" />
          </Button>

          {!registering ? <Button
            asChild
            variant="outline"
            className="h-12 w-full justify-between rounded-[1rem] border-slate-200 bg-white px-4 text-slate-700 hover:border-slate-300 hover:bg-slate-50"
          >
            <Link href="/forgot-password">
              <span className="inline-flex items-center gap-2">
                <KeyRoundIcon className="size-4 text-[#1d4ed8]" />
                Esqueci minha senha
              </span>
              <ArrowRightIcon className="size-4 text-slate-400" />
            </Link>
          </Button> : null}

          {registering ? <Button type="button" variant="outline" onClick={() => { setRegistering(false); setRegisterError(null); }} className="h-12 w-full rounded-[1rem] border-slate-200 bg-white text-slate-700">
            <ArrowLeftIcon className="size-4" /> Voltar para entrar
          </Button> : null}
        </form>

        {!registering ? <button type="button" onClick={() => { setRegistering(true); setRegisterError(null); }} className="mt-5 w-full text-center text-sm font-medium text-[#1d4ed8] hover:underline">
          Não possui conta? Cadastre-se
        </button> : null}

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-[1rem] border border-slate-200 bg-slate-50 px-3 py-3">
            <div className="flex items-center gap-2 text-[#1d4ed8]">
              <ShieldCheckIcon className="size-4" />
              <span className="text-[0.68rem] font-semibold uppercase tracking-[0.24em]">Segurança</span>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-600">Fluxo de acesso seguro e auditável.</p>
          </div>
          <div className="rounded-[1rem] border border-slate-200 bg-slate-50 px-3 py-3">
            <div className="flex items-center gap-2 text-[#2563eb]">
              <ShieldCheckIcon className="size-4" />
              <span className="text-[0.68rem] font-semibold uppercase tracking-[0.24em]">Clareza</span>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-600">Leitura limpa com menos ruído visual.</p>
          </div>
          <div className="rounded-[1rem] border border-slate-200 bg-slate-50 px-3 py-3">
            <div className="flex items-center gap-2 text-slate-700">
              <ShieldCheckIcon className="size-4 text-[#1e40af]" />
              <span className="text-[0.68rem] font-semibold uppercase tracking-[0.24em]">Foco</span>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-600">Design mais leve e fácil de usar.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
