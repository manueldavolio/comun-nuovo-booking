import * as XLSX from "xlsx";
import { CENTER_TIME_ZONE } from "@/lib/datetime-rome";

export type MonthlyReportBooking = {
  start_ts: string;
  end_ts: string;
  user_name: string | null;
  total_amount_cents: number | null;
  resource_name: string;
};

const MONTH_NAMES_IT = [
  "Gennaio",
  "Febbraio",
  "Marzo",
  "Aprile",
  "Maggio",
  "Giugno",
  "Luglio",
  "Agosto",
  "Settembre",
  "Ottobre",
  "Novembre",
  "Dicembre",
];

function romeParts(iso: string) {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("it-IT", {
    timeZone: CENTER_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "long",
    hour12: false,
  }).formatToParts(d);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";

  return {
    date: `${get("day")}/${get("month")}/${get("year")}`,
    weekday: get("weekday"),
    hour: get("hour"),
    minute: get("minute"),
    sortDate: `${get("year")}-${get("month")}-${get("day")}`,
    sortTime: `${get("hour")}:${get("minute")}`,
  };
}

function durationHours(startISO: string, endISO: string): number {
  const ms = new Date(endISO).getTime() - new Date(startISO).getTime();
  return Math.round((ms / 3600000) * 100) / 100;
}

function setCell(
  ws: XLSX.WorkSheet,
  addr: string,
  value: string | number,
  opts?: { bold?: boolean; numFmt?: string }
) {
  const cell: XLSX.CellObject = { v: value, t: typeof value === "number" ? "n" : "s" };
  if (opts?.numFmt) cell.z = opts.numFmt;
  if (opts?.bold) {
    (cell as XLSX.CellObject & { s?: object }).s = {
      font: { bold: true },
    };
  }
  ws[addr] = cell;
}

export function monthLabelIt(month: number, year: number): string {
  return `${MONTH_NAMES_IT[month - 1]} ${year}`;
}

export function reportFileName(month: number, year: number): string {
  return `Rendicontazione_Comun_Nuovo_${MONTH_NAMES_IT[month - 1]}_${year}.xlsx`;
}

export function buildMonthlyReportWorkbook(
  bookings: MonthlyReportBooking[],
  month: number,
  year: number
): XLSX.WorkBook {
  const sorted = [...bookings].sort((a, b) => {
    const pa = romeParts(a.start_ts);
    const pb = romeParts(b.start_ts);
    if (pa.sortDate !== pb.sortDate) return pa.sortDate.localeCompare(pb.sortDate);
    if (pa.sortTime !== pb.sortTime) return pa.sortTime.localeCompare(pb.sortTime);
    return a.resource_name.localeCompare(b.resource_name, "it");
  });

  type Agg = { count: number; hours: number; cents: number };
  const byResource = new Map<string, Agg>();

  for (const b of sorted) {
    const name = b.resource_name || "Sconosciuto";
    const cur = byResource.get(name) ?? { count: 0, hours: 0, cents: 0 };
    cur.count += 1;
    cur.hours += durationHours(b.start_ts, b.end_ts);
    cur.cents += b.total_amount_cents ?? 0;
    byResource.set(name, cur);
  }

  const resourceNames = [...byResource.keys()].sort((a, b) =>
    a.localeCompare(b, "it")
  );

  let totalCount = 0;
  let totalHours = 0;
  let totalCents = 0;

  // --- Foglio Riepilogo ---
  const riepilogo: XLSX.WorkSheet = {};
  setCell(riepilogo, "A1", "RENDICONTAZIONE UTILIZZO IMPIANTI", { bold: true });
  setCell(riepilogo, "A2", `Periodo: ${monthLabelIt(month, year)}`, { bold: true });

  setCell(riepilogo, "A4", "Impianto", { bold: true });
  setCell(riepilogo, "B4", "Numero utilizzi", { bold: true });
  setCell(riepilogo, "C4", "Ore totali", { bold: true });
  setCell(riepilogo, "D4", "Valore prenotazioni (€)", { bold: true });

  let row = 5;
  for (const name of resourceNames) {
    const agg = byResource.get(name)!;
    const hours = Math.round(agg.hours * 100) / 100;
    const euros = agg.cents / 100;
    setCell(riepilogo, `A${row}`, name);
    setCell(riepilogo, `B${row}`, agg.count);
    setCell(riepilogo, `C${row}`, hours);
    setCell(riepilogo, `D${row}`, euros, { numFmt: "#,##0.00" });
    totalCount += agg.count;
    totalHours += hours;
    totalCents += agg.cents;
    row += 1;
  }

  setCell(riepilogo, `A${row}`, "TOTALE", { bold: true });
  setCell(riepilogo, `B${row}`, totalCount, { bold: true });
  setCell(riepilogo, `C${row}`, Math.round(totalHours * 100) / 100, { bold: true });
  setCell(riepilogo, `D${row}`, totalCents / 100, {
    bold: true,
    numFmt: "#,##0.00",
  });

  riepilogo["!ref"] = `A1:D${row}`;
  riepilogo["!cols"] = [
    { wch: 22 },
    { wch: 16 },
    { wch: 12 },
    { wch: 24 },
  ];

  // --- Foglio Dettaglio ---
  const dettaglio: XLSX.WorkSheet = {};
  const headers = [
    "Data",
    "Giorno",
    "Ora inizio",
    "Ora fine",
    "Impianto",
    "Utilizzatore / Attività",
    "Durata (ore)",
    "Importo (€)",
  ];
  headers.forEach((h, i) => {
    const col = XLSX.utils.encode_col(i);
    setCell(dettaglio, `${col}1`, h, { bold: true });
  });

  sorted.forEach((b, idx) => {
    const r = idx + 2;
    const start = romeParts(b.start_ts);
    const end = romeParts(b.end_ts);
    const hours = durationHours(b.start_ts, b.end_ts);
    const euros = (b.total_amount_cents ?? 0) / 100;

    setCell(dettaglio, `A${r}`, start.date);
    setCell(dettaglio, `B${r}`, start.weekday);
    setCell(dettaglio, `C${r}`, `${start.hour}:${start.minute}`);
    setCell(dettaglio, `D${r}`, `${end.hour}:${end.minute}`);
    setCell(dettaglio, `E${r}`, b.resource_name);
    setCell(dettaglio, `F${r}`, b.user_name || "");
    setCell(dettaglio, `G${r}`, hours);
    setCell(dettaglio, `H${r}`, euros, { numFmt: "#,##0.00" });
  });

  const lastDetailRow = Math.max(1, sorted.length + 1);
  dettaglio["!ref"] = `A1:H${lastDetailRow}`;
  dettaglio["!cols"] = [
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 18 },
    { wch: 28 },
    { wch: 12 },
    { wch: 12 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, riepilogo, "Riepilogo");
  XLSX.utils.book_append_sheet(wb, dettaglio, "Dettaglio prenotazioni");
  return wb;
}

export function workbookToBuffer(wb: XLSX.WorkBook): Buffer {
  const out = XLSX.write(wb, {
    type: "buffer",
    bookType: "xlsx",
    cellStyles: true,
  });
  return Buffer.from(out);
}
