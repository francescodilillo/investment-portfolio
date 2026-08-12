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
  3. US ADR vs EU listing symbol mismatches
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
  
  // FX rate examples
  console.log("\n--- Fiat Currency Examples (EUR, USD, HKD) ---");
  
  const usdHistorical = 1.10; // EUR/USD 3 months ago
  const usdCurrent = 0.92;   // EUR/USD today
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
  
  const hkdHistorical = 8.5; // HKD/EUR 3 months ago (1 EUR = 8.5 HKD, so 1 HKD = 1/8.5 EUR)
  const hkdCurrent = 8.8;   // HKD/EUR today
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
  
  // Crypto examples
  console.log("\n--- Crypto Currency Examples (BTC, ETH) ---");
  console.log("Note: For crypto, the 'exchange rate' is the price in EUR");
  
  const btcHistorical = 40000; // BTC/EUR 3 months ago
  const btcCurrent = 50000;   // BTC/EUR today
  const btcAmount = 1;
  const btcError = btcCurrent - btcHistorical;
  
  console.log(`\nBTC Transaction: ${btcAmount} BTC`);
  console.log(`  Historical BTC/EUR: ${btcHistorical}`);
  console.log(`  Current BTC/EUR: ${btcCurrent}`);
  console.log(`  Correct cost basis: ${btcHistorical.toFixed(2)} EUR`);
  console.log(`  Current code uses: ${btcCurrent.toFixed(2)} EUR`);
  console.log(`  Error on cost basis: ${btcError.toFixed(2)} EUR (${((btcError/btcHistorical)*100).toFixed(1)}%)`);
  
  const ethHistorical = 2000; // ETH/EUR 3 months ago
  const ethCurrent = 2500;   // ETH/EUR today
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
  
  // Example: ASML
  const asmlEuronextPrice = 700;  // EUR per share
  const asmlNasdaqPrice = 750;     // USD per ADR
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
  
  // ADR ratio example
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
    const hkdPortion = scenario.hkdValue / 8.5; // Convert HKD to EUR equivalent
    const btcPortion = scenario.btcAmount * 45000; // BTC at ~45k EUR
    const ethPortion = scenario.ethAmount * 2250; // ETH at ~2.25k EUR
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
    console.log("\nParsing your transaction CSV...");
    
    // First, scan CSV to get currencies and tickers
    const rows = csvText.split("\n").filter(r => r.trim());
    if (rows.length < 2) {
      console.log("  No transactions found in CSV");
      return;
    }
    
    const header = rows[0].split(/[,\s;]+/).map(h => h.trim().toLowerCase());
    const symbolIdx = header.findIndex(h => h.includes("symbol"));
    const dateIdx = header.findIndex(h => h.includes("date"));
    const quantityIdx = header.findIndex(h => h.includes("quantity"));
    const priceIdx = header.findIndex(h => h.includes("price") && !h.includes("currency"));
    const priceCurrencyIdx = header.findIndex(h => h.includes("price") && h.includes("currency"));
    const feesAmountIdx = header.findIndex(h => h.includes("fees") && h.includes("amount"));
    const feesCurrencyIdx = header.findIndex(h => h.includes("fees") && h.includes("currency"));
    
    // Collect all currencies used
    const currencies = new Set<string>();
    const tickers = new Set<string>();
    const transactionsByCurrency: Record<string, { count: number; totalAmount: number; sample: string }> = {};
    
    for (let i = 1; i < rows.length; i++) {
      const cols = rows[i].split(/[,\s;]+/).map(c => c.trim());
      if (cols.filter(c => c).length < 3) continue; // Skip empty rows
      
      const symbol = cols[symbolIdx]?.toUpperCase() || "";
      const priceCurrency = cols[priceCurrencyIdx]?.toUpperCase() || structure.currency;
      const feesCurrency = cols[feesCurrencyIdx]?.toUpperCase() || structure.currency;
      const quantity = parseFloat(cols[quantityIdx] || "0");
      const price = parseFloat(cols[priceIdx] || "0");
      
      tickers.add(symbol);
      currencies.add(priceCurrency);
      currencies.add(feesCurrency);
      
      const amount = quantity * price;
      
      if (!transactionsByCurrency[priceCurrency]) {
        transactionsByCurrency[priceCurrency] = { count: 0, totalAmount: 0, sample: symbol };
      }
      transactionsByCurrency[priceCurrency].count++;
      transactionsByCurrency[priceCurrency].totalAmount += amount;
    }
    
    console.log(`\nFound ${rows.length - 1} transactions`);
    console.log(`  Tickers: ${[...tickers].slice(0, 10).join(", ")}${tickers.size > 10 ? "..." : ""}`);
    console.log(`  Currencies: ${[...currencies].join(", ")}`);
    
    // Check for unsupported currencies
    const unsupported = [...currencies].filter(c => !SUPPORTED_CURRENCIES.includes(c));
    if (unsupported.length > 0) {
      console.log(`\n  WARNING: Found unsupported currencies: ${unsupported.join(", ")}`);
      console.log(`  Supported currencies: ${SUPPORTED_CURRENCIES.join(", ")}`);
    }
    
    // Show breakdown by currency
    console.log("\nTransaction breakdown by currency:");
    for (const [currency, info] of Object.entries(transactionsByCurrency)) {
      console.log(`  ${currency}: ${info.count} transactions, total amount: ${info.totalAmount.toFixed(2)} ${currency}`);
    }
    
    // Build config for parsing
    const rates: Record<string, number> = { EUR: 1, USD: 0.92, HKD: 0.115, BTC: 50000, ETH: 2500 };
    const instruments: Record<string, { name?: string; currentPrice: number }> = {};
    
    for (const [ticker, asset] of Object.entries(structure.assets)) {
      instruments[ticker] = {
        name: asset.name,
        currentPrice: 0,
      };
    }
    
    // Override with manual rates if available
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
    
    // Parse transactions
    const transactions = parseTransactionsCsv(csvText, config);
    
    console.log(`\nParsed ${transactions.length} transactions successfully:`);
    for (const txn of transactions.slice(0, 5)) {
      const value = txn.quantity * txn.price;
      console.log(`  ${txn.date.toISOString().split("T")[0]}: ${txn.quantity} ${txn.ticker} @ ${txn.price.toFixed(2)} ${config.currency} = ${value.toFixed(2)} ${config.currency}`);
    }
    if (transactions.length > 5) {
      console.log(`  ... and ${transactions.length - 5} more`);
    }
    
    console.log("\nIMPORTANT: Check if the values above match your source app!");
    console.log("   If they differ, it is the FX rate issue (Issue #1).");
    
    // Check for potential issues
    console.log("\nChecking for potential issues...");
    
    // Check for non-EUR base currency transactions
    const nonBaseCurrencyTxns = transactions.filter(t => {
      // We can't directly check original currency from parsed data,
      // but we can check if the config has exchange rates for other currencies
      return true;
    });
    
    // Check which currencies have exchange rates
    const missingRates: string[] = [];
    for (const currency of [...currencies]) {
      if (currency !== structure.currency && !rates[currency]) {
        missingRates.push(currency);
      }
    }
    
    if (missingRates.length > 0) {
      console.log(`  ERROR: Missing exchange rates for: ${missingRates.join(", ")}`);
      console.log(`  Add these to your portfolio.yml exchange_rates section`);
    }
    
    // Check for potential ADR issues
    console.log("\nChecking instrument configurations for symbol issues...");
    for (const [ticker, asset] of Object.entries(structure.assets)) {
      const quoteSymbol = asset.quoteSymbol || ticker;
      
      // Check for common patterns
      const isEuStock = /\.(AS|AMS|L|DE|PA|BR|HE|MU|ST)$/i.test(ticker);
      const isUsSymbol = /^[A-Z]{1,5}$/i.test(quoteSymbol) && !quoteSymbol.includes(".");
      const isHkStock = /\.HK$/i.test(ticker) || /:HKEX$/i.test(ticker);
      
      if (isEuStock && isUsSymbol) {
        console.log(`  WARNING: ${ticker} (EU stock) uses US symbol: ${quoteSymbol}`);
        console.log(`          This might be a US ADR! Verify it matches your source app.`);
      }
      
      if (isHkStock) {
        console.log(`  INFO: ${ticker} is a Hong Kong stock - verify symbol format`);
        if (quoteSymbol !== ticker) {
          console.log(`        Using quote_symbol: ${quoteSymbol}`);
        }
      }
      
      if (quoteSymbol !== ticker) {
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
    const hasCrypto = [...currencies].some(c => cryptoCurrencies.includes(c));
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

3. US ADR SYMBOLS
   - If you're using US symbols (AAPL, MSFT) for non-US stocks (ASML.AS, 700.HK)
   - Prices can differ by 10-50%+ due to ADR ratios and market differences
   - FIX: Use the EXACT same tickers as in your source app
   - Check portfolio.yml for quote_symbol overrides

SECONDARY ISSUES:

4. CURRENT PRICES
   - Verify your dashboard is using the same price source as your app
   - Check if prices are from the same timestamp

5. FEE CALCULATIONS
   - Fees are also converted using current FX rates
   - Usually <1% impact unless you have very high fees

NEXT STEPS:

1. Review the warnings above for your specific configuration
2. Fix the FX rate issue first (highest impact for USD, HKD)
3. Fix the crypto price issue (highest impact for BTC, ETH)
4. Then verify all symbol mappings
5. Finally, check price sources
6. Use the historical-rates.ts module for proper FX rate handling
`);

  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    console.log("\nTry running with --help for usage information.");
    process.exit(1);
  }
}

main().catch(console.error);
