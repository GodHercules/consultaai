"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckIcon, CopyIcon, InfoIcon, LockIcon, ShieldIcon, SparklesIcon, UsersIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type DepartmentValue = "NONE" | "DP" | "FISCAL" | "CONTABIL";
type RoleValue = "ADMIN" | "USER";

type CreatedUser = {
  id: string;
  name: string;
  email: string;
  role: RoleValue;
  temporaryPassword: string;
};

export function UserCreateForm() {
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<RoleValue>("USER");
  const [department, setDepartment] = useState<DepartmentValue>("NONE");
  const [isDepartmentLeader, setIsDepartmentLeader] = useState(false);
  const [created, setCreated] = useState<CreatedUser | null>(null);
  const [copying, setCopying] = useState(false);

  const departmentEnabled = role === "ADMIN" && department !== "NONE";
  const canSubmit = name.trim().length > 1 && email.trim().length > 3;

  useEffect(() => {
    if (!departmentEnabled && isDepartmentLeader) {
      setIsDepartmentLeader(false);
    }
  }, [departmentEnabled, isDepartmentLeader]);

  const helperText = useMemo(() => {
    if (role !== "ADMIN") {
      return "Usuarios comuns nao recebem setor lider.";
    }
    if (department === "NONE") {
      return "Selecione um setor para habilitar o lider.";
    }
    return "Marcacao disponivel apenas para admin do setor.";
  }, [department, role]);

  async function copyPassword(password: string) {
    setCopying(true);
    try {
      await navigator.clipboard.writeText(password);
      toast.success("Senha temporaria copiada.");
    } catch {
      toast.error("Nao foi possivel copiar a senha.");
    } finally {
      setCopying(false);
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          role,
          department: department === "NONE" ? null : department,
          isDepartmentLeader,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error("Nao foi possivel criar o usuario", {
          description: data?.error || "Verifique os dados informados.",
        });
        return;
      }

      setCreated({
        id: data.user.id,
        name: data.user.name,
        email: data.user.email,
        role: data.user.role,
        temporaryPassword: data.temporaryPassword || "",
      });
      setName("");
      setEmail("");
      setRole("USER");
      setDepartment("NONE");
      setIsDepartmentLeader(false);
      toast.success("Usuario criado com sucesso.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-border/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.92)_0%,rgba(248,251,255,0.96)_100%)]">
        <CardHeader className="border-b border-border/70">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <CardTitle>Novo usuario</CardTitle>
              <CardDescription>
                Cadastre uma conta com senha temporaria, acesso controlado e troca obrigatoria no primeiro login.
              </CardDescription>
            </div>
            <div className="hidden rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700 sm:inline-flex">
              Fluxo guiado
            </div>
          </div>
        </CardHeader>

        <form onSubmit={onSubmit}>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="name">Nome completo</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Maria Silva"
                autoComplete="name"
                required
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nome@empresa.com"
                autoComplete="email"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Perfil</Label>
              <Select value={role} onValueChange={(value) => setRole(value === "ADMIN" ? "ADMIN" : "USER")}>
                <SelectTrigger id="role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USER">USER</SelectItem>
                  <SelectItem value="ADMIN">ADMIN</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="department">Setor</Label>
              <Select value={department} onValueChange={(value) => setDepartment(value as DepartmentValue)}>
                <SelectTrigger id="department">
                  <SelectValue placeholder="Sem setor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">Sem setor</SelectItem>
                  <SelectItem value="DP">DP</SelectItem>
                  <SelectItem value="FISCAL">FISCAL</SelectItem>
                  <SelectItem value="CONTABIL">CONTABIL</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-2 rounded-[1.25rem] border border-border/70 bg-background/60 p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <ShieldIcon className="size-4 text-sky-600" />
                    Lider do setor
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">{helperText}</p>
                </div>
                <label className="inline-flex items-center gap-3 rounded-full border border-border/70 bg-background px-4 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={isDepartmentLeader}
                    disabled={!departmentEnabled}
                    onChange={(e) => setIsDepartmentLeader(e.target.checked)}
                    className="size-4 rounded border-border text-sky-600"
                    aria-label="Lider do setor"
                  />
                  <span className={departmentEnabled ? "text-foreground" : "text-muted-foreground"}>
                    Usuario lider
                  </span>
                </label>
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button asChild variant="outline" className="w-full sm:w-auto">
              <Link href="/admin/users">Voltar para lista</Link>
            </Button>
            <Button type="submit" disabled={loading || !canSubmit} className="w-full sm:w-auto">
              {loading ? "Criando..." : "Criar usuario"}
            </Button>
          </CardFooter>
        </form>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>O que acontece ao salvar</CardTitle>
            <CardDescription>O fluxo de criacao ja prepara a conta para o primeiro acesso.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[1.15rem] border border-border/70 bg-background/60 p-4">
              <div className="flex items-center gap-2 text-sky-700">
                <LockIcon className="size-4" />
                <span className="text-sm font-medium">Senha temporaria</span>
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                A conta nasce com uma senha gerada automaticamente e validade de 24 horas.
              </p>
            </div>
            <div className="rounded-[1.15rem] border border-border/70 bg-background/60 p-4">
              <div className="flex items-center gap-2 text-emerald-700">
                <SparklesIcon className="size-4" />
                <span className="text-sm font-medium">Primeiro login</span>
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                O usuario entra, troca a senha e ja fica pronto para operar no painel.
              </p>
            </div>
            <div className="rounded-[1.15rem] border border-border/70 bg-background/60 p-4">
              <div className="flex items-center gap-2 text-violet-700">
                <UsersIcon className="size-4" />
                <span className="text-sm font-medium">Acesso segmentado</span>
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Use setor e lideranca para delimitar o escopo quando o perfil precisar de contexto.
              </p>
            </div>
            <div className="rounded-[1.15rem] border border-border/70 bg-background/60 p-4">
              <div className="flex items-center gap-2 text-amber-700">
                <InfoIcon className="size-4" />
                <span className="text-sm font-medium">Auditoria</span>
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Criacao, ativacao e reset ficam registrados para consulta posterior.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[linear-gradient(180deg,rgba(14,165,233,0.08)_0%,rgba(255,255,255,0.96)_100%)]">
          <CardHeader>
            <CardTitle>Resumo rapido</CardTitle>
            <CardDescription>Estado atual do cadastro que foi salvo por ultimo.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {created ? (
              <div className="space-y-4">
                <div className="rounded-[1.15rem] border border-emerald-200 bg-emerald-50 p-4">
                  <div className="flex items-center gap-2 text-emerald-700">
                    <CheckIcon className="size-4" />
                    <span className="text-sm font-medium">Usuario criado</span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-emerald-900/80">
                    {created.name} <br />
                    {created.email}
                  </p>
                  <p className="mt-1 text-xs uppercase tracking-[0.22em] text-emerald-700">{created.role}</p>
                </div>

                <div className="space-y-2">
                  <Label>Senha temporaria</Label>
                  <div className="flex items-center gap-2 rounded-[1rem] border border-border/70 bg-background px-3 py-2.5">
                    <code className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">
                      {created.temporaryPassword || "Nao retornada pela API"}
                    </code>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={!created.temporaryPassword || copying}
                      onClick={() => copyPassword(created.temporaryPassword)}
                    >
                      <CopyIcon className="size-3.5" />
                      Copiar
                    </Button>
                  </div>
                  <p className="text-xs leading-5 text-muted-foreground">
                    Compartilhe por um canal seguro. O usuario devera trocar esta senha no primeiro acesso.
                  </p>
                </div>
              </div>
            ) : (
              <div className="rounded-[1.15rem] border border-dashed border-border/70 bg-background/55 p-4 text-sm leading-6 text-muted-foreground">
                Quando um usuario for criado, a senha temporaria aparece aqui para copia rapida.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
