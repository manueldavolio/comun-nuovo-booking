export type Sport = "CALCETTO" | "TENNIS" | null;

export const CENTER_TIME_ZONE = "Europe/Rome";

/** Dal 1 giugno 2026 la promo calcetto è attiva (fino al 31 maggio prezzi legacy). */
const PROMO_START_DATE = "2026-06-01";

const DEFAULT_HOUR_CENTS = 5000;
const TENDONE_TENNIS_HOUR_CENTS = 1500;

const LEGACY_PALAZZETTO_HOUR_CENTS = 6000;
const LEGACY_SINTETICO_CALCETTO_HOUR_CENTS = 5000;
const PROMO_CALCETTO_HOUR_CENTS = 3500;

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

export function isPromoCalcettoActive(bookingDate: string | Date): boolean {
  return getBookingDateKey(bookingDate) >= PROMO_START_DATE;
}

/** Prezzo orario in centesimi, in base a risorsa, data prenotazione e sport. */
export function getHourlyPrice(
  resourceName: string,
  bookingDate: string | Date,
  sport?: Sport | string | null
): number {
  const name = (resourceName || "").trim();
  const normalizedSport = normalizeSport(sport);

  if (isTendoneOrSintetico(name)) {
    if (normalizedSport === "TENNIS") return TENDONE_TENNIS_HOUR_CENTS;
    if (isPromoCalcettoActive(bookingDate)) return PROMO_CALCETTO_HOUR_CENTS;
    return LEGACY_SINTETICO_CALCETTO_HOUR_CENTS;
  }

  if (name === "Palazzetto") {
    if (isPromoCalcettoActive(bookingDate)) return PROMO_CALCETTO_HOUR_CENTS;
    return LEGACY_PALAZZETTO_HOUR_CENTS;
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
