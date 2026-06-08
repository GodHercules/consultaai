"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function ForgotPasswordForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok && data?.error === "RESET_LIMIT") {
        toast.error("Limite de reset atingido", {
          description: "Você só pode solicitar redefinição 1 vez por dia.",
        });
        return;
      }
      if (!res.ok) {
        toast.error("Falha ao solicitar reset", {
          description: "Tente novamente em alguns minutos.",
        });
        return;
      }
      toast.success("Solicitação recebida", {
        description: "Se o e-mail existir, você receberá instruções em instantes.",
      });
      router.replace("/login");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Esqueci minha senha</CardTitle>
        <CardDescription>
          Enviaremos um token via webhook n8n para o e-mail corporativo cadastrado.
        </CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit}>
        <CardContent className="space-y-4">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <p className="text-xs leading-5 text-muted-foreground">
            Se o endereço existir, o envio é processado em poucos instantes.
          </p>
        </CardContent>
        <CardFooter className="flex flex-col gap-2 sm:flex-row">
          <Button type="submit" disabled={loading} className="w-full sm:w-auto">
            {loading ? "Enviando..." : "Enviar"}
          </Button>
          <Button type="button" variant="ghost" className="w-full sm:w-auto" onClick={() => router.push("/login")}>
            Voltar
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
