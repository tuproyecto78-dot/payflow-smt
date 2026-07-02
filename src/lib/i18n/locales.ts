// Locale registry and date/time formatting helpers for PayFlow SMT.

export interface LocaleDef {
  code: string;        // BCP-47 (e.g. "es-EC")
  language: "es" | "en"; // primary language
  label: string;       // "Español (Ecuador)"
  labelEn: string;     // "Spanish (Ecuador)"
  country?: string;    // associated country
  dateFormat: string;  // date-fns pattern for short dates
  dateTimeFormat: string; // date-fns pattern for date + time
  timeFormat: string;  // date-fns pattern for time
  timezone?: string;   // IANA tz (optional)
}

export const LOCALES: LocaleDef[] = [
  { code: "es-EC", language: "es", label: "Español (Ecuador)", labelEn: "Spanish (Ecuador)", country: "Ecuador", dateFormat: "d MMM yyyy", dateTimeFormat: "d MMM yyyy HH:mm", timeFormat: "HH:mm", timezone: "America/Guayaquil" },
  { code: "es-MX", language: "es", label: "Español (México)", labelEn: "Spanish (Mexico)", country: "México", dateFormat: "d MMM yyyy", dateTimeFormat: "d MMM yyyy HH:mm", timeFormat: "HH:mm", timezone: "America/Mexico_City" },
  { code: "es-ES", language: "es", label: "Español (España)", labelEn: "Spanish (Spain)", country: "España", dateFormat: "d MMM yyyy", dateTimeFormat: "d MMM yyyy HH:mm", timeFormat: "HH:mm", timezone: "Europe/Madrid" },
  { code: "es-CO", language: "es", label: "Español (Colombia)", labelEn: "Spanish (Colombia)", country: "Colombia", dateFormat: "d MMM yyyy", dateTimeFormat: "d MMM yyyy HH:mm", timeFormat: "HH:mm", timezone: "America/Bogota" },
  { code: "es-PE", language: "es", label: "Español (Perú)", labelEn: "Spanish (Peru)", country: "Perú", dateFormat: "d MMM yyyy", dateTimeFormat: "d MMM yyyy HH:mm", timeFormat: "HH:mm", timezone: "America/Lima" },
  { code: "es-CL", language: "es", label: "Español (Chile)", labelEn: "Spanish (Chile)", country: "Chile", dateFormat: "d MMM yyyy", dateTimeFormat: "d MMM yyyy HH:mm", timeFormat: "HH:mm", timezone: "America/Santiago" },
  { code: "es-AR", language: "es", label: "Español (Argentina)", labelEn: "Spanish (Argentina)", country: "Argentina", dateFormat: "d MMM yyyy", dateTimeFormat: "d MMM yyyy HH:mm", timeFormat: "HH:mm", timezone: "America/Argentina/Buenos_Aires" },
  { code: "en-US", language: "en", label: "English (United States)", labelEn: "English (United States)", country: "United States", dateFormat: "MMM d, yyyy", dateTimeFormat: "MMM d, yyyy h:mm a", timeFormat: "h:mm a", timezone: "America/New_York" },
  { code: "en-GB", language: "en", label: "English (United Kingdom)", labelEn: "English (United Kingdom)", country: "United Kingdom", dateFormat: "d MMM yyyy", dateTimeFormat: "d MMM yyyy HH:mm", timeFormat: "HH:mm", timezone: "Europe/London" },
  { code: "pt-BR", language: "en", label: "Português (Brasil)", labelEn: "Portuguese (Brazil)", country: "Brasil", dateFormat: "d MMM yyyy", dateTimeFormat: "d MMM yyyy HH:mm", timeFormat: "HH:mm", timezone: "America/Sao_Paulo" },
];

const LOCALE_MAP: Record<string, LocaleDef> = Object.fromEntries(
  LOCALES.map((l) => [l.code, l])
);

export function getLocale(code?: string | null): LocaleDef {
  if (code && LOCALE_MAP[code]) return LOCALE_MAP[code];
  return LOCALE_MAP["es-EC"];
}

export function isSupportedLocale(code?: string | null): boolean {
  return !!code && !!LOCALE_MAP[code];
}

export function getLanguageFromLocale(locale?: string | null): "es" | "en" {
  return getLocale(locale).language;
}

export function getLocalesForLanguage(lang: "es" | "en"): LocaleDef[] {
  return LOCALES.filter((l) => l.language === lang);
}

// Detect a locale from country name. Returns the most specific match or "es-EC".
export function detectLocaleFromCountry(country?: string | null): string {
  if (!country) return "es-EC";
  const c = country.toLowerCase().trim();
  const match = LOCALES.find((l) => l.country && l.country.toLowerCase() === c);
  if (match) return match.code;
  // partial matches
  const partial = LOCALES.find((l) => l.country && (c.includes(l.country.toLowerCase()) || l.country.toLowerCase().includes(c)));
  return partial ? partial.code : "es-EC";
}

// Format an ISO date string in the given locale using date-fns-style pattern.
// We avoid bundling date-fns here; this uses Intl.DateTimeFormat instead.
export function formatDate(date: Date | string | number, localeCode?: string | null): string {
  const loc = getLocale(localeCode);
  const d = typeof date === "string" ? new Date(date) : (date instanceof Date ? date : new Date(date));
  if (isNaN(d.getTime())) return "—";
  try {
    return new Intl.DateTimeFormat(loc.code, {
      year: "numeric", month: "short", day: "numeric",
      timeZone: loc.timezone,
    }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

export function formatDateTime(date: Date | string | number, localeCode?: string | null): string {
  const loc = getLocale(localeCode);
  const d = typeof date === "string" ? new Date(date) : (date instanceof Date ? date : new Date(date));
  if (isNaN(d.getTime())) return "—";
  try {
    return new Intl.DateTimeFormat(loc.code, {
      year: "numeric", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit",
      timeZone: loc.timezone,
      hour12: loc.language === "en" && loc.code === "en-US",
    }).format(d);
  } catch {
    return d.toISOString().replace("T", " ").slice(0, 16);
  }
}

export function formatTime(date: Date | string | number, localeCode?: string | null): string {
  const loc = getLocale(localeCode);
  const d = typeof date === "string" ? new Date(date) : (date instanceof Date ? date : new Date(date));
  if (isNaN(d.getTime())) return "—";
  try {
    return new Intl.DateTimeFormat(loc.code, {
      hour: "2-digit", minute: "2-digit",
      timeZone: loc.timezone,
      hour12: loc.language === "en" && loc.code === "en-US",
    }).format(d);
  } catch {
    return d.toISOString().slice(11, 16);
  }
}
