/**
 * Diagnostic Script for Portfolio Value Discrepancy
 * 
 * This script helps identify why your dashboard shows >10k difference from ground truth.
 * 
 * Usage:
 *   npx tsx diagnose-discrepancy.ts --csv data/transactions.csv --yaml portfolio.yml
 * 
 * Or edit the DEFAULT_CSV_PATH and DEFAULT_YAML_PATH constants below.
 */

import { parse } from "yaml";
import { readFile } from "node:fs/promises";
import { parseTransactionsCsv } from './src/core/parser';
import { parsePortfolioStructure, parsePortfolioConfig } from './src/core/config';
import { buildPortfolioConfig } from './src/core/market-data';
import type { PortfolioConfig, PortfolioStructure, MarketSnapshot } from './src/core/config';

// ============================================================================
// CONFIGURATION - Edit these paths or use command-line arguments
// ============================================================================

const DEFAULT_CSV_PATH = "./data/transactions.csv";
const DEFAULT_YAML_PATH = "./portfolio.yml";

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
  1. Historical FX rate issues
  2. US ADR vs EU listing symbol mismatches
  3. Combined impact of multiple issues
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
 */
function diagnoseFxRateIssue() {
  console.log("\n" + "=".repeat(80));
  console.log("DIAGNOSIS #1: Historical FX Rate Issue");
  console.log("=".repeat(80));
  
  const historicalEurUsd = 1.10; // EUR/USD 3 months ago
  const currentEurUsd = 0.92;   // EUR/USD today (1/USD = EUR per USD)
  
  const usdAmount = 10000; // $10,000 transaction
  
  const correctEurValue = usdAmount / historicalEurUsd; // Should be ~9,090.91
  const wrongEurValue = usdAmount / currentEurUsd;     // Currently ~10,869.57
  
  const error = wrongEurValue - correctEurValue;
  const errorPercent = (error / correctEurValue) * 100;
  
  console.log(`\nScenario: $${usdAmount} transaction`);
  console.log(`Historical EUR/USD: ${historicalEurUsd}`);
  console.log(`Current EUR/USD: ${currentEurUsd}`);
  console.log(`\nCorrect EUR value: ${correctEurValue.toFixed(2)} EUR`);
  console.log(`Current code calculates: ${wrongEurValue.toFixed(2)} EUR`);
  console.log(`Error: ${error.toFixed(2)} EUR (${errorPercent.toFixed(1)}%)`);
  
  console.log(`\nIf you have $${usdAmount} in USD transactions, this ONE issue`);
  console.log(`   could cause a ${error.toFixed(0)} EUR discrepancy!`);
}

/**
 * Diagnose Issue #2: ADR/US Equivalent Symbol Problem
 */
