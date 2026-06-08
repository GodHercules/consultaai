"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { PasswordStrengthMeter } from "@/components/auth/password-strength-meter";
import { getPasswordStrength } from "@/lib/password-strength";

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tokenFromUrl = searchParams.get("token") ?? "";

  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState(tokenFromUrl);
  const [newPassword, setNewPassword] = useState("");
  const strength = getPasswordStrength(newPassword);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error("Não foi possível redefinir", {
          description: data?.message || "Token inválido/expirado.",
        });
        return;
      }
      toast.success("Senha redefinida com sucesso.");
      router.replace("/login");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Redefinição de senha</CardTitle>
        <CardDescription>
          Cole o token recebido (válido por 2 horas) e defina sua nova senha.
        </CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit}>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="token">Token</Label>
            <Input
              id="token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
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
              A nova senha precisa ser forte para concluir a redefinição.
            </p>
          </div>
          <PasswordStrengthMeter password={newPassword} minimumStrength="strong" />
        </CardContent>
        <CardFooter className="flex flex-col gap-2 sm:flex-row">
          <Button type="submit" disabled={loading || strength.level !== "strong" || !token.trim()} className="w-full sm:w-auto">
            {loading ? "Salvando..." : "Redefinir"}
          </Button>
          <Button type="button" variant="ghost" className="w-full sm:w-auto" onClick={() => router.push("/login")}>
            Voltar
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
