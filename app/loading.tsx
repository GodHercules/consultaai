import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function Loading() {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-[1840px] items-center justify-center px-4 py-12 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">
      <div className="w-full max-w-5xl space-y-6">
        <div className="space-y-3">
          <div className="h-3 w-24 animate-pulse rounded-full bg-muted" />
          <div className="h-10 w-2/3 animate-pulse rounded-2xl bg-muted/80" />
          <div className="h-4 w-full max-w-2xl animate-pulse rounded-full bg-muted/70" />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Card key={index}>
              <CardHeader>
                <div className="h-3 w-24 animate-pulse rounded-full bg-muted" />
                <div className="h-8 w-16 animate-pulse rounded-2xl bg-muted/80" />
              </CardHeader>
              <CardContent>
                <div className="h-4 w-full animate-pulse rounded-full bg-muted/70" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