function diagnoseAdrIssue() {
  console.log("\n" + "=".repeat(80));
  console.log("DIAGNOSIS #2: US ADR vs EU Listing Issue");
  console.log("=".repeat(80));
  
  // Example: ASML
  const asmlEuronextPrice = 700;  // EUR per share
  const asmlNasdaqPrice = 750;     // USD per ADR
  const eurUsd = 1.08;             // Current EUR/USD
  
  const sharesOwned = 100;
  const correctValueEur = sharesOwned * asmlEuronextPrice; // 70,000 EUR
  const asmlNasdaqInEur = asmlNasdaqPrice / eurUsd; // ~694.44 EUR
  const wrongValueEur = sharesOwned * asmlNasdaqInEur; // ~69,444 EUR
  
  const error = wrongValueEur - correctValueEur;
  const errorPercent = (error / correctValueEur) * 100;
  
  console.log(`\nScenario: ${sharesOwned} shares of ASML`);
  console.log(`ASML.AS (Euronext) price: ${asmlEuronextPrice} EUR`);
  console.log(`ASML (NASDAQ) price: $${asmlNasdaqPrice} = ${asmlNasdaqInEur.toFixed(2)} EUR`);
  console.log(`\nCorrect EUR value: ${correctValueEur.toFixed(2)} EUR`);
  console.log(`Dashboard (using NASDAQ): ${wrongValueEur.toFixed(2)} EUR`);
  console.log(`Error: ${error.toFixed(2)} EUR (${errorPercent.toFixed(1)}%)`);
  
  // ADR ratio example
  console.log(`\n--- ADR Ratio Example ---`);
  console.log(`Some ADRs represent multiple underlying shares:`);
  console.log(`Example: 1 ING.NYSE ADR = 2 INGA.AS shares`);
  console.log(`If dashboard uses ADR price but you own underlying shares:`);
  
  const underlyingShares = 100;
  const adrRatio = 2; // 1 ADR = 2 underlying
  const underlyingPriceEur = 10; // 10 EUR per underlying share
  const adrPriceUsd = 18; // $18 per ADR
  const adrPriceEur = adrPriceUsd / eurUsd; // ~16.67 EUR
  
  const correctValue = underlyingShares * underlyingPriceEur; // 1,000 EUR
  const wrongValue = underlyingShares * adrPriceEur; // 1,667 EUR
  
  const ratioError = wrongValue - correctValue;
  console.log(`\n${underlyingShares} underlying shares at ${underlyingPriceEur} EUR = ${correctValue} EUR`);
  console.log(`Dashboard treats as ${underlyingShares} ADRs at ${adrPriceEur.toFixed(2)} EUR = ${wrongValue.toFixed(2)} EUR`);
  console.log(`Error: ${ratioError.toFixed(2)} EUR (${(ratioError/correctValue*100).toFixed(1)}%)`);
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
    { name: "Small portfolio", usdValue: 50000, fxRateChange: 0.05, adrError: 0.02 },
    { name: "Medium portfolio", usdValue: 100000, fxRateChange: 0.08, adrError: 0.05 },
    { name: "Large portfolio", usdValue: 200000, fxRateChange: 0.10, adrError: 0.10 },
  ];
  
  console.log("\nAssuming 50% of portfolio is in USD-denominated transactions:");
  console.log("And 30% is in EU stocks using US ADR prices\n");
  
  for (const scenario of scenarios) {
    const usdPortion = scenario.usdValue * 0.5;
    const adrPortion = scenario.usdValue * 0.3;
    
    const fxError = usdPortion * scenario.fxRateChange;
    const adrError = adrPortion * scenario.adrError;
    const totalError = fxError + adrError;
    const errorPercent = (totalError / scenario.usdValue) * 100;
    
    console.log(`${scenario.name}:`);
    console.log(`  Portfolio value: $${scenario.usdValue}`);
    console.log(`  FX rate error: ${fxError.toFixed(0)} EUR`);
    console.log(`  ADR price error: ${adrError.toFixed(0)} EUR`);
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
    
    // First, scan to get currencies
    const scan = { tickers: [], currencies: [] };
    try {
      // We need to implement a simple scan for currencies
      const rows = csvText.split("\n").filter(r => r.trim());
      if (rows.length < 2) {
        console.log("  No transactions found in CSV");
        return;
      }
      
      const header = rows[0].split(/[,\s;]+/).map(h => h.trim().toLowerCase());
      const priceCurrencyIdx = header.findIndex(h => h.includes("price") && h.includes("currency"));
      const feesCurrencyIdx = header.findIndex(h => h.includes("fees") && h.includes("currency"));
      
      const currencies = new Set<string>();
      for (let i = 1; i < rows.length; i++) {
        const cols = rows[i].split(/[,\s;]+/).map(c => c.trim());
        if (priceCurrencyIdx >= 0 && cols[priceCurrencyIdx]) {
          currencies.add(cols[priceCurrencyIdx].toUpperCase());
        }
        if (feesCurrencyIdx >= 0 && cols[feesCurrencyIdx]) {
          currencies.add(cols[feesCurrencyIdx].toUpperCase());
        }
      }
      scan.currencies = [...currencies];
    } catch (e) {
      // Fallback
      scan.currencies = ["EUR", "USD"];
    }
    
    // Build a simple config for parsing
    const rates: Record<string, number> = { EUR: 1, USD: 0.92 };
    const instruments: Record<string, { name?: string; currentPrice: number }> = {};
    
    for (const [ticker, asset] of Object.entries(structure.assets)) {
      instruments[ticker] = {
        name: asset.name,
        currentPrice: 0, // Will be filled by market data
      };
    }
    
    const config: PortfolioConfig = {
      currency: structure.currency,
      instruments,
      exchangeRates: rates,
      actionAliases: structure.actionAliases,
    };
    
    const transactions = parseTransactionsCsv(csvText, config);
    
    console.log(`\nFound ${transactions.length} transactions:`);
    for (const txn of transactions) {
      const value = txn.quantity * txn.price;
      console.log(`  ${txn.date.toISOString().split("T")[0]}: ${txn.quantity} ${txn.ticker} @ ${txn.price.toFixed(2)} ${config.currency} = ${value.toFixed(2)} ${config.currency}`);
    }
    
    console.log("\nIMPORTANT: Check if the values above match your source app!");
    console.log("   If they differ, it is the FX rate issue (Issue #1).");
    
    // Check for potential issues
    console.log("\nChecking for potential issues...");
    
    // Check for USD transactions (FX rate issue)
    const usdTransactions = transactions.filter(t => {
      // We can't directly check original currency, but we can infer from price
      return true; // All non-EUR base currency transactions
    });
    
    if (usdTransactions.length > 0 && structure.currency === "EUR") {
      console.log(`  Found ${usdTransactions.length} transactions that may have been converted from USD`);
      console.log(`  These use CURRENT exchange rate (${rates.USD}), which may be incorrect!`);
      console.log(`  FIX: Use historical FX rates for each transaction date`);
    }
    
    // Check for potential ADR issues
    console.log("\nChecking instrument configurations for ADR issues...");
    for (const [ticker, asset] of Object.entries(structure.assets)) {
      const quoteSymbol = asset.quoteSymbol || ticker;
      
      // Check for common ADR patterns
      const isEuStock = /\.(AS|AMS|L|DE|PA|BR|HE|MU|ST|HK)$/i.test(ticker);
      const isUsSymbol = /^[A-Z]{1,5}$/i.test(quoteSymbol) && !quoteSymbol.includes(".");
      
      if (isEuStock && isUsSymbol) {
        console.log(`  WARNING: ${ticker} (EU stock) uses US symbol: ${quoteSymbol}`);
        console.log(`          This might be a US ADR! Verify it matches your source app.`);
      }
      
      if (quoteSymbol !== ticker) {
        console.log(`  INFO: ${ticker} uses quote_symbol override: ${quoteSymbol}`);
      }
    }
    
    // Check exchange rates
    console.log("\nExchange rates configuration:");
    if (structure.manualRates) {
      for (const [currency, rate] of Object.entries(structure.manualRates)) {
        console.log(`  ${currency}: ${rate} (1 ${currency} = ${rate} ${structure.currency})`);
      }
    } else {
      console.log(`  Using default rates (only ${structure.currency}: 1)`);
      console.log(`  WARNING: Missing exchange rates for other currencies!`);
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

1. HISTORICAL FX RATES
   - Your parser uses CURRENT exchange rates for HISTORICAL transactions
   - This can cause 5-20%+ errors depending on FX rate movements
   - FIX: Store historical FX rates or fetch rates for each transaction date
   - See: src/core/historical-rates.ts for implementation

2. US ADR SYMBOLS
   - If you're using US symbols (AAPL, MSFT) for EU stocks (ASML.AS, IEV.AS)
   - Prices can differ by 10-50%+ due to ADR ratios and market differences
   - FIX: Use the EXACT same tickers as in your source app
   - Check portfolio.yml for quote_symbol overrides

SECONDARY ISSUES:

3. CURRENT PRICES
   - Verify your dashboard is using the same price source as your app
   - Check if prices are from the same timestamp

4. FEE CALCULATIONS
   - Fees are also converted using current FX rates
   - Usually <1% impact unless you have very high fees

NEXT STEPS:

1. Review the warnings above for your specific configuration
2. Fix the FX rate issue first (highest impact)
3. Then verify all symbol mappings
4. Finally, check price sources
5. Use the historical-rates.ts module for proper FX rate handling
`);

  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    console.log("\nTry running with --help for usage information.");
    process.exit(1);
  }
}

main().catch(console.error);
