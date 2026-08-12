/**
 * Parser with Historical FX Rate Support
 * 
 * This is an enhanced version of parser.ts that uses historical exchange rates
 * for accurate cost basis calculations.
 * 
 * Usage:
 *   import { parseTransactionsCsvWithHistory } from './parser-historical';
 *   
 *   const config = await buildConfigWithHistoricalRates(portfolioStructure, transactions);
 *   const transactions = parseTransactionsCsvWithHistory(csv, config);
 */

import type { NormalizedTransaction, PortfolioConfig, TransactionAction } from "./types";
import { getExchangeRateForDate, type HistoricalExchangeRates } from "./historical-rates";

const C = ["symbol", "date", "quantity", "price", "pricecurrency", "feespercentage", "feesamount", "feescurrency"] as const;

/**
 * Extended portfolio config with historical rate support
 */
export interface PortfolioConfigWithHistory extends PortfolioConfig {
  historicalExchangeRates: HistoricalExchangeRates;
}

/**
 * Scans a CSV for tickers and currencies before market data is available.
 * (Same as original parser.ts)
 */
export function scanTransactionsCsv(source: string): { tickers: string[]; currencies: string[] } {
  const rows = parseCsv(source);
  if (rows.length < 2) throw new Error("The CSV must contain a header row and at least one transaction.");
  
  const h = rows[0].map(x => x.trim().toLowerCase().replace(/[^a-z0-9]/g, ""));
  const i = {} as Record<(typeof C)[number], number>;
  for (const c of C) {
    const n = h.indexOf(c);
    if (n < 0) throw new Error(`CSV is missing required column: ${c}.`);
    i[c] = n;
  }
  
  const tickers = new Set<string>();
  const currencies = new Set<string>();
  
  for (const r of rows.slice(1).filter(r => r.some(x => x.trim()))) {
    const g = (c: keyof typeof i) => r[i[c]]?.trim() ?? "";
    tickers.add(g("symbol").toUpperCase());
    currencies.add(g("pricecurrency").toUpperCase());
    currencies.add(g("feescurrency").toUpperCase());
  }
  
  return { tickers: [...tickers], currencies: [...currencies] };
}

/**
 * Parses the broker-export CSV, converting amounts with HISTORICAL exchange-rate assumptions.
 * 
 * This is the key fix: it uses the exchange rate from the transaction date,
 * not the current exchange rate.
 */
export function parseTransactionsCsvWithHistory(
  source: string,
  config: PortfolioConfigWithHistory
): NormalizedTransaction[] {
  const rows = parseCsv(source);
  if (rows.length < 2) throw new Error("The CSV must contain a header row and at least one transaction.");
  
  const h = rows[0].map(x => x.trim().toLowerCase().replace(/[^a-z0-9]/g, ""));
  const i = {} as Record<(typeof C)[number], number>;
  for (const c of C) {
    const n = h.indexOf(c);
    if (n < 0) throw new Error(`CSV is missing required column: ${c}.`);
    i[c] = n;
  }
  
  return rows.slice(1).filter(r => r.some(x => x.trim())).map((r, n) => {
    const line = n + 2;
    const g = (c: keyof typeof i) => r[i[c]]?.trim() ?? "";
    const q = number(g("quantity"), line, "quantity");
    if (!q) throw new Error(`Row ${line}: quantity cannot be zero.`);
    
    const pc = g("pricecurrency").toUpperCase();
    const fc = g("feescurrency").toUpperCase();
    const date = new Date(g("date").split("/").reverse().join("-") + "T00:00:00");
    if (Number.isNaN(date.getTime())) throw new Error(`Row ${line}: invalid date.`);
    
    // Get HISTORICAL exchange rates for this transaction date
    const pr = getExchangeRateForDate(pc, date, config.historicalExchangeRates, config.exchangeRates);
    const fr = getExchangeRateForDate(fc, date, config.historicalExchangeRates, config.exchangeRates);
    
    if (pr === undefined) {
      throw new Error(`Row ${line}: no exchange rate available for ${pc} on ${date.toISOString().split('T')[0]}. Add it to portfolio.yml or provide historical rates.`);
    }
    if (fr === undefined) {
      throw new Error(`Row ${line}: no exchange rate available for ${fc} on ${date.toISOString().split('T')[0]}. Add it to portfolio.yml or provide historical rates.`);
    }
    
    const ticker = g("symbol").toUpperCase();
    
    // Log for debugging
    if (pc !== config.currency) {
      console.log(`[HISTORICAL FX] ${date.toISOString().split('T')[0]}: ${ticker} ${q} @ ${g("price")} ${pc} = €${(q * number(g("price"), line, "price") * pr).toFixed(2)} (rate: ${pr})`);
    }
    
    return {
      id: `transaction-${line}`,
      date,
      ticker,
      name: config.instruments[ticker]?.name ?? ticker,
      action: (q > 0 ? "BUY" : "SELL") as TransactionAction,
      quantity: Math.abs(q),
      price: number(g("price"), line, "price") * pr,
      fees: number(g("feesamount"), line, "fees amount") * fr,
      currency: config.currency,
      broker: "",
    };
  }).sort((a, b) => a.date.getTime() - b.date.getTime());
}

