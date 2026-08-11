import type { InstrumentConfig, PortfolioConfig } from "./types";
import type { PortfolioStructure } from "./config";

const FRANKFURTER = "https://api.frankfurter.dev/v1/latest";
const YAHOO_CHART = "/api/yahoo/v8/finance/chart";
const COINGECKO = "https://api.coingecko.com/api/v3/simple/price";
const CRYPTO_CURRENCIES = new Set(["BTC", "ETH"]);
const CRYPTO_IDS: Record<string, string> = { BTC: "bitcoin", ETH: "ethereum" };
// const YAHOO_QUOTE = "/api/yahoo/v7/finance/quote";
const TWELVE_DATA_QUOTE = "https://api.twelvedata.com/quote";
const TWELVE_DATA_KEY = import.meta.env.VITE_TWELVEDATA_API_KEY as string | undefined;
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const CACHE_PREFIX = "market-cache:";
const TWELVE_DATA_CHUNK_SIZE = 7;
const TWELVE_DATA_CHUNK_DELAY_MS = 61_000;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

interface CacheEntry<T> { value: T; fetchedAt: number; }

function readCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry<T>;
    if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) return null;
    return entry.value;
  } catch {
    return null; // corrupt or unavailable storage — just refetch
  }
}

function writeCache<T>(key: string, value: T): void {
  try {
    const entry: CacheEntry<T> = { value, fetchedAt: Date.now() };
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(entry));
  } catch {
    // storage full or unavailable — caching is best-effort, not required
  }
}

/** Retries a fetch-like operation on 429 responses with exponential backoff + jitter. */
async function withRetry<T>(fn: () => Promise<T>, retries = 5, delayMs = 1500): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const isRateLimited = error instanceof Error && error.message.includes("(429)");
      if (!isRateLimited || attempt === retries) throw error;
      const jitter = Math.random() * 400;
      await new Promise((resolve) => setTimeout(resolve, delayMs * 2 ** attempt + jitter));
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

async function fetchTwelveDataQuoteChunk(
  symbols: string[],
): Promise<Record<string, { price: number; currency: string }>> {
  return withRetry(async () => {
    const params = new URLSearchParams({
      symbol: symbols.join(","),
      apikey: TWELVE_DATA_KEY!,
    });

    const response = await fetch(`${TWELVE_DATA_QUOTE}?${params}`);
    if (!response.ok) {
      throw new Error(`Batch price lookup failed (${response.status}).`);
    }

    const data = await response.json();

    const quotes: Record<string, TwelveDataQuote> =
      symbols.length === 1 ? { [symbols[0]]: data } : data;

    const out: Record<string, { price: number; currency: string }> = {};

    for (const [symbol, quote] of Object.entries(quotes)) {
      if (quote.status === "error") {
        throw new Error(`Price lookup failed for ${symbol}: ${quote.message}`);
      }

      if (quote.close !== undefined) {
        const currency =
          quote.currency ??
          (symbol.includes("/") ? symbol.split("/")[1] : undefined);

        if (!currency) {
          throw new Error(`No currency available for ${symbol}.`);
        }

        out[symbol] = {
          price: Number(quote.close),
          currency: currency.toUpperCase(),
        };
      }
    }

    return out;
  });
}
/** Fetches quotes for multiple Yahoo symbols in multiple requests of a subset of tickers. */
/* async function fetchYahooQuotesBatch(
  symbols: string[],
): Promise<Record<string, { price: number; currency: string }>> {
  if (symbols.length === 0) return {};

  const quotes: Record<string, { price: number; currency: string }> = {};

  // Keeping batches small is more reliable than one giant request.
  const batches = chunkArray(symbols, 5);

  for (const batch of batches) {
    const partial = await withRetry(async () => {
      const params = new URLSearchParams({
        symbols: batch.join(","),
      });

      const response = await fetch(`${YAHOO_QUOTE}?${params}`);

      if (!response.ok) {
        throw new Error(`Batch price lookup failed (${response.status}).`);
      }

      const data = await response.json() as {
        quoteResponse: {
          result: Array<{
            symbol: string;
            regularMarketPrice?: number;
            currency?: string;
          }>;
        };
      };

      const result: Record<string, { price: number; currency: string }> = {};

      for (const quote of data.quoteResponse.result) {
        if (quote.regularMarketPrice && quote.currency) {
          result[quote.symbol] = {
            price: quote.regularMarketPrice,
            currency: quote.currency.toUpperCase(),
          };
        }
      }

      return result;
    });

    Object.assign(quotes, partial);

    // Small pause to reduce the chance of consecutive 429s.
    await new Promise(resolve => setTimeout(resolve, 250));
  }

  return quotes;
}*/

