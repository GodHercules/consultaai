const DISPLAY_DATE_FORMAT = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "America/Sao_Paulo",
});

export function parseContractDate(value: Date | string | null | undefined) {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const trimmed = value.trim();
  if (!trimmed) return null;

  const parsed = new Date(trimmed.length === 10 ? `${trimmed}T00:00:00` : trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatDateDisplay(value: Date | string | null | undefined) {
  const date = parseContractDate(value);
  if (!date) return "-";
  return DISPLAY_DATE_FORMAT.format(date);
}

export function formatDateInput(value: Date | string | null | undefined) {
  const date = parseContractDate(value);
  if (!date) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatContractTenure(
  startedAt: Date | string | null | undefined,
  endedAt?: Date | string | null | undefined,
) {
  const start = parseContractDate(startedAt);
  if (!start) return null;

  const end = parseContractDate(endedAt) ?? new Date();
  const durationMs = Math.max(0, end.getTime() - start.getTime());
  const totalDays = Math.floor(durationMs / 86_400_000);
  const totalMonths = Math.floor(totalDays / 30);
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;

  if (years > 0) {
    const yearLabel = years === 1 ? "ano" : "anos";
    if (!months) return `${years} ${yearLabel}`;
    const monthLabel = months === 1 ? "mês" : "meses";
    return `${years} ${yearLabel} e ${months} ${monthLabel}`;
  }

  if (totalMonths > 0) {
    return `${totalMonths} ${totalMonths === 1 ? "mês" : "meses"}`;
  }

  return `${totalDays} ${totalDays === 1 ? "dia" : "dias"}`;
}

export function getContractAgeDays(
  startedAt: Date | string | null | undefined,
  endedAt?: Date | string | null | undefined,
) {
  const start = parseContractDate(startedAt);
  if (!start) return null;
  const end = parseContractDate(endedAt) ?? new Date();
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86_400_000));
}

export function compareNullableDates(
  a: Date | string | null | undefined,
  b: Date | string | null | undefined,
  direction: "asc" | "desc" = "asc",
) {
  const left = parseContractDate(a);
  const right = parseContractDate(b);

  if (!left && !right) return 0;
  if (!left) return 1;
  if (!right) return -1;

  const diff = left.getTime() - right.getTime();
  return direction === "asc" ? diff : -diff;
}
