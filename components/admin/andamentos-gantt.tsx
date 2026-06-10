"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { formatCnpjDisplay } from "@/utils/cnpj";

type Item = {
  id: string;
  title: string;
  status: "TODO" | "IN_PROGRESS" | "DONE" | "BLOCKED";
  startDate: string;
  endDate: string;
  company: { id: string; razaoSocial: string | null; nomeFantasia: string | null; cnpjNumerico: string | null };
  createdByUser: { id: string; name: string; email: string };
};

function statusColor(status: Item["status"]) {
  switch (status) {
    case "DONE":
      return "bg-emerald-500/70";
    case "IN_PROGRESS":
      return "bg-blue-500/70";
    case "BLOCKED":
      return "bg-red-500/70";
    default:
      return "bg-zinc-500/60";
  }
}

export function AndamentosGantt(props: { items: Item[] }) {
  const items = useMemo(() => props.items, [props.items]);

  const prepared = useMemo(() => {
    if (!items.length) return null;

    const parsed = items.map((i) => ({
      ...i,
      start: new Date(i.startDate),
      end: new Date(i.endDate),
    }));

    let minStart = parsed[0].start;
    let maxEnd = parsed[0].end;
    for (const p of parsed) {
      if (p.start < minStart) minStart = p.start;
      if (p.end > maxEnd) maxEnd = p.end;
    }

    const maxWindowMs = 180 * 24 * 60 * 60 * 1000;
    const rangeEnd = maxEnd;
    const rangeStart = new Date(Math.max(minStart.getTime(), rangeEnd.getTime() - maxWindowMs));
    const rangeMs = Math.max(1, rangeEnd.getTime() - rangeStart.getTime());

    const byCompany = new Map<string, { company: Item["company"]; rows: typeof parsed }>();
    for (const p of parsed) {
      const key = p.company.id;
      const prev = byCompany.get(key);
      if (prev) prev.rows.push(p);
      else byCompany.set(key, { company: p.company, rows: [p] });
    }

    const companies = Array.from(byCompany.values()).sort((a, b) => {
      const an = (a.company.razaoSocial || a.company.nomeFantasia || "").toLowerCase();
      const bn = (b.company.razaoSocial || b.company.nomeFantasia || "").toLowerCase();
      return an.localeCompare(bn);
    });
    companies.forEach((c) => c.rows.sort((a, b) => a.start.getTime() - b.start.getTime()));

    return { companies, rangeStart, rangeEnd, rangeMs };
  }, [items]);

  if (!prepared) {
    return <div className="text-sm text-muted-foreground">Nenhum andamento encontrado.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge variant="outline">
          {prepared.rangeStart.toISOString().slice(0, 10)} → {prepared.rangeEnd.toISOString().slice(0, 10)}
        </Badge>
        <Badge variant="secondary">DONE</Badge>
        <Badge variant="secondary">IN_PROGRESS</Badge>
        <Badge variant="secondary">BLOCKED</Badge>
        <Badge variant="secondary">TODO</Badge>
      </div>

      <div className="space-y-2">
        {prepared.companies.map((group) => {
          const name = group.company.razaoSocial || group.company.nomeFantasia || "(sem nome)";
          return (
            <div key={group.company.id} className="rounded-[1.25rem] border border-border/70 bg-background/55 shadow-sm">
              <div className="flex flex-col gap-2 p-4 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{name}</div>
                  <div className="truncate text-xs text-muted-foreground">{formatCnpjDisplay(group.company.cnpjNumerico)}</div>
                </div>
                <div className="text-xs text-muted-foreground">{group.rows.length} item(ns)</div>
              </div>

              <div className="relative h-14 border-t border-border/70 bg-muted/20">
                {group.rows.map((r) => {
                  const left = ((r.start.getTime() - prepared.rangeStart.getTime()) / prepared.rangeMs) * 100;
                  const right = ((r.end.getTime() - prepared.rangeStart.getTime()) / prepared.rangeMs) * 100;
                  const width = Math.max(0.8, right - left);
                  return (
                    <div
                      key={r.id}
                      title={`${r.title} • ${r.status} • ${r.createdByUser.name}`}
                      className={`absolute top-4 h-6 rounded-xl ${statusColor(r.status)} text-[11px] text-white shadow-sm`}
                      style={{ left: `${left}%`, width: `${width}%` }}
                    >
                      <div className="truncate px-2 leading-6">{r.title}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