function toTwelveDataSymbol(ticker: string, quoteSymbol?: string): string {
  if (quoteSymbol) return quoteSymbol;
  const hk = /^(\d+)\.HK$/i.exec(ticker);
  if (hk) return `${hk[1].padStart(4, "0")}:HKEX`;
  return ticker;
}

interface TwelveDataQuote { symbol: string; currency?: string; close?: string; status?: string; message?: string; }

async function fetchTwelveDataQuotesBatch(symbols: string[]): Promise<Record<string, { price: number; currency: string }>> {
  if (symbols.length === 0) return {};
  if (!TWELVE_DATA_KEY) throw new Error("Missing VITE_TWELVEDATA_API_KEY in .env.");

  const cacheKey = `quotes:${[...symbols].sort().join(",")}`;
  const cached = readCache<Record<string, { price: number; currency: string }>>(cacheKey);
  if (cached) return cached;

  const chunks = chunk(symbols, TWELVE_DATA_CHUNK_SIZE);
  const result: Record<string, { price: number; currency: string }> = {};

  for (let i = 0; i < chunks.length; i++) {
    Object.assign(result, await fetchTwelveDataQuoteChunk(chunks[i]));
    if (i < chunks.length - 1) await new Promise((resolve) => setTimeout(resolve, TWELVE_DATA_CHUNK_DELAY_MS));
  }

  writeCache(cacheKey, result);
  return result;
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
  /*  const symbolToTicker = new Map<string, string>();
    for (const ticker of yahooTickers) {
      const asset = structure.assets[ticker];
      const symbol = resolveQuoteSymbol(ticker, asset.quoteSymbol);
      symbolToTicker.set(symbol, ticker);
    }

    const quotes = await fetchYahooQuotesBatch([...symbolToTicker.keys()]); */
// Build mapping: Twelve Data symbol -> one or more portfolio tickers.
    const symbolToTickers = new Map<string, string[]>();

    for (const ticker of yahooTickers) {
      const asset = structure.assets[ticker];
      const symbol = toTwelveDataSymbol(ticker, asset.quoteSymbol);

      const tickers = symbolToTickers.get(symbol);
      if (tickers) {
        tickers.push(ticker);
      } else {
        symbolToTickers.set(symbol, [ticker]);
      }
    }

    // Fetch each unique quote only once.
    const quotes = await fetchTwelveDataQuotesBatch([...symbolToTickers.keys()]);

    for (const [symbol, tickers] of symbolToTickers) {
      const quote = quotes[symbol];

      if (!quote) {
        throw new Error(`Price lookup failed for ${symbol}: no quote returned.`);
      }

      const code = quote.currency.toUpperCase();

      if (exchangeRates[code] === undefined) {
        exchangeRates = {
          ...exchangeRates,
          ...(await fetchExchangeRatesToEur([code])),
        };
      }

      const rate = exchangeRates[code];

      if (rate === undefined) {
        throw new Error(`No exchange rate available for ${quote.currency}.`);
      }

      // Apply the same fetched quote to every portfolio asset using this symbol.
      for (const ticker of tickers) {
        const asset = structure.assets[ticker];

        instruments[ticker] = {
          name: asset.name ?? ticker,
          currentPrice: quote.price * rate,
        };
      }
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