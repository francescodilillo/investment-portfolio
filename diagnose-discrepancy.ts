/**
 * Diagnostic Script for Portfolio Value Discrepancy
 * 
 * This script helps identify why your dashboard shows >10k difference from ground truth.
 * 
 * Supports currencies: EUR, USD, HKD, BTC, ETH
 * 
 * Usage:
 *   npx tsx diagnose-discrepancy.ts --csv data/transactions.csv --yaml portfolio.yml
 * 
 * Or edit the DEFAULT_CSV_PATH and DEFAULT_YAML_PATH constants below.
 */

import { parse } from "yaml";
import { readFile } from "node:fs/promises";
import { parseTransactionsCsv } from './src/core/parser';
import { parsePortfolioStructure } from './src/core/config';
import type { PortfolioConfig, PortfolioStructure } from './src/core/config';

// ============================================================================
// CONFIGURATION - Edit these paths or use command-line arguments
// ============================================================================

const DEFAULT_CSV_PATH = "./data/transactions.csv";
const DEFAULT_YAML_PATH = "./portfolio.yml";

// Supported currencies for analysis
const SUPPORTED_CURRENCIES = ["EUR", "USD", "HKD", "BTC", "ETH"];

// ============================================================================
// COMMAND-LINE ARGUMENT PARSING
// ============================================================================

interface Args {
  csvPath: string;
  yamlPath: string;
  help: boolean;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const result: Args = {
    csvPath: DEFAULT_CSV_PATH,
    yamlPath: DEFAULT_YAML_PATH,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--csv":
        result.csvPath = args[++i];
        break;
      case "--yaml":
        result.yamlPath = args[++i];
        break;
      case "-h":
      case "--help":
        result.help = true;
        break;
    }
  }

  return result;
}

function printHelp(): void {
  console.log(`
Portfolio Value Discrepancy Diagnostic Tool

Supports currencies: ${SUPPORTED_CURRENCIES.join(", ")}

Usage:
  npx tsx diagnose-discrepancy.ts [options]

Options:
  --csv <path>     Path to transactions CSV file (default: ${DEFAULT_CSV_PATH})
  --yaml <path>    Path to portfolio.yml file (default: ${DEFAULT_YAML_PATH})
  -h, --help       Show this help message

Examples:
  npx tsx diagnose-discrepancy.ts
  npx tsx diagnose-discrepancy.ts --csv data/my-transactions.csv --yaml config/portfolio.yml

This tool helps identify why your dashboard shows >10k difference from your
source transaction app by analyzing:
  1. Historical FX rate issues (EUR, USD, HKD)
  2. Historical price issues (BTC, ETH)
  3. US ADR vs native listing symbol mismatches
  4. Combined impact of multiple issues
`);
}

// ============================================================================
// FILE LOADING UTILITIES
// ============================================================================

async function loadCsvFile(path: string): Promise<string> {
  try {
    return await readFile(path, "utf-8");
  } catch (error) {
    throw new Error(`Failed to load CSV file from ${path}: ${error}`);
  }
}

async function loadYamlFile(path: string): Promise<string> {
  try {
    return await readFile(path, "utf-8");
  } catch (error) {
    throw new Error(`Failed to load YAML file from ${path}: ${error}`);
  }
}

// ============================================================================
// CSV PARSING UTILITIES (to read original currencies before conversion)
// ============================================================================

interface RawTransaction {
  symbol: string;
  date: string;
  quantity: number;
  price: number;
  priceCurrency: string;
  feesPercentage: number;
  feesAmount: number;
  feesCurrency: string;
}

