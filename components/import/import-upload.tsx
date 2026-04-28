"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function ImportUpload() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const file = fd.get("file");
    if (!(file instanceof File) || file.size === 0) {
      toast.error("Selecione um arquivo .xlsx");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/admin/import", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error("Falha na importação", { description: data?.error || "Verifique o arquivo." });
        return;
      }
      toast.success("Importação concluída.");
      router.push("/import/history");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Importação Excel</CardTitle>
        <CardDescription>
          MVP: identifica colunas automaticamente, remove duplicados e faz upsert inteligente.
        </CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit}>
        <CardContent className="space-y-2">
          <Input name="file" type="file" accept=".xlsx,.xls" />
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" disabled={loading}>
            {loading ? "Importando..." : "Importar"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

