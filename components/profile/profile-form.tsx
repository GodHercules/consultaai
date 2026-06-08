"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function ProfileForm(props: {
  initialName: string;
  email: string;
  department: string | null;
  departmentLeader: { name: string; email: string } | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState(props.initialName);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error("Não foi possível atualizar", { description: data?.error || "Tente novamente." });
        return;
      }
      toast.success("Perfil atualizado.");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Perfil</CardTitle>
        <CardDescription>Atualize seus dados básicos com uma leitura mais clara da sua conta.</CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>E-mail</Label>
            <Input value={props.email} disabled />
          </div>
          <div className="space-y-2">
            <Label>Setor</Label>
            <Input value={props.department ?? "-"} disabled />
          </div>
          <div className="space-y-2">
            <Label>Líder do setor</Label>
            <Input
              value={
                props.departmentLeader
                  ? `${props.departmentLeader.name} (${props.departmentLeader.email})`
                  : "-"
              }
              disabled
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Nome</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" disabled={loading} className="w-full sm:w-auto">
            {loading ? "Salvando..." : "Salvar"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
