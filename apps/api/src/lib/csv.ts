type Cell = string | number | null | undefined;

const esc = (v: Cell) => {
  if (v == null) return "";
  const s = String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const toCsv = (header: string[], rows: Cell[][]) => [header, ...rows].map((r) => r.map(esc).join(",")).join("\n");
