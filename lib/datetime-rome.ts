export const CENTER_TIME_ZONE = "Europe/Rome";

function lastSundayOfMonthUTC(year: number, monthIndexZeroBased: number) {
  const d = new Date(Date.UTC(year, monthIndexZeroBased + 1, 0));
  const day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - day);
  return d;
}

/** +01:00 inverno, +02:00 estate (Europe/Rome). */
export function getRomeOffsetString(datePart: string, timePart: string): string {
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);

  const marchLastSunday = lastSundayOfMonthUTC(year, 2);
  const octoberLastSunday = lastSundayOfMonthUTC(year, 9);
  const marchDay = marchLastSunday.getUTCDate();
  const octoberDay = octoberLastSunday.getUTCDate();

  let isDST = false;

  if (month < 3 || month > 10) {
    isDST = false;
  } else if (month > 3 && month < 10) {
    isDST = true;
  } else if (month === 3) {
    if (day > marchDay) isDST = true;
    else if (day < marchDay) isDST = false;
    else isDST = hour >= 2;
  } else if (month === 10) {
    if (day < octoberDay) isDST = true;
    else if (day > octoberDay) isDST = false;
    else isDST = hour < 3 || (hour === 2 && minute <= 59);
  }

  return isDST ? "+02:00" : "+01:00";
}

export function buildRomeIso(
  datePart: string,
  timePart: string,
  seconds = "00"
): string {
  const [hh, mm] = timePart.split(":");
  const offset = getRomeOffsetString(datePart, timePart);
  return `${datePart}T${hh}:${mm}:${seconds}${offset}`;
}

export function buildRomeIsoFromDateTimeLocal(value: string): string {
  const m = value.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/);
  if (!m) throw new Error("Formato datetime-local non valido");
  return buildRomeIso(m[1], `${m[2]}:${m[3]}`);
}

export function buildRomeIsoFromTimestamp(ts: number): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: CENTER_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(ts));

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";

  const datePart = `${get("year")}-${get("month")}-${get("day")}`;
  const timePart = `${get("hour")}:${get("minute")}`;
  return buildRomeIso(datePart, timePart);
}

export function buildRomeIsoEndFromStart(startRomeIso: string, minutes: number): string {
  const m = startRomeIso.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})/);
  if (!m) throw new Error("Formato startISO non valido");

  const datePart = m[1];
  const startMinutes = Number(m[2]) * 60 + Number(m[3]);
  const endMinutes = startMinutes + minutes;
  const endH = Math.floor(endMinutes / 60);
  const endM = endMinutes % 60;
  const timePart = `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
  return buildRomeIso(datePart, timePart, m[4]);
}

export type WallClockParts = {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
};

export function parseWallClockParts(iso: string): WallClockParts | null {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return null;
  return {
    year: m[1],
    month: m[2],
    day: m[3],
    hour: m[4],
    minute: m[5],
  };
}

/** Aggiunge offset Rome se mancante; non altera l'orario di parete. */
export function ensureRomeIso(iso: string): string {
  if (/[+-]\d{2}:\d{2}$/.test(iso) || iso.endsWith("Z")) return iso;
  const m = iso.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return iso;
  return buildRomeIso(m[1], `${m[2]}:${m[3]}`, m[4] ?? "00");
}
