import { parse } from "yaml";
import type { InstrumentConfig, PortfolioConfig, TransactionAction } from "./types";

export interface AssetConfig {
  name?: string;
  quoteSymbol?: string;
  [key: string]: unknown;
}

export interface PortfolioStructure {
  currency: string;
  assets: Record<string, AssetConfig>;
  manualPrices?: Record<string, { value: number; currency: string }>;
  manualRates?: Record<string, number>;
  actionAliases?: Record<string, TransactionAction>;
}

/** Parses portfolio.yml assets and optional manual price or rate overrides. */
export function parsePortfolioStructure(source: string): PortfolioStructure {
  const raw = parse(source) as Record<string, unknown>;
  if (!record(raw) || !record(raw.portfolio)) {
    throw new Error("portfolio.yml must contain a portfolio mapping.");
  }

  const currency = text(raw.portfolio.base_currency, "portfolio.base_currency").toUpperCase();
  if (!record(raw.assets)) throw new Error("portfolio.yml must contain an assets mapping.");

  const assets: Record<string, AssetConfig> = {};
  for (const [ticker, asset] of Object.entries(raw.assets)) {
    if (!record(asset)) throw new Error(`assets.${ticker} must be a mapping.`);
    assets[ticker.toUpperCase()] = {
      name: typeof asset.name === "string" ? asset.name : undefined,
      quoteSymbol: typeof asset.quote_symbol === "string" ? asset.quote_symbol : undefined,
      ...asset,
    };
  }

  let manualRates: Record<string, number> | undefined;
  if (raw.exchange_rates !== undefined) {
    if (!record(raw.exchange_rates)) throw new Error("exchange_rates must be a mapping.");
    manualRates = { [currency]: 1 };
    for (const [code, value] of Object.entries(raw.exchange_rates)) {
      const rate = num(value, `exchange_rates.${code}`);
      if (rate <= 0) throw new Error(`exchange_rates.${code} must be positive.`);
      manualRates[code.toUpperCase()] = rate;
    }
  }

  let manualPrices: Record<string, { value: number; currency: string }> | undefined;
  if (raw.current_prices !== undefined) {
    if (!record(raw.current_prices)) throw new Error("current_prices must be a mapping.");
    manualPrices = {};
    for (const [ticker, price] of Object.entries(raw.current_prices)) {
      if (!record(price)) throw new Error(`current_prices.${ticker} must be a mapping.`);
      manualPrices[ticker.toUpperCase()] = {
        value: num(price.value, `current_prices.${ticker}.value`),
        currency: text(price.currency, `current_prices.${ticker}.currency`).toUpperCase(),
      };
    }
  }

  return { currency, assets, manualPrices, manualRates, actionAliases: undefined };
}

/** Parses portfolio.yml with embedded prices and rates (legacy / fully manual mode). */
export function parsePortfolioConfig(source: string): PortfolioConfig {
  const structure = parsePortfolioStructure(source);
  if (!structure.manualPrices) {
    throw new Error("portfolio.yml must contain current_prices, or use live market data fetching.");
  }

  const rates: Record<string, number> = { [structure.currency]: 1, ...structure.manualRates };
  const instruments: Record<string, InstrumentConfig> = {};

  for (const [ticker, asset] of Object.entries(structure.assets)) {
    const price = structure.manualPrices[ticker];
    if (!price) {
      throw new Error(`current_prices.${ticker} is required when not using live market data.`);
    }
    const code = price.currency;
    const rate = rates[code];
    if (rate === undefined) throw new Error(`An exchange_rates.${code} value is required.`);
    instruments[ticker] = {
      name: asset.name ?? ticker,
      currentPrice: price.value * rate,
    };
  }

  return {
    currency: structure.currency,
    instruments,
    exchangeRates: rates,
    actionAliases: structure.actionAliases,
  };
}

function record(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function text(v: unknown, field: string): string {
  if (typeof v !== "string" || !v.trim()) throw new Error(`${field} must be a non-empty string.`);
  return v.trim();
}

function num(v: unknown, field: string): number {
  if (typeof v !== "number" || !Number.isFinite(v)) throw new Error(`${field} must be a finite number.`);
  return v;
}
