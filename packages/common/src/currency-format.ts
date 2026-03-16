export function formatCurrencyCents(
  cents: number,
  opts?: {
    locale?: string;
    currency?: string;
    maximumFractionDigits?: number;
    minimumFractionDigits?: number;
  },
): string {
  const {
    locale = "en-US",
    currency = "USD",
    maximumFractionDigits,
    minimumFractionDigits,
  } = opts ?? {};

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits,
    minimumFractionDigits,
  }).format(cents / 100);
}

export function formatPriceCents(
  priceCents: number | null,
  opts?: {
    nullLabel?: string;
    freeLabel?: string;
    locale?: string;
    currency?: string;
    maximumFractionDigits?: number;
    minimumFractionDigits?: number;
  },
): string {
  const { nullLabel = "Contact for pricing", freeLabel = "Free", ...formatOptions } = opts ?? {};
  if (priceCents == null) return nullLabel;
  if (priceCents === 0) return freeLabel;
  return formatCurrencyCents(priceCents, formatOptions);
}