/**
 * Original parser for backward compatibility
 * Uses current exchange rates (incorrect for historical accuracy)
 */
export function parseTransactionsCsv(
  source: string,
  config: PortfolioConfig
): NormalizedTransaction[] {
  const rows = parseCsv(source);
  if (rows.length < 2) throw new Error("The CSV must contain a header row and at least one transaction.");
  
  const h = rows[0].map(x => x.trim().toLowerCase().replace(/[^a-z0-9]/g, ""));
  const i = {} as Record<(typeof C)[number], number>;
  for (const c of C) {
    const n = h.indexOf(c);
    if (n < 0) throw new Error(`CSV is missing required column: ${c}.`);
    i[c] = n;
  }
  
  return rows.slice(1).filter(r => r.some(x => x.trim())).map((r, n) => {
    const line = n + 2;
    const g = (c: keyof typeof i) => r[i[c]]?.trim() ?? "";
    const q = number(g("quantity"), line, "quantity");
    if (!q) throw new Error(`Row ${line}: quantity cannot be zero.`);
    
    const pc = g("pricecurrency").toUpperCase();
    const fc = g("feescurrency").toUpperCase();
    const pr = config.exchangeRates[pc];
    const fr = config.exchangeRates[fc];
    
    if (pr === undefined || fr === undefined) {
      throw new Error(`Row ${line}: add an exchange_rates value for ${pr === undefined ? pc : fc} in portfolio.yml.`);
    }
    
    const ticker = g("symbol").toUpperCase();
    const date = new Date(g("date").split("/").reverse().join("-") + "T00:00:00");
    if (Number.isNaN(date.getTime())) throw new Error(`Row ${line}: invalid date.`);
    
    return {
      id: `transaction-${line}`,
      date,
      ticker,
      name: config.instruments[ticker]?.name ?? ticker,
      action: (q > 0 ? "BUY" : "SELL") as TransactionAction,
      quantity: Math.abs(q),
      price: number(g("price"), line, "price") * pr,
      fees: number(g("feesamount"), line, "fees amount") * fr,
      currency: config.currency,
      broker: "",
    };
  }).sort((a, b) => a.date.getTime() - b.date.getTime());
}

/**
 * Converts CSV text into rows while supporting quoted values and comma or semicolon delimiters.
 */
export function parseCsv(s: string): string[][] {
  const d = s.split("\n")[0]?.includes(";") ? ";" : ",";
  const out: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let x = 0; x < s.length; x++) {
    const c = s[x];
    if (c === '"') {
      if (quoted && s[x + 1] === '"') {
        cell += '"';
        x++;
      } else quoted = !quoted;
    } else if (c === d && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && s[x + 1] === "\n") x++;
      row.push(cell);
      out.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }

  if (quoted) throw new Error("The CSV contains an unclosed quoted field.");
  if (cell || row.length) {
    row.push(cell);
    out.push(row);
  }
  return out;
}

function number(v: string, line: number, f: string): number {
  const n = Number(v.replace(/\s/g, "").replace(/,(?=\d{1,2}$)/, "."));
  if (!Number.isFinite(n)) throw new Error(`Row ${line}: ${f} must be numeric.`);
  return n;
}
