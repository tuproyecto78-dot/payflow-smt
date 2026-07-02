// Client-side i18n hook for PayFlow SMT.
// Provides a lightweight React hook for formatting amounts and dates
// using the project locale, without bundling a full i18n framework.

"use client";

import { useMemo } from "react";
import {
  getCurrency,
  formatMoney,
  isSupportedCurrency,
  isCurrencySupportedByProvider,
  getSupportedCurrenciesForProvider,
  detectCurrencyFromCountry,
  detectCountryCodeFromCountry,
  CURRENCIES,
  type CurrencyDef,
} from "./currencies";
import {
  getLocale,
  LOCALES,
  isSupportedLocale,
  formatDate,
  formatDateTime,
  formatTime,
  detectLocaleFromCountry,
  type LocaleDef,
} from "./locales";

export interface UseI18nOptions {
  currency?: string | null;
  locale?: string | null;
}

export interface I18nHelpers {
  currency: CurrencyDef;
  locale: LocaleDef;
  formatMoney: (amount: number, currencyOverride?: string | null) => string;
  formatDate: (date: Date | string | number) => string;
  formatDateTime: (date: Date | string | number) => string;
  formatTime: (date: Date | string | number) => string;
}

export function useI18n(options: UseI18nOptions = {}): I18nHelpers {
  const currencyCode = options.currency || "USD";
  const localeCode = options.locale || "es-EC";

  return useMemo(() => {
    const currency = getCurrency(currencyCode);
    const locale = getLocale(localeCode);
    return {
      currency,
      locale,
      formatMoney: (amount: number, currencyOverride?: string | null) =>
        formatMoney(amount, currencyOverride || currencyCode, localeCode),
      formatDate: (date: Date | string | number) => formatDate(date, localeCode),
      formatDateTime: (date: Date | string | number) => formatDateTime(date, localeCode),
      formatTime: (date: Date | string | number) => formatTime(date, localeCode),
    };
  }, [currencyCode, localeCode]);
}

export {
  getCurrency,
  formatMoney,
  isSupportedCurrency,
  isCurrencySupportedByProvider,
  getSupportedCurrenciesForProvider,
  detectCurrencyFromCountry,
  detectCountryCodeFromCountry,
  CURRENCIES,
  getLocale,
  LOCALES,
  isSupportedLocale,
  formatDate,
  formatDateTime,
  formatTime,
  detectLocaleFromCountry,
};