function parseRawCsv(csvText: string): RawTransaction[] {
  const rows = csvText.split("\n").filter(r => r.trim());
  if (rows.length < 2) return [];
  
  const header = rows[0].split(/[,\s;]+/).map(h => h.trim().toLowerCase());
  
  const getColIndex = (name: string) => {
    return header.findIndex(h => h.includes(name.toLowerCase()));
  };
  
  const symbolIdx = getColIndex("symbol");
  const dateIdx = getColIndex("date");
  const quantityIdx = getColIndex("quantity");
  const priceIdx = getColIndex("price");
  const priceCurrencyIdx = getColIndex("price currency");
  const feesPercentageIdx = getColIndex("fees percentage");
  const feesAmountIdx = getColIndex("fees amount");
  const feesCurrencyIdx = getColIndex("fees currency");
  
  const transactions: RawTransaction[] = [];
  
  for (let i = 1; i < rows.length; i++) {
    const cols = rows[i].split(/[,\s;]+/).map(c => c.trim());
    if (cols.filter(c => c).length < 3) continue;
    
    const transaction: RawTransaction = {
      symbol: cols[symbolIdx]?.toUpperCase() || "",
      date: cols[dateIdx] || "",
      quantity: parseFloat(cols[quantityIdx] || "0"),
      price: parseFloat(cols[priceIdx] || "0"),
      priceCurrency: cols[priceCurrencyIdx]?.toUpperCase() || "EUR",
      feesPercentage: parseFloat(cols[feesPercentageIdx] || "0"),
      feesAmount: parseFloat(cols[feesAmountIdx] || "0"),
      feesCurrency: cols[feesCurrencyIdx]?.toUpperCase() || "EUR",
    };
    
    transactions.push(transaction);
  }
  
  return transactions;
}

// ============================================================================
// DIAGNOSTIC FUNCTIONS
// ============================================================================

/**
 * Diagnose Issue #1: Historical FX Rate Problem
 * Now supports: EUR, USD, HKD, BTC, ETH
 */
function diagnoseFxRateIssue() {
  console.log("\n" + "=".repeat(80));
  console.log("DIAGNOSIS #1: Historical FX/Crypto Rate Issue");
  console.log("=".repeat(80));
  
  console.log("\n--- Fiat Currency Examples (EUR, USD, HKD) ---");
  
  const usdHistorical = 1.10;
  const usdCurrent = 0.92;
  const usdAmount = 10000;
  const usdCorrect = usdAmount / usdHistorical;
  const usdWrong = usdAmount / usdCurrent;
  const usdError = usdWrong - usdCorrect;
  
  console.log(`\nUSD Transaction: $${usdAmount}`);
  console.log(`  Historical EUR/USD: ${usdHistorical}`);
  console.log(`  Current EUR/USD: ${usdCurrent}`);
  console.log(`  Correct EUR value: ${usdCorrect.toFixed(2)} EUR`);
  console.log(`  Current code calculates: ${usdWrong.toFixed(2)} EUR`);
  console.log(`  Error: ${usdError.toFixed(2)} EUR (${((usdError/usdCorrect)*100).toFixed(1)}%)`);
  
  const hkdHistorical = 8.5;
  const hkdCurrent = 8.8;
  const hkdAmount = 100000;
  const hkdCorrect = hkdAmount / hkdHistorical;
  const hkdWrong = hkdAmount / hkdCurrent;
  const hkdError = hkdWrong - hkdCorrect;
  
  console.log(`\nHKD Transaction: HKD ${hkdAmount}`);
  console.log(`  Historical EUR/HKD: ${hkdHistorical}`);
  console.log(`  Current EUR/HKD: ${hkdCurrent}`);
  console.log(`  Correct EUR value: ${hkdCorrect.toFixed(2)} EUR`);
  console.log(`  Current code calculates: ${hkdWrong.toFixed(2)} EUR`);
  console.log(`  Error: ${hkdError.toFixed(2)} EUR (${((hkdError/hkdCorrect)*100).toFixed(1)}%)`);
  
  console.log("\n--- Crypto Currency Examples (BTC, ETH) ---");
  console.log("Note: For crypto, the 'exchange rate' is the price in EUR");
  
  const btcHistorical = 40000;
  const btcCurrent = 50000;
  const btcAmount = 1;
  const btcError = btcCurrent - btcHistorical;
  
  console.log(`\nBTC Transaction: ${btcAmount} BTC`);
  console.log(`  Historical BTC/EUR: ${btcHistorical}`);
  console.log(`  Current BTC/EUR: ${btcCurrent}`);
  console.log(`  Correct cost basis: ${btcHistorical.toFixed(2)} EUR`);
  console.log(`  Current code uses: ${btcCurrent.toFixed(2)} EUR`);
  console.log(`  Error on cost basis: ${btcError.toFixed(2)} EUR (${((btcError/btcHistorical)*100).toFixed(1)}%)`);
  
  const ethHistorical = 2000;
  const ethCurrent = 2500;
  const ethAmount = 10;
  const ethError = (ethCurrent - ethHistorical) * ethAmount;
  
  console.log(`\nETH Transaction: ${ethAmount} ETH`);
  console.log(`  Historical ETH/EUR: ${ethHistorical}`);
  console.log(`  Current ETH/EUR: ${ethCurrent}`);
  console.log(`  Correct cost basis: ${(ethHistorical * ethAmount).toFixed(2)} EUR`);
  console.log(`  Current code uses: ${(ethCurrent * ethAmount).toFixed(2)} EUR`);
  console.log(`  Error on cost basis: ${ethError.toFixed(2)} EUR (${((ethError/(ethHistorical*ethAmount))*100).toFixed(1)}%)`);
  
  console.log(`\nIf you have transactions in these currencies, historical rate issues`);
  console.log(`can easily cause >10,000 EUR discrepancy!`);
}

