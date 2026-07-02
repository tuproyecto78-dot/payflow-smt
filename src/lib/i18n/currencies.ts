// Currency registry for PayFlow SMT.
// Centralizes supported currencies, formatting rules, and per-provider support.

export interface CurrencyDef {
  code: string;          // ISO 4217 (e.g. "USD")
  symbol: string;        // "$", "€", "R$"
  name: string;          // "Dólar estadounidense"
  nameEn: string;        // "US Dollar"
  decimals: number;      // 2 for USD/EUR, 0 for CLP
  locale: string;        // default locale for formatting ("es-EC", "en-US")
  countries: string[];   // typical countries (lowercase)
}

export const CURRENCIES: CurrencyDef[] = [
  { code: "USD", symbol: "$", name: "Dólar estadounidense", nameEn: "US Dollar", decimals: 2, locale: "en-US", countries: ["ecuador", "estados unidos", "united states", "usa", "el salvador", "panamá", "panama"] },
  { code: "EUR", symbol: "€", name: "Euro", nameEn: "Euro", decimals: 2, locale: "es-ES", countries: ["españa", "spain", "alemania", "germany", "francia", "france", "italia", "italy", "portugal"] },
  { code: "MXN", symbol: "$", name: "Peso mexicano", nameEn: "Mexican Peso", decimals: 2, locale: "es-MX", countries: ["méxico", "mexico"] },
  { code: "COP", symbol: "$", name: "Peso colombiano", nameEn: "Colombian Peso", decimals: 0, locale: "es-CO", countries: ["colombia"] },
  { code: "PEN", symbol: "S/", name: "Sol peruano", nameEn: "Peruvian Sol", decimals: 2, locale: "es-PE", countries: ["perú", "peru"] },
  { code: "CLP", symbol: "$", name: "Peso chileno", nameEn: "Chilean Peso", decimals: 0, locale: "es-CL", countries: ["chile"] },
  { code: "ARS", symbol: "$", name: "Peso argentino", nameEn: "Argentine Peso", decimals: 2, locale: "es-AR", countries: ["argentina"] },
  { code: "BRL", symbol: "R$", name: "Real brasileño", nameEn: "Brazilian Real", decimals: 2, locale: "pt-BR", countries: ["brasil", "brazil"] },
];

const CURRENCY_MAP: Record<string, CurrencyDef> = Object.fromEntries(
  CURRENCIES.map((c) => [c.code, c])
);

export function getCurrency(code?: string | null): CurrencyDef {
  if (code && CURRENCY_MAP[code.toUpperCase()]) return CURRENCY_MAP[code.toUpperCase()];
  return CURRENCY_MAP["USD"];
}

export function isSupportedCurrency(code?: string | null): boolean {
  return !!code && !!CURRENCY_MAP[code.toUpperCase()];
}

// Providers supported by each currency.
// PayPhone currently only supports USD (Ecuador). Stripe supports many. DEUNA supports LATAM.
const PROVIDER_CURRENCY_SUPPORT: Record<string, string[]> = {
  PayPhone: ["USD"],
  DEUNA: ["USD", "MXN", "COP", "PEN", "CLP", "BRL"],
  Stripe: ["USD", "EUR", "MXN", "COP", "PEN", "CLP", "ARS", "BRL"],
  Mock: ["USD", "EUR", "MXN", "COP", "PEN", "CLP", "ARS", "BRL"],
  "API personalizada": ["USD", "EUR", "MXN", "COP", "PEN", "CLP", "ARS", "BRL"],
};

export function isCurrencySupportedByProvider(currency: string, provider: string): boolean {
  const list = PROVIDER_CURRENCY_SUPPORT[provider] || ["USD"];
  return list.includes(currency.toUpperCase());
}

export function getSupportedCurrenciesForProvider(provider: string): CurrencyDef[] {
  const list = PROVIDER_CURRENCY_SUPPORT[provider] || ["USD"];
  return CURRENCIES.filter((c) => list.includes(c.code));
}

// Format an amount with the right currency and locale.
// Pure function (no Intl side effects beyond formatting).
export function formatMoney(amount: number, currencyCode?: string | null, locale?: string | null): string {
  const cur = getCurrency(currencyCode);
  const loc = locale || cur.locale;
  try {
    return new Intl.NumberFormat(loc, {
      style: "currency",
      currency: cur.code,
      minimumFractionDigits: cur.decimals,
      maximumFractionDigits: cur.decimals,
    }).format(amount);
  } catch {
    // Fallback: manual format
    const fixed = amount.toFixed(cur.decimals);
    return `${cur.symbol} ${fixed}`;
  }
}

// Detect currency from country name (case-insensitive, partial match).
export function detectCurrencyFromCountry(country?: string | null): string {
  if (!country) return "USD";
  const c = country.toLowerCase().trim();
  for (const cur of CURRENCIES) {
    if (cur.countries.some((cn) => cn === c || c.includes(cn) || cn.includes(c))) {
      return cur.code;
    }
  }
  return "USD";
}

// Get the country calling code (E.164 prefix) from country name.
const COUNTRY_CODE_MAP: Record<string, string> = {
  ecuador: "593",
  "estados unidos": "1",
  "united states": "1",
  usa: "1",
  méxico: "52",
  mexico: "52",
  colombia: "57",
  perú: "51",
  peru: "51",
  chile: "56",
  argentina: "54",
  brasil: "55",
  brazil: "55",
  españa: "34",
  spain: "34",
};

export function detectCountryCodeFromCountry(country?: string | null): string {
  if (!country) return "593";
  return COUNTRY_CODE_MAP[country.toLowerCase().trim()] || "593";
}

// Format currency for display in selectors: "USD — $ — Dólar estadounidense"
export function formatCurrencyOption(cur: CurrencyDef, lang: "es" | "en" = "es"): string {
  const name = lang === "en" ? cur.nameEn : cur.name;
  return `${cur.code} — ${cur.symbol} — ${name}`;
}
