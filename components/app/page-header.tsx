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
        "animate-glass-rise relative flex flex-col gap-5 overflow-hidden rounded-[2.25rem] border border-border/60 bg-white/90 p-5 shadow-[0_24px_60px_-40px_rgba(15,23,42,0.25)] backdrop-blur-xl sm:p-6 lg:flex-row lg:items-end lg:justify-between lg:p-7 xl:p-8",
        props.className
      )}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(29,78,216,0.8),rgba(96,165,250,0.65),transparent)]"
      />
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
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[#1d4ed8]">
            {props.kicker}
          </p>
        ) : null}

        <div className="space-y-2">
          <h1 className="font-display text-balance text-3xl font-semibold tracking-[-0.04em] text-foreground sm:text-4xl xl:text-[2.9rem]">
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
