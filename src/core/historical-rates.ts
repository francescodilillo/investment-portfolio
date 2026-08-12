/**
 * Historical Exchange Rate Support
 * 
 * This module provides functionality to fetch and use historical exchange rates
 * for accurate cost basis calculations.
 * 
 * The main issue: Using current FX rates for historical transactions causes
 * systematic errors in portfolio valuation. For example:
 * - Bought $10,000 when EUR/USD = 1.10
 * - Today EUR/USD = 1.05
 * - Current code: $10,000 * 1.05 = €9,523.81 (WRONG)
 * - Correct: $10,000 * 1.10 = €9,090.91 (RIGHT)
 * - Error: €433 on this single transaction
 */

import type { PortfolioConfig } from "./types";

const FRANKFURTER_HISTORICAL = "https://api.frankfurter.dev";
const CACHE_PREFIX = "historical-fx:";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CacheEntry<T> { value: T; fetchedAt: number; }

function readCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry<T>;
    if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) return null;
    return entry.value;
  } catch {
    return null;
  }
}

function writeCache<T>(key: string, value: T): void {
  try {
    const entry: CacheEntry<T> = { value, fetchedAt: Date.now() };
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(entry));
  } catch {
    // storage full or unavailable
  }
}

/**
 * Exchange rate data structure: date -> currency -> rate
 * Rate is: 1 unit of currency = X EUR
 * Example: { "2024-01-15": { "USD": 0.91, "GBP": 1.15 } }
 */
export interface HistoricalExchangeRates {
  [date: string]: Record<string, number>;
}

/**
 * Fetches historical exchange rate for a specific date
 * Uses Frankfurter API which provides historical rates
 * 
 * @param date - Date in YYYY-MM-DD format
 * @param currencies - Array of currency codes (USD, GBP, etc.)
 * @returns Record of currency -> rate (1 unit = X EUR)
 */
export async function fetchHistoricalExchangeRate(
  date: string,
  currencies: string[]
): Promise<Record<string, number>> {
  const cacheKey = `fx:${date}:${currencies.sort().join(',')}`;
  const cached = readCache<Record<string, number>>(cacheKey);
  if (cached) return cached;

  const foreign = currencies.filter((c) => c !== "EUR");
  if (foreign.length === 0) return { EUR: 1 };

  try {
    // Frankfurter API format: /YYYY-MM-DD?from=EUR&to=USD,GBP
    const toParam = foreign.join(",");
    const response = await fetch(`${FRANKFURTER_HISTORICAL}/${date}?from=EUR&to=${toParam}`);
    
    if (!response.ok) {
      throw new Error(`Historical FX rate lookup failed for ${date} (${response.status}).`);
    }

    const data = await response.json();
    const rates: Record<string, number> = { EUR: 1 };

    // Frankfurter returns: { rates: { USD: 1.08, GBP: 0.85 } }
    // This means 1 EUR = 1.08 USD, so 1 USD = 1/1.08 EUR
    for (const currency of foreign) {
      const unitsPerEur = data.rates?.[currency];
      if (unitsPerEur === undefined || unitsPerEur <= 0) {
        throw new Error(`No historical exchange rate available for ${currency} on ${date}.`);
      }
      rates[currency] = 1 / unitsPerEur;
    }

    writeCache(cacheKey, rates);
    return rates;
  } catch (error) {
    console.error(`Failed to fetch historical FX rate for ${date}:`, error);
    // Fallback: return empty, caller should handle
    return {};
  }
}

/**
 * Fetches historical exchange rates for multiple dates
 * Optimized to batch requests by date
 */
export async function fetchHistoricalExchangeRates(
  dates: string[],
  currencies: string[]
): Promise<HistoricalExchangeRates> {
  const rates: HistoricalExchangeRates = {};
  
  // Remove duplicates and sort
  const uniqueDates = [...new Set(dates)].sort();
  
  // Fetch rates for each date
  for (const date of uniqueDates) {
    const dateRates = await fetchHistoricalExchangeRate(date, currencies);
    if (Object.keys(dateRates).length > 0) {
      rates[date] = dateRates;
    }
  }
  
  return rates;
}

/**
 * Gets the appropriate exchange rate for a transaction date
 * Falls back to current rate if historical rate is not available
 */
export function getExchangeRateForDate(
  currency: string,
  date: Date,
  historicalRates: HistoricalExchangeRates,
  fallbackRates: Record<string, number>
): number {
  const dateStr = date.toISOString().split('T')[0];
  
  // Try to get historical rate for exact date
  const dateRates = historicalRates[dateStr];
  if (dateRates && dateRates[currency] !== undefined) {
    return dateRates[currency];
  }
  
  // Try to find closest previous date with rates
  const sortedDates = Object.keys(historicalRates).sort();
  for (let i = sortedDates.length - 1; i >= 0; i--) {
    const checkDate = sortedDates[i];
    if (checkDate <= dateStr) {
      const checkRates = historicalRates[checkDate];
      if (checkRates && checkRates[currency] !== undefined) {
        return checkRates[currency];
      }
    }
  }
  
  // Fallback to current rate
  return fallbackRates[currency];
}

/**
 * Enhanced portfolio config with historical rate support
 */
export interface PortfolioConfigWithHistory extends PortfolioConfig {
  historicalExchangeRates: HistoricalExchangeRates;
}

/**
 * Creates an enhanced config with historical rate support
 */
export function createConfigWithHistory(
  config: PortfolioConfig,
  historicalRates: HistoricalExchangeRates
): PortfolioConfigWithHistory {
  return {
    ...config,
    historicalExchangeRates: historicalRates,
  };
}
