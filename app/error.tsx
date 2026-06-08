"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-[1840px] items-center justify-center px-4 py-12 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Algo saiu do esperado</CardTitle>
          <CardDescription>
            A página encontrou um problema temporário. Você pode tentar novamente sem perder o contexto.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <Button onClick={reset} className="w-full sm:w-auto">
            Tentar novamente
          </Button>
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link href="/companies">Ir para empresas</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