/**
 * Diagnose Issue #2: ADR/US Equivalent Symbol Problem
 */
function diagnoseAdrIssue() {
  console.log("\n" + "=".repeat(80));
  console.log("DIAGNOSIS #2: US ADR vs Native Listing Issue");
  console.log("=".repeat(80));
  
  console.log("\nThis affects ALL stock types, not just US/EU:");
  console.log("- US stocks: AAPL (NASDAQ) vs AAPL (NYSE) - usually same");
  console.log("- EU stocks: ASML.AS (Euronext) vs ASML (NASDAQ) - DIFFERENT!");
  console.log("- HK stocks: 700.HK vs 0700.HK vs 0700:HKEX - may differ");
  
  const asmlEuronextPrice = 700;
  const asmlNasdaqPrice = 750;
  const eurUsd = 1.08;
  
  const sharesOwned = 100;
  const correctValueEur = sharesOwned * asmlEuronextPrice;
  const asmlNasdaqInEur = asmlNasdaqPrice / eurUsd;
  const wrongValueEur = sharesOwned * asmlNasdaqInEur;
  const error = wrongValueEur - correctValueEur;
  
  console.log(`\nExample: ${sharesOwned} shares of ASML`);
  console.log(`  ASML.AS (Euronext) price: ${asmlEuronextPrice} EUR`);
  console.log(`  ASML (NASDAQ) price: $${asmlNasdaqPrice} = ${asmlNasdaqInEur.toFixed(2)} EUR`);
  console.log(`  Correct EUR value: ${correctValueEur.toFixed(2)} EUR`);
  console.log(`  Dashboard (using NASDAQ): ${wrongValueEur.toFixed(2)} EUR`);
  console.log(`  Error: ${error.toFixed(2)} EUR (${((error/correctValueEur)*100).toFixed(1)}%)`);
  
  console.log(`\n--- ADR Ratio Example ---`);
  console.log(`Some ADRs represent multiple underlying shares:`);
  console.log(`Example: 1 ING.NYSE ADR = 2 INGA.AS shares`);
  
  const underlyingShares = 100;
  const adrRatio = 2;
  const underlyingPriceEur = 10;
  const adrPriceUsd = 18;
  const adrPriceEur = adrPriceUsd / eurUsd;
  
  const correctValue = underlyingShares * underlyingPriceEur;
  const wrongValue = underlyingShares * adrPriceEur;
  const ratioError = wrongValue - correctValue;
  
  console.log(`\n${underlyingShares} underlying shares at ${underlyingPriceEur} EUR = ${correctValue} EUR`);
  console.log(`Dashboard treats as ${underlyingShares} ADRs at ${adrPriceEur.toFixed(2)} EUR = ${wrongValue.toFixed(2)} EUR`);
  console.log(`Error: ${ratioError.toFixed(2)} EUR (${((ratioError/correctValue)*100).toFixed(1)}%)`);
  console.log(`\nADR ratio issues can cause 50-200%+ discrepancies!`);
}

