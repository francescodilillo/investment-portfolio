import type { InstrumentConfig, PortfolioConfig } from "./types";
import type { PortfolioStructure } from "./config";

const FRANKFURTER = "https://api.frankfurter.dev/v1/latest";
const YAHOO_CHART = "/api/yahoo/v8/finance/chart";
const COINGECKO = "https://api.coingecko.com/api/v3/simple/price";
const CRYPTO_CURRENCIES = new Set(["BTC", "ETH"]);
const CRYPTO_IDS: Record<string, string> = { BTC: "bitcoin", ETH: "ethereum" };

export interface MarketSnapshot {
  fetchedAt: Date;
  exchangeRates: Record<string, number>;
  instruments: Record<string, InstrumentConfig>;
}

interface YahooChartResponse {
  chart: {
    result: Array<{
      meta: {
        regularMarketPrice: number;
        currency: string;
      };
    }> | null;
    error?: { description: string };
  };
}

/** Maps portfolio tickers to Yahoo Finance symbols. Crypto tickers are priced via CoinGecko. */
export function resolveQuoteSymbol(ticker: string, quoteSymbol?: string): string {
  if (quoteSymbol) return quoteSymbol;
  const upper = ticker.toUpperCase();
  if (CRYPTO_CURRENCIES.has(upper)) return upper;
  const hk = /^(\d+)\.HK$/i.exec(ticker);
  if (hk) return `${hk[1].padStart(4, "0")}.HK`;
  return ticker;
}

/** Fetches EUR prices for BTC and/or ETH in a single CoinGecko request. */
async function fetchCryptoRatesToEur(codes: string[]): Promise<Record<string, number>> {
  const needed = [...new Set(codes.map((c) => c.toUpperCase()).filter((c) => CRYPTO_CURRENCIES.has(c)))];
  if (needed.length === 0) return {};

  const ids = needed.map((code) => CRYPTO_IDS[code]).join(",");
  const response = await fetch(`${COINGECKO}?ids=${ids}&vs_currencies=eur`);
  if (!response.ok) throw new Error(`Crypto price lookup failed (${response.status}).`);

  const data = (await response.json()) as Record<string, { eur?: number }>;
  const rates: Record<string, number> = {};
  for (const code of needed) {
    const price = data[CRYPTO_IDS[code]]?.eur;
    if (price === undefined || price <= 0) throw new Error(`No exchange rate available for ${code}.`);
    rates[code] = price;
  }
  return rates;
}

/** Fetches EUR value of one unit for each currency (fiat via Frankfurter, BTC/ETH via Yahoo). */
export async function fetchExchangeRatesToEur(currencies: string[]): Promise<Record<string, number>> {
  const rates: Record<string, number> = { EUR: 1 };
  const foreign = [...new Set(currencies.map((c) => c.toUpperCase()).filter((c) => c !== "EUR"))];
  if (foreign.length === 0) return rates;

  const crypto = foreign.filter((c) => CRYPTO_CURRENCIES.has(c));
  const fiat = foreign.filter((c) => !CRYPTO_CURRENCIES.has(c));

  if (fiat.length > 0) {
    const response = await fetch(`${FRANKFURTER}?base=EUR&symbols=${fiat.join(",")}`);
    if (!response.ok) throw new Error(`Exchange rate lookup failed (${response.status}).`);
    const data = (await response.json()) as { rates: Record<string, number> };

    for (const code of fiat) {
      const unitsPerEur = data.rates[code];
      if (unitsPerEur === undefined || unitsPerEur <= 0) {
        throw new Error(`No exchange rate available for ${code}.`);
      }
      rates[code] = 1 / unitsPerEur;
    }
  }

  const cryptoRates = await fetchCryptoRatesToEur(crypto);
  for (const [code, rate] of Object.entries(cryptoRates)) rates[code] = rate;

  return rates;
}

/** Fetches the latest price and trading currency for a Yahoo Finance symbol. */
export async function fetchYahooQuote(symbol: string): Promise<{ price: number; currency: string }> {
  const params = new URLSearchParams({ interval: "1d", range: "1d" });
  const response = await fetch(`${YAHOO_CHART}/${encodeURIComponent(symbol)}?${params}`);
  if (!response.ok) throw new Error(`Price lookup failed for ${symbol} (${response.status}).`);

  const data = (await response.json()) as YahooChartResponse;
  const meta = data.chart.result?.[0]?.meta;
  if (!meta?.regularMarketPrice || !meta.currency) {
    const detail = data.chart.error?.description ?? "No quote returned.";
    throw new Error(`Price lookup failed for ${symbol}: ${detail}`);
  }
  return { price: meta.regularMarketPrice, currency: meta.currency.toUpperCase() };
}

/** Resolves live prices and FX rates, with optional manual overrides from portfolio.yml. */
export async function fetchMarketSnapshot(
  structure: PortfolioStructure,
  tickers: string[],
  transactionCurrencies: string[],
): Promise<MarketSnapshot> {
  const manualRates = structure.manualRates ?? {};
  const manualPrices = structure.manualPrices ?? {};
  const quoteCurrencies = Object.values(manualPrices).map((p) => p.currency.toUpperCase());

  let exchangeRates = {
    ...(await fetchExchangeRatesToEur([...transactionCurrencies, ...quoteCurrencies])),
    ...manualRates,
  };

  const instruments: Record<string, InstrumentConfig> = {};
  const quoteResults = await Promise.all(
    tickers.map(async (ticker) => {
      const asset = structure.assets[ticker];
      if (!asset) throw new Error(`portfolio.yml is missing assets.${ticker}.`);

      const manual = manualPrices[ticker];
      if (manual) {
        const code = manual.currency.toUpperCase();
        if (exchangeRates[code] === undefined) {
          exchangeRates = { ...exchangeRates, ...(await fetchExchangeRatesToEur([code])) };
        }
        const rate = exchangeRates[code];
        if (rate === undefined) throw new Error(`No exchange rate available for ${code}.`);
        return { ticker, priceEur: manual.value * rate, name: asset.name };
      }

      const upper = ticker.toUpperCase();
      if (CRYPTO_CURRENCIES.has(upper)) {
        if (exchangeRates[upper] === undefined) {
          exchangeRates = { ...exchangeRates, ...(await fetchCryptoRatesToEur([upper])) };
        }
        const rate = exchangeRates[upper];
        if (rate === undefined) throw new Error(`No exchange rate available for ${upper}.`);
        return { ticker, priceEur: rate, name: asset.name ?? ticker };
      }

      const symbol = resolveQuoteSymbol(ticker, asset.quoteSymbol);
      const quote = await fetchYahooQuote(symbol);
      const code = quote.currency.toUpperCase();
      if (exchangeRates[code] === undefined) {
        exchangeRates = { ...exchangeRates, ...(await fetchExchangeRatesToEur([code])) };
      }
      const rate = exchangeRates[code];
      if (rate === undefined) throw new Error(`No exchange rate available for ${quote.currency}.`);
      return { ticker, priceEur: quote.price * rate, name: asset.name ?? ticker };
    }),
  );

  for (const { ticker, priceEur, name } of quoteResults) {
    instruments[ticker] = { name, currentPrice: priceEur };
  }

  return { fetchedAt: new Date(), exchangeRates, instruments };
}

/** Builds a PortfolioConfig from YAML structure and fetched or manual market data. */
export function buildPortfolioConfig(structure: PortfolioStructure, market: MarketSnapshot): PortfolioConfig {
  return {
    currency: structure.currency,
    exchangeRates: market.exchangeRates,
    instruments: market.instruments,
    actionAliases: structure.actionAliases,
  };
}
