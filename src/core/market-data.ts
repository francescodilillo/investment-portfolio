import type { InstrumentConfig, PortfolioConfig } from "./types";
import type { PortfolioStructure } from "./config";

const FRANKFURTER = "https://api.frankfurter.dev/v1/latest";
const YAHOO_CHART = "/api/yahoo/v8/finance/chart";
const COINGECKO = "https://api.coingecko.com/api/v3/simple/price";
const CRYPTO_CURRENCIES = new Set(["BTC", "ETH"]);
const CRYPTO_IDS: Record<string, string> = { BTC: "bitcoin", ETH: "ethereum" };
const YAHOO_QUOTE = "/api/yahoo/v7/finance/quote";

/** Retries a fetch-like operation on 429 responses with exponential backoff. */
async function withRetry<T>(fn: () => Promise<T>, retries = 3, delayMs = 800): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const isRateLimited = error instanceof Error && error.message.includes("(429)");
      if (!isRateLimited || attempt === retries) throw error;
      await new Promise((resolve) => setTimeout(resolve, delayMs * (attempt + 1)));
    }
  }
  throw new Error("Unreachable");
}

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

/** Fetches quotes for multiple Yahoo symbols in a single request to avoid per-ticker rate limits. */
async function fetchYahooQuotesBatch(symbols: string[]): Promise<Record<string, { price: number; currency: string }>> {
  if (symbols.length === 0) return {};
  return withRetry(async () => {
    const params = new URLSearchParams({ symbols: symbols.join(",") });
    const response = await fetch(`${YAHOO_QUOTE}?${params}`);
    if (!response.ok) throw new Error(`Batch price lookup failed (${response.status}).`);

    const data = (await response.json()) as {
      quoteResponse: { result: Array<{ symbol: string; regularMarketPrice?: number; currency?: string }>; error?: unknown };
    };
    const result: Record<string, { price: number; currency: string }> = {};
    for (const quote of data.quoteResponse.result) {
      if (quote.regularMarketPrice && quote.currency) {
        result[quote.symbol] = { price: quote.regularMarketPrice, currency: quote.currency.toUpperCase() };
      }
    }
    return result;
  });
}

/** Fetches the latest price and trading currency for a Yahoo Finance symbol. */
export async function fetchYahooQuote(symbol: string): Promise<{ price: number; currency: string }> {
  return withRetry(async () => {
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
  });
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

  // Validate all tickers have asset entries up front.
  for (const ticker of tickers) {
    if (!structure.assets[ticker]) throw new Error(`portfolio.yml is missing assets.${ticker}.`);
  }

  // Split tickers into manual-priced, crypto, and Yahoo-quoted groups.
  const manualTickers = tickers.filter((t) => manualPrices[t]);
  const cryptoTickers = tickers.filter((t) => !manualPrices[t] && CRYPTO_CURRENCIES.has(t.toUpperCase()));
  const yahooTickers = tickers.filter((t) => !manualPrices[t] && !CRYPTO_CURRENCIES.has(t.toUpperCase()));

  // Manual prices: just convert using existing/fetched rates.
  for (const ticker of manualTickers) {
    const asset = structure.assets[ticker];
    const manual = manualPrices[ticker];
    const code = manual.currency.toUpperCase();
    if (exchangeRates[code] === undefined) {
      exchangeRates = { ...exchangeRates, ...(await fetchExchangeRatesToEur([code])) };
    }
    const rate = exchangeRates[code];
    if (rate === undefined) throw new Error(`No exchange rate available for ${code}.`);
    instruments[ticker] = { name: asset.name, currentPrice: manual.value * rate };
  }

  // Crypto: fetch all needed crypto rates in one CoinGecko call.
  if (cryptoTickers.length > 0) {
    const upperCryptoTickers = cryptoTickers.map((t) => t.toUpperCase());
    const missing = upperCryptoTickers.filter((c) => exchangeRates[c] === undefined);
    if (missing.length > 0) {
      exchangeRates = { ...exchangeRates, ...(await fetchCryptoRatesToEur(missing)) };
    }
    for (const ticker of cryptoTickers) {
      const asset = structure.assets[ticker];
      const upper = ticker.toUpperCase();
      const rate = exchangeRates[upper];
      if (rate === undefined) throw new Error(`No exchange rate available for ${upper}.`);
      instruments[ticker] = { name: asset.name ?? ticker, currentPrice: rate };
    }
  }

  // Yahoo: resolve symbols and fetch all quotes in a single batched request.
  if (yahooTickers.length > 0) {
    const symbolToTicker = new Map<string, string>();
    for (const ticker of yahooTickers) {
      const asset = structure.assets[ticker];
      const symbol = resolveQuoteSymbol(ticker, asset.quoteSymbol);
      symbolToTicker.set(symbol, ticker);
    }

    const quotes = await fetchYahooQuotesBatch([...symbolToTicker.keys()]);

    for (const [symbol, ticker] of symbolToTicker) {
      const quote = quotes[symbol];
      if (!quote) throw new Error(`Price lookup failed for ${symbol}: no quote returned.`);
      const asset = structure.assets[ticker];
      const code = quote.currency.toUpperCase();
      if (exchangeRates[code] === undefined) {
        exchangeRates = { ...exchangeRates, ...(await fetchExchangeRatesToEur([code])) };
      }
      const rate = exchangeRates[code];
      if (rate === undefined) throw new Error(`No exchange rate available for ${quote.currency}.`);
      instruments[ticker] = { name: asset.name ?? ticker, currentPrice: quote.price * rate };
    }
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