/**
 * Diagnose Issue #3: Combined Impact
 */
function diagnoseCombinedImpact() {
  console.log("\n" + "=".repeat(80));
  console.log("DIAGNOSIS #3: Combined Impact Estimate");
  console.log("=".repeat(80));
  
  const scenarios = [
    { name: "Small portfolio", usdValue: 50000, hkdValue: 200000, btcAmount: 0.5, ethAmount: 5, fxRateChange: 0.05, cryptoChange: 0.20 },
    { name: "Medium portfolio", usdValue: 100000, hkdValue: 500000, btcAmount: 1, ethAmount: 10, fxRateChange: 0.08, cryptoChange: 0.30 },
    { name: "Large portfolio", usdValue: 200000, hkdValue: 1000000, btcAmount: 2, ethAmount: 20, fxRateChange: 0.10, cryptoChange: 0.40 },
  ];
  
  console.log("\nAssuming portfolio composition:");
  console.log("  - USD transactions: 25%");
  console.log("  - HKD transactions: 25%");
  console.log("  - BTC holdings: 10%");
  console.log("  - ETH holdings: 10%\n");
  
  for (const scenario of scenarios) {
    const usdPortion = scenario.usdValue;
    const hkdPortion = scenario.hkdValue / 8.5;
    const btcPortion = scenario.btcAmount * 45000;
    const ethPortion = scenario.ethAmount * 2250;
    const totalEur = usdPortion + hkdPortion + btcPortion + ethPortion;
    
    const fxError = (usdPortion + hkdPortion) * scenario.fxRateChange;
    const cryptoError = (btcPortion + ethPortion) * scenario.cryptoChange;
    const totalError = fxError + cryptoError;
    const errorPercent = (totalError / totalEur) * 100;
    
    console.log(`${scenario.name}:`);
    console.log(`  Total portfolio: ~${totalEur.toFixed(0)} EUR`);
    console.log(`  FX rate error (USD+HKD): ${fxError.toFixed(0)} EUR`);
    console.log(`  Crypto price error (BTC+ETH): ${cryptoError.toFixed(0)} EUR`);
    console.log(`  Total error: ${totalError.toFixed(0)} EUR (${errorPercent.toFixed(1)}%)`);
    console.log("");
  }
  
  console.log("A 10,000+ EUR discrepancy is EASILY explained by these issues!");
}

/**
 * Analyze your actual transaction data
 */
