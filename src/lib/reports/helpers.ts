import { format, addDays, isWithinInterval, parseISO, isValid } from "date-fns";

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = parseISO(value);
  if (!isValid(date)) return "—";
  return format(date, "dd MMM yyyy");
}

export function safeText(value: string | null | undefined, fallback = "—"): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

export function customerDisplayName(fullName: string | null | undefined): string {
  return fullName?.trim() || "Unnamed Customer";
}

export function statusBadgeVariant(
  status: string
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "active") return "default";
  if (status === "maintenance") return "secondary";
  if (status === "decommissioned") return "destructive";
  return "outline";
}

export function isWarrantyExpiringSoon(
  warrantyEnd: string | null | undefined,
  withinDays = 30
): boolean {
  if (!warrantyEnd) return false;
  const end = parseISO(warrantyEnd);
  if (!isValid(end)) return false;
  const now = new Date();
  return isWithinInterval(end, { start: now, end: addDays(now, withinDays) });
}

export function matchesSearchTerm(
  term: string,
  values: Array<string | null | undefined>
): boolean {
  const normalized = term.trim().toLowerCase();
  if (!normalized) return true;
  return values.some((value) => value?.toLowerCase().includes(normalized));
}

export function buildCsvData(sections: {
  deviceOwnership: string[][];
  vehicleCoverage: string[][];
  customerCoverage: string[][];
}): string {
  const lines: string[] = [];

  const appendSection = (title: string, headers: string[], rows: string[][]) => {
    lines.push(title);
    lines.push(headers.join(","));
    for (const row of rows) {
      lines.push(row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","));
    }
    lines.push("");
  };

  appendSection("Device Ownership Report", sections.deviceOwnership[0], sections.deviceOwnership.slice(1));
  appendSection("Vehicle Coverage Report", sections.vehicleCoverage[0], sections.vehicleCoverage.slice(1));
  appendSection(
    "Customer Coverage Report",
    sections.customerCoverage[0],
    sections.customerCoverage.slice(1)
  );

  return lines.join("\n");
}
