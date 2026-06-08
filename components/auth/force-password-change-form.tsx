"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { PasswordStrengthMeter } from "@/components/auth/password-strength-meter";
import { getPasswordStrength } from "@/lib/password-strength";

export function ForcePasswordChangeForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const strength = getPasswordStrength(newPassword);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error("Não foi possível alterar a senha", {
          description: data?.message || "Verifique os dados e tente novamente.",
        });
        return;
      }
      toast.success("Senha atualizada com sucesso.");
      router.replace("/");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>Troca de senha obrigatória</CardTitle>
        <CardDescription>
          Sua senha temporária expira em 24h. Defina uma senha forte para continuar.
        </CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit}>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="currentPassword">Senha atual</Label>
            <Input
              id="currentPassword"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="newPassword">Nova senha</Label>
            <Input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              A senha precisa ser forte para continuar: pelo menos 12 caracteres, com maiúscula, minúscula, número e símbolo.
            </p>
          </div>

          <PasswordStrengthMeter password={newPassword} minimumStrength="strong" />
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" disabled={loading || strength.level !== "strong"} className="w-full sm:w-auto">
            {loading ? "Salvando..." : "Salvar nova senha"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