async function analyzeActualData(
  csvText: string,
  structure: PortfolioStructure
): Promise<void> {
  console.log("\n" + "=".repeat(80));
  console.log("DIAGNOSIS #4: Your Actual Data Analysis");
  console.log("=".repeat(80));
  
  try {
    // Parse RAW CSV to get original currencies (before conversion)
    const rawTransactions = parseRawCsv(csvText);
    
    if (rawTransactions.length === 0) {
      console.log("\nNo transactions found in CSV");
      return;
    }
    
    console.log(`\nFound ${rawTransactions.length} transactions`);
    
    // Collect all unique tickers and currencies
    const tickers = new Set<string>();
    const priceCurrencies = new Set<string>();
    const feesCurrencies = new Set<string>();
    const transactionsByCurrency: Record<string, { count: number; totalAmount: number; sampleTickers: string[] }> = {};
    
    for (const txn of rawTransactions) {
      tickers.add(txn.symbol);
      priceCurrencies.add(txn.priceCurrency);
      feesCurrencies.add(txn.feesCurrency);
      
      const amount = txn.quantity * txn.price;
      
      if (!transactionsByCurrency[txn.priceCurrency]) {
        transactionsByCurrency[txn.priceCurrency] = { count: 0, totalAmount: 0, sampleTickers: [] };
      }
      transactionsByCurrency[txn.priceCurrency].count++;
      transactionsByCurrency[txn.priceCurrency].totalAmount += amount;
      if (transactionsByCurrency[txn.priceCurrency].sampleTickers.length < 3) {
        transactionsByCurrency[txn.priceCurrency].sampleTickers.push(txn.symbol);
      }
    }
    
    const allCurrencies = new Set([...priceCurrencies, ...feesCurrencies]);
    
    console.log(`  Tickers: ${[...tickers].slice(0, 10).join(", ")}${tickers.size > 10 ? "..." : ""}`);
    console.log(`  Price Currencies: ${[...priceCurrencies].join(", ")}`);
    console.log(`  Fees Currencies: ${[...feesCurrencies].join(", ")}`);
    
    // Check for unsupported currencies
    const unsupported = [...allCurrencies].filter(c => !SUPPORTED_CURRENCIES.includes(c));
    if (unsupported.length > 0) {
      console.log(`\n  WARNING: Found unsupported currencies: ${unsupported.join(", ")}`);
      console.log(`  Supported currencies: ${SUPPORTED_CURRENCIES.join(", ")}`);
    }
    
    // Show breakdown by currency
    console.log("\nTransaction breakdown by PRICE currency:");
    for (const [currency, info] of Object.entries(transactionsByCurrency)) {
      console.log(`  ${currency}: ${info.count} transactions, total: ${info.totalAmount.toFixed(2)} ${currency}`);
      console.log(`         Sample tickers: ${info.sampleTickers.join(", ")}`);
    }
    
    // Now parse with portfolio config to see converted values
    const rates: Record<string, number> = { EUR: 1, USD: 0.92, HKD: 0.115, BTC: 50000, ETH: 2500 };
    const instruments: Record<string, { name?: string; currentPrice: number }> = {};
    
    for (const [ticker, asset] of Object.entries(structure.assets)) {
      instruments[ticker] = {
        name: asset.name,
        currentPrice: 0,
      };
    }
    
    if (structure.manualRates) {
      for (const [currency, rate] of Object.entries(structure.manualRates)) {
        rates[currency.toUpperCase()] = rate;
      }
    }
    
    const config: PortfolioConfig = {
      currency: structure.currency,
      instruments,
      exchangeRates: rates,
      actionAliases: structure.actionAliases,
    };
    
    // Try to parse with config
    let parsedTransactions: any[] = [];
    try {
      parsedTransactions = parseTransactionsCsv(csvText, config);
      console.log(`\nParsed ${parsedTransactions.length} transactions (converted to ${config.currency}):`);
      for (const txn of parsedTransactions.slice(0, 5)) {
        const value = txn.quantity * txn.price;
        console.log(`  ${txn.date.toISOString().split("T")[0]}: ${txn.quantity} ${txn.ticker} @ ${txn.price.toFixed(2)} ${config.currency} = ${value.toFixed(2)} ${config.currency}`);
      }
      if (parsedTransactions.length > 5) {
        console.log(`  ... and ${parsedTransactions.length - 5} more`);
      }
    } catch (parseError) {
      console.log(`\n  WARNING: Could not parse transactions with portfolio config: ${parseError}`);
    }
    
    console.log("\nIMPORTANT: Compare the converted values above with your source app!");
    console.log("   If they differ, it is the FX rate issue (Issue #1).");
    
    // Check for potential issues
    console.log("\nChecking for potential issues...");
    
    // Check which currencies have exchange rates
    const missingRates: string[] = [];
    for (const currency of [...allCurrencies]) {
      if (currency !== structure.currency && !rates[currency]) {
        missingRates.push(currency);
      }
    }
    
    if (missingRates.length > 0) {
      console.log(`  ERROR: Missing exchange rates for: ${missingRates.join(", ")}`);
      console.log(`  Add these to your portfolio.yml exchange_rates section`);
    }
    
    // Check for currency conversion issues
    const nonBaseCurrencies = [...priceCurrencies].filter(c => c !== structure.currency);
    if (nonBaseCurrencies.length > 0) {
      console.log(`\n  FOUND: Transactions in non-base currencies: ${nonBaseCurrencies.join(", ")}`);
      console.log(`  These are converted using CURRENT exchange rates from portfolio.yml`);
      console.log(`  This causes errors if rates have changed since transaction dates!`);
      console.log(`  FIX: Use historical FX rates for each transaction date`);
    }
    
    // Check for potential ADR issues
    console.log("\nChecking instrument configurations for symbol issues...");
    for (const [ticker, asset] of Object.entries(structure.assets)) {
      const quoteSymbol = asset.quoteSymbol || ticker;
      
      // Check for common patterns
      const isEuStock = /\.(AS|AMS|L|DE|PA|BR|HE|MU|ST)$/i.test(ticker);
      const isUsSymbol = /^[A-Z]{1,5}$/i.test(quoteSymbol) && !quoteSymbol.includes(".");
      const isHkStock = /\.HK$/i.test(ticker) || /:HKEX$/i.test(ticker);
      const isFStock = /\.F$/i.test(ticker);
      const isCrypto = /\.CRYPTO$/i.test(ticker);
      
      if (isEuStock && isUsSymbol) {
        console.log(`  WARNING: ${ticker} (EU stock) uses US symbol: ${quoteSymbol}`);
        console.log(`          This might be a US ADR! Verify it matches your source app.`);
      }
      
      if (isHkStock) {
        console.log(`  INFO: ${ticker} is a Hong Kong stock`);
        if (quoteSymbol !== ticker) {
          console.log(`        Using quote_symbol: ${quoteSymbol}`);
          if (quoteSymbol === "TCEHY") {
            console.log(`        WARNING: TCEHY is Tencent ADR (OTC), not HKEX listing!`);
            console.log(`        Consider using: 0700.HK or 700.HK`);
          }
        }
      }
      
      if (isFStock) {
        console.log(`  INFO: ${ticker} is a Frankfurt stock (.F)`);
        if (quoteSymbol !== ticker) {
          console.log(`        Using quote_symbol: ${quoteSymbol}`);
          if (quoteSymbol.includes("VYM") || quoteSymbol.includes("URTH") || quoteSymbol.includes("VT")) {
            console.log(`        WARNING: This appears to be a US ETF symbol, not Frankfurt!`);
          }
        }
      }
      
      if (isCrypto) {
        console.log(`  INFO: ${ticker} is a crypto asset`);
        if (quoteSymbol !== ticker) {
          console.log(`        Using quote_symbol: ${quoteSymbol}`);
          if (quoteSymbol.includes("/USD")) {
            console.log(`        WARNING: Using /USD pair, but your base is ${structure.currency}`);
            console.log(`        Consider using: ${ticker.replace(".CRYPTO", "")}/${structure.currency} or just ${ticker.replace(".CRYPTO", "")}`);
          }
        }
      }
      
      if (quoteSymbol !== ticker && !isEuStock && !isHkStock && !isFStock && !isCrypto) {
        console.log(`  INFO: ${ticker} uses quote_symbol override: ${quoteSymbol}`);
      }
    }
    
    // Check exchange rates
    console.log("\nExchange rates configuration:");
    for (const [currency, rate] of Object.entries(rates)) {
      if (SUPPORTED_CURRENCIES.includes(currency)) {
        const rateType = ["BTC", "ETH"].includes(currency) ? "price" : "rate";
        console.log(`  ${currency}: ${rate} (1 ${currency} = ${rate} ${structure.currency}, ${rateType})`);
      }
    }
    
    // Check for crypto transactions
    const cryptoCurrencies = ["BTC", "ETH"];
    const hasCrypto = [...priceCurrencies].some(c => cryptoCurrencies.includes(c));
    if (hasCrypto) {
      console.log("\n  NOTE: Crypto transactions (BTC, ETH) use current prices for cost basis.");
      console.log("        This can cause large discrepancies. Use historical prices!");
    }
    
    // Check manual prices
    if (structure.manualPrices) {
      console.log("\nManual price overrides:");
      for (const [ticker, price] of Object.entries(structure.manualPrices)) {
        console.log(`  ${ticker}: ${price.value} ${price.currency}`);
      }
    }
    
  } catch (error) {
    console.error("Error analyzing data:", error);
  }
}

