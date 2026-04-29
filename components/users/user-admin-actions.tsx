"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export function UserAdminActions(props?: { userId?: string; currentActive?: boolean }) {
  const router = useRouter();
  const isRow = Boolean(props?.userId);

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"ADMIN" | "USER">("USER");
  const [department, setDepartment] = useState<"" | "DP" | "FISCAL" | "CONTABIL">("");
  const [isDepartmentLeader, setIsDepartmentLeader] = useState(false);

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
          department: department || null,
          isDepartmentLeader,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error("Não foi possível criar usuário", { description: data?.error || "Verifique os dados." });
        return;
      }
      toast.success("Usuário criado. Senha temporária enviada via webhook.");
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
        toast.error("Não foi possível atualizar", { description: data?.error || "Tente novamente." });
        return;
      }
      toast.success("Usuário atualizado.");
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
        toast.error("Não foi possível resetar", { description: data?.error || "Tente novamente." });
        return;
      }
      toast.success("Senha temporária enviada via webhook.");
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
        <Button>Criar usuário</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo usuário</DialogTitle>
          <DialogDescription>
            Cria com senha temporária (24h) e força troca no primeiro login.
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
            <Select
              value={role}
              onValueChange={(v) => setRole(v === "ADMIN" ? "ADMIN" : "USER")}
            >
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
                setDepartment(v === "DP" || v === "FISCAL" || v === "CONTABIL" ? v : "")
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="(opcional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">(Nenhum)</SelectItem>
                <SelectItem value="DP">DP</SelectItem>
                <SelectItem value="FISCAL">FISCAL</SelectItem>
                <SelectItem value="CONTABIL">CONTÁBIL</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-md border p-3">
            <div className="min-w-0">
              <div className="text-sm font-medium">Líder do setor</div>
              <div className="text-xs text-muted-foreground">
                Apenas para usuários ADMIN com setor definido.
              </div>
            </div>
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={isDepartmentLeader}
              disabled={role !== "ADMIN" || !department}
              onChange={(e) => setIsDepartmentLeader(e.target.checked)}
              aria-label="Líder do setor"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={createUser} disabled={loading || !name.trim() || !email.trim()}>
            {loading ? "Criando..." : "Criar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
