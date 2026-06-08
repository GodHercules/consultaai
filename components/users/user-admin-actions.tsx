"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

type DepartmentValue = "NONE" | "DP" | "FISCAL" | "CONTABIL";

export function UserAdminActions(props?: { userId?: string; currentActive?: boolean }) {
  const router = useRouter();
  const isRow = Boolean(props?.userId);

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"ADMIN" | "USER">("USER");
  const [department, setDepartment] = useState<DepartmentValue>("NONE");
  const [isDepartmentLeader, setIsDepartmentLeader] = useState(false);

  const departmentEnabled = role === "ADMIN" && department !== "NONE";

  useEffect(() => {
    if (!departmentEnabled && isDepartmentLeader) {
      setIsDepartmentLeader(false);
    }
  }, [departmentEnabled, isDepartmentLeader]);

  async function createUser() {
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
        toast.error("Nao foi possivel criar usuario", { description: data?.error || "Verifique os dados." });
        return;
      }
      toast.success("Usuario criado. Senha temporaria enviada via webhook.");
      setOpen(false);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function toggleActive() {
    if (!props?.userId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${props.userId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ isActive: !props.currentActive }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error("Nao foi possivel atualizar", { description: data?.error || "Tente novamente." });
        return;
      }
      toast.success("Usuario atualizado.");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function resetTempPassword() {
    if (!props?.userId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${props.userId}/temp-password`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error("Nao foi possivel resetar", { description: data?.error || "Tente novamente." });
        return;
      }
      toast.success("Senha temporaria enviada via webhook.");
    } finally {
      setLoading(false);
    }
  }

  if (isRow) {
    return (
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" disabled={loading} onClick={toggleActive}>
          {props?.currentActive ? "Inativar" : "Ativar"}
        </Button>
        <Button size="sm" variant="outline" disabled={loading} onClick={resetTempPassword}>
          Nova temp
        </Button>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Criar usuario</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo usuario</DialogTitle>
          <DialogDescription>
            Cria com senha temporaria (24h) e forca troca no primeiro login.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Perfil</Label>
            <Select value={role} onValueChange={(v) => setRole(v === "ADMIN" ? "ADMIN" : "USER")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USER">USER</SelectItem>
                <SelectItem value="ADMIN">ADMIN</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Setor</Label>
            <Select
              value={department}
              onValueChange={(v) =>
                setDepartment(v === "DP" || v === "FISCAL" || v === "CONTABIL" ? v : "NONE")
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="(opcional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NONE">Sem setor</SelectItem>
                <SelectItem value="DP">DP</SelectItem>
                <SelectItem value="FISCAL">FISCAL</SelectItem>
                <SelectItem value="CONTABIL">CONTABIL</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-md border p-3">
            <div className="min-w-0">
              <div className="text-sm font-medium">Lider do setor</div>
              <div className="text-xs text-muted-foreground">
                Apenas para usuarios ADMIN com setor definido.
              </div>
            </div>
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={isDepartmentLeader}
              disabled={!departmentEnabled}
              onChange={(e) => setIsDepartmentLeader(e.target.checked)}
              aria-label="Lider do setor"
            />
          </div>
        </div>

        <DialogFooter className="sm:justify-end">
          <Button variant="ghost" className="w-full sm:w-auto" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={createUser} disabled={loading || !name.trim() || !email.trim()} className="w-full sm:w-auto">
            {loading ? "Criando..." : "Criar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