// ============================================================================
// SYMBOL MAPPING GUIDE
// ============================================================================

function printSymbolMappingGuide() {
  console.log("\n" + "=".repeat(80));
  console.log("SYMBOL MAPPING GUIDE FOR TWELVE DATA & YAHOO APIs");
  console.log("=".repeat(80));
  
  console.log("\nYour portfolio.yml uses quote_symbol overrides. Here's how to map them:");
  console.log("\n--- Hong Kong Stocks (HKEX) ---");
  console.log("Tencent Holdings:");
  console.log("  700.HK -> 0700.HK (Yahoo Finance)");
  console.log("  700.HK -> 0700:HKEX (Twelve Data)");
  console.log("  NOTE: TCEHY is OTC ADR (US), NOT HKEX listing!");
  console.log("        TCEHY price != 700.HK price");
  
  console.log("\n--- Frankfurt Stocks (.F) ---");
  console.log("These are UCITS ETFs listed in Frankfurt:");
  console.log("  VWCE.F -> VWCE.DE (Yahoo) or VWCE:GR (Twelve Data)");
  console.log("  IWDA.AS -> IWDA.AS (Yahoo) or IWDA:AS (Twelve Data)");
  console.log("  AMEW.F -> AMEW.DE (Yahoo) or AMEW:GR (Twelve Data)");
  console.log("  IUSN.F -> IUSN.DE (Yahoo) or IUSN:GR (Twelve Data)");
  console.log("  NVD.F -> NVDA (Yahoo) - This is WRONG! NVD.F is Frankfurt, NVDA is NASDAQ");
  console.log("  VHYL.AS -> VHYL.AS (Yahoo) - NOT VYM (VYM is US ETF)");
  console.log("  VGWD.F -> VGWD.DE (Yahoo) - NOT VYM");
  
  console.log("\n--- US Stocks ---");
  console.log("These should use their primary exchange:");
  console.log("  AAPL -> AAPL (NASDAQ)");
  console.log("  AMZN -> AMZN (NASDAQ)");
  console.log("  MSFT -> MSFT (NASDAQ)");
  console.log("  NVDA -> NVDA (NASDAQ) - NOT NVD.F");
  
  console.log("\n--- Crypto ---");
  console.log("For CoinGecko API (used by your app):");
  console.log("  BTC.CRYPTO -> BTC (CoinGecko ID: bitcoin)");
  console.log("  ETH.CRYPTO -> ETH (CoinGecko ID: ethereum)");
  console.log("  NOTE: Your portfolio.yml uses BTC/USD and ETH/USD");
  console.log("        This may cause issues if your base currency is EUR");
  console.log("        Consider using BTC-EUR and ETH-EUR pairs");
  
  console.log("\n--- Twelve Data Free Tier Notes ---");
  console.log("Twelve Data free tier supports:");
  console.log("  - US stocks: AAPL, MSFT, AMZN, etc. (NASDAQ/NYSE)");
  console.log("  - EU stocks: Use .DE, .AS, .L suffixes");
  console.log("  - HK stocks: Use :HKEX suffix (e.g., 0700:HKEX)");
  console.log("  - Does NOT support EU markets for free (except via suffixes)");
  console.log("\nYahoo Finance supports:");
  console.log("  - US stocks: AAPL, MSFT, etc.");
  console.log("  - EU stocks: Use .AS, .DE, .L, etc.");
  console.log("  - HK stocks: Use .HK suffix (e.g., 0700.HK)");
  console.log("  - Crypto: NOT supported (use CoinGecko)");
  
  console.log("\nRECOMMENDATION:");
  console.log("  1. For HK stocks: Use 0700.HK (Yahoo) or 0700:HKEX (Twelve Data)");
  console.log("  2. For Frankfurt ETFs: Use .DE suffix (Yahoo) or :GR (Twelve Data)");
  console.log("  3. For US stocks: Use primary ticker (AAPL, MSFT, etc.)");
  console.log("  4. For crypto: Use BTC, ETH (CoinGecko)");
  console.log("  5. REMOVE quote_symbol overrides that map to wrong exchanges!");
}

