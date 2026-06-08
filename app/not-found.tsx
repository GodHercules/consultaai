import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-[1840px] items-center justify-center px-4 py-12 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Página não encontrada</CardTitle>
          <CardDescription>
            O endereço solicitado não existe ou foi movido. Vamos te levar de volta para uma área útil.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <Button asChild className="w-full sm:w-auto">
            <Link href="/companies">Ir para empresas</Link>
          </Button>
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link href="/login">Entrar novamente</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
