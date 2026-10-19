import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Breadcrumb = {
  label: string;
  href?: string;
};

export function PageHeader(props: {
  kicker?: string;
  title: string;
  description?: string;
  breadcrumbs?: Breadcrumb[];
  actions?: ReactNode;
  className?: string;
}) {
  const breadcrumbs = props.breadcrumbs ?? [];

  return (
    <header
      className={cn(
"relative flex flex-col gap-5 bg-transparent pb-5 sm:pb-6 lg:flex-row lg:items-end lg:justify-between",
        props.className
      )}
    >
      <div className="animate-glass-rise min-w-0 space-y-3 [animation-delay:90ms]">
        {breadcrumbs.length ? (
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {breadcrumbs.map((crumb, index) => (
              <span key={`${crumb.label}-${index}`} className="flex items-center gap-2">
                {crumb.href ? (
                  <Link
                    href={crumb.href}
                    className="transition hover:text-foreground"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-foreground/70">{crumb.label}</span>
                )}
                {index < breadcrumbs.length - 1 ? (
                  <span aria-hidden="true" className="text-border">
                    /
                  </span>
                ) : null}
              </span>
            ))}
          </nav>
        ) : null}

        {props.kicker ? (
          <p className="text-sm font-medium text-primary">
            {props.kicker}
          </p>
        ) : null}

        <div className="space-y-2">
          <h1 className="font-display text-balance text-2xl font-semibold tracking-[-0.04em] text-foreground sm:text-3xl">
            {props.title}
          </h1>
          {props.description ? (
            <p className="max-w-4xl text-pretty text-sm leading-6 text-muted-foreground sm:text-base">
              {props.description}
            </p>
          ) : null}
        </div>
      </div>

      {props.actions ? (
        <div className="animate-glass-rise flex flex-wrap items-center gap-2 lg:justify-end [animation-delay:140ms]">
          {props.actions}
        </div>
      ) : null}
    </header>
  );
}