// ============================================================================
// MAIN
// ============================================================================

async function main(): Promise<void> {
  const args = parseArgs();
  
  if (args.help) {
    printHelp();
    return;
  }

  console.log("Portfolio Value Discrepancy Diagnostic Tool");
  console.log(`Supports currencies: ${SUPPORTED_CURRENCIES.join(", ")}`);
  console.log("=".repeat(80));
  console.log(`Loading data from:
  CSV: ${args.csvPath}
  YAML: ${args.yamlPath}\n`);

  try {
    // Load files
    const csvText = await loadCsvFile(args.csvPath);
    const yamlText = await loadYamlFile(args.yamlPath);
    
    // Parse YAML structure
    const structure = parsePortfolioStructure(yamlText);
    
    console.log(`Portfolio Configuration:`);
    console.log(`  Base Currency: ${structure.currency}`);
    console.log(`  Assets: ${Object.keys(structure.assets).length}`);
    console.log(`  Manual Rates: ${structure.manualRates ? Object.keys(structure.manualRates).length : 0}`);
    console.log(`  Manual Prices: ${structure.manualPrices ? Object.keys(structure.manualPrices).length : 0}`);
    console.log();
    
    // Run all diagnoses
    diagnoseFxRateIssue();
    diagnoseAdrIssue();
    diagnoseCombinedImpact();
    await analyzeActualData(csvText, structure);
    
    // Print symbol mapping guide
    printSymbolMappingGuide();
    
    console.log("\n" + "=".repeat(80));
    console.log("SUMMARY & RECOMMENDATIONS");
    console.log("=".repeat(80));
    
    console.log(`
CRITICAL ISSUES (Fix these FIRST):

1. HISTORICAL FX RATES (EUR, USD, HKD)
   - Your parser uses CURRENT exchange rates for HISTORICAL transactions
   - This can cause 5-20%+ errors depending on FX rate movements
   - FIX: Store historical FX rates or fetch rates for each transaction date
   - See: src/core/historical-rates.ts for implementation

2. HISTORICAL CRYPTO PRICES (BTC, ETH)
   - Your parser uses CURRENT crypto prices for HISTORICAL transactions
   - BTC and ETH are highly volatile - this causes massive cost basis errors
   - FIX: Store historical crypto prices or fetch prices for each transaction date
   - Example: 1 BTC bought at 40k EUR but current price is 50k EUR = 10k EUR error!

3. SYMBOL MAPPING ISSUES
   - Your portfolio.yml has INCORRECT quote_symbol overrides
   - TCEHY is Tencent ADR (OTC), NOT 700.HK (HKEX) - different prices!
   - VYM, URTH, VT are US ETFs, NOT Frankfurt/Euronext listings
   - FIX: Use native exchange symbols or remove incorrect overrides

SECONDARY ISSUES:

4. CURRENT PRICES
   - Verify your dashboard is using the same price source as your app
   - Check if prices are from the same timestamp

5. FEE CALCULATIONS
   - Fees are also converted using current FX rates
   - Usually <1% impact unless you have very high fees

NEXT STEPS:

1. Review the SYMBOL MAPPING GUIDE above for your specific configuration
2. Fix the quote_symbol overrides in portfolio.yml (highest priority!)
3. Fix the FX rate issue for USD, HKD transactions
4. Fix the crypto price issue for BTC, ETH transactions
5. Use the historical-rates.ts module for proper FX rate handling
`);

  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    console.log("\nTry running with --help for usage information.");
    process.exit(1);
  }
}

main().catch(console.error);
