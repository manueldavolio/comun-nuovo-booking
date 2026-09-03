export type Sport = "CALCETTO" | "TENNIS" | null;

export const CENTER_TIME_ZONE = "Europe/Rome";

const DEFAULT_HOUR_CENTS = 5000;
const TENDONE_TENNIS_HOUR_CENTS = 1500;

const PALAZZETTO_WEEKDAY_HOUR_CENTS = 6000;
const PALAZZETTO_WEEKEND_HOUR_CENTS = 5000;
const SINTETICO_WEEKDAY_HOUR_CENTS = 5500;
const SINTETICO_WEEKEND_HOUR_CENTS = 5000;

function normalizeSport(sport?: Sport | string | null): Sport {
  if (sport === "TENNIS") return "TENNIS";
  if (sport === "CALCETTO") return "CALCETTO";
  return null;
}

export function isTendoneOrSintetico(resourceName: string): boolean {
  const lower = (resourceName || "").trim().toLowerCase();
  return lower.includes("tendone") || lower === "sintetico";
}

export function getBookingDateKey(bookingDate: string | Date): string {
  const date =
    typeof bookingDate === "string" ? new Date(bookingDate) : bookingDate;

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: CENTER_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Sabato/domenica in base alla data della prenotazione (Europe/Rome). */
function isWeekendBooking(bookingDate: string | Date): boolean {
  const key = getBookingDateKey(bookingDate);
  const [y, m, d] = key.split("-").map(Number);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=dom, 6=sab
  return day === 0 || day === 6;
}

/** Prezzo orario in centesimi, in base a risorsa, data prenotazione e sport. */
export function getHourlyPrice(
  resourceName: string,
  bookingDate: string | Date,
  sport?: Sport | string | null
): number {
  const name = (resourceName || "").trim();
  const normalizedSport = normalizeSport(sport);
  const weekend = isWeekendBooking(bookingDate);

  if (isTendoneOrSintetico(name)) {
    if (normalizedSport === "TENNIS") return TENDONE_TENNIS_HOUR_CENTS;
    return weekend
      ? SINTETICO_WEEKEND_HOUR_CENTS
      : SINTETICO_WEEKDAY_HOUR_CENTS;
  }

  if (name === "Palazzetto") {
    return weekend
      ? PALAZZETTO_WEEKEND_HOUR_CENTS
      : PALAZZETTO_WEEKDAY_HOUR_CENTS;
  }

  return DEFAULT_HOUR_CENTS;
}

export function calcTotalCents(
  resourceName: string,
  minutes: number,
  bookingDate: string | Date,
  sport?: Sport | string | null
): number {
  const perHour = getHourlyPrice(resourceName, bookingDate, sport);
  return Math.round(perHour * (minutes / 60));
}

export function formatHourlyPriceLabel(
  resourceName: string,
  bookingDate: string | Date,
  sport: "CALCETTO" | "TENNIS"
): string {
  const euros = getHourlyPrice(resourceName, bookingDate, sport) / 100;
  const sportLabel = sport === "TENNIS" ? "Tennis" : "Calcetto";
  return `${sportLabel} - ${euros} €/ora`;
}
