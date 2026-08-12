/**
 * Diagnostic Script for Portfolio Value Discrepancy
 * 
 * This script helps identify why your dashboard shows >10k difference from ground truth.
 * 
 * Usage:
 * 1. Fill in your actual transaction data in the testCsv variable
 * 2. Fill in your portfolio configuration
 * 3. Run: npx tsx diagnose-discrepancy.ts
 */

import { parseTransactionsCsv } from './src/core/parser';
import type { PortfolioConfig } from './src/core/types';

// ============================================================================
// CONFIGURATION - Fill these in with your actual data
// ============================================================================

// Example transaction CSV (replace with your actual data)
const testCsv = `Symbol,Date,Quantity,Price,Price Currency,Fees Percentage,Fees Amount,Fees Currency
AAPL,2024-01-15,10,150,USD,0.1,15,USD
MSFT,2024-01-20,5,300,USD,0.1,15,USD
IEV.AS,2024-02-01,100,50,EUR,0.1,5,EUR`;

// Example portfolio config (replace with your actual config)
const testPortfolioConfig: PortfolioConfig = {
  currency: 'EUR',
  instruments: {
    'AAPL': { name: 'Apple Inc', currentPrice: 180 },
    'MSFT': { name: 'Microsoft Corp', currentPrice: 350 },
    'IEV.AS': { name: 'Ingenico Group', currentPrice: 55 },
  },
  exchangeRates: {
    EUR: 1,
    USD: 0.92, // Current EUR/USD rate - THIS IS THE PROBLEM!
  },
};

// ============================================================================
// DIAGNOSTIC FUNCTIONS
// ============================================================================

/**
 * Diagnose Issue #1: Historical FX Rate Problem
 */
function diagnoseFxRateIssue() {
  console.log('\n' + '='.repeat(80));
  console.log('DIAGNOSIS #1: Historical FX Rate Issue');
  console.log('='.repeat(80));
  
  const historicalEurUsd = 1.10; // EUR/USD 3 months ago
  const currentEurUsd = 0.92;   // EUR/USD today (1/USD = EUR per USD)
  
  const usdAmount = 10000; // $10,000 transaction
  
  const correctEurValue = usdAmount / historicalEurUsd; // Should be ~€9,090.91
  const wrongEurValue = usdAmount / currentEurUsd;     // Currently ~€10,869.57
  
  const error = wrongEurValue - correctEurValue;
  const errorPercent = (error / correctEurValue) * 100;
  
  console.log(`\nScenario: $${usdAmount} transaction`);
  console.log(`Historical EUR/USD: ${historicalEurUsd}`);
  console.log(`Current EUR/USD: ${currentEurUsd}`);
  console.log(`\nCorrect EUR value: €${correctEurValue.toFixed(2)}`);
  console.log(`Current code calculates: €${wrongEurValue.toFixed(2)}`);
  console.log(`Error: €${error.toFixed(2)} (${errorPercent.toFixed(1)}%)`);
  
  console.log(`\n⚠️  If you have $${usdAmount} in USD transactions, this ONE issue`);
  console.log(`   could cause a €${error.toFixed(0)} discrepancy!`);
}

/**
 * Diagnose Issue #2: ADR/US Equivalent Symbol Problem
 */
function diagnoseAdrIssue() {
  console.log('\n' + '='.repeat(80));
  console.log('DIAGNOSIS #2: US ADR vs EU Listing Issue');
  console.log('='.repeat(80));
  
  // Example: ASML
  const asmlEuronextPrice = 700;  // EUR per share
  const asmlNasdaqPrice = 750;     // USD per ADR
  const eurUsd = 1.08;             // Current EUR/USD
  
  const sharesOwned = 100;
  const correctValueEur = sharesOwned * asmlEuronextPrice; // €70,000
  const asmlNasdaqInEur = asmlNasdaqPrice / eurUsd; // ~€694.44
  const wrongValueEur = sharesOwned * asmlNasdaqInEur; // ~€69,444
  
  const error = wrongValueEur - correctValueEur;
  const errorPercent = (error / correctValueEur) * 100;
  
  console.log(`\nScenario: ${sharesOwned} shares of ASML`);
  console.log(`ASML.AS (Euronext) price: €${asmlEuronextPrice}`);
  console.log(`ASML (NASDAQ) price: $${asmlNasdaqPrice} = €${asmlNasdaqInEur.toFixed(2)}`);
  console.log(`\nCorrect EUR value: €${correctValueEur.toFixed(2)}`);
  console.log(`Dashboard (using NASDAQ): €${wrongValueEur.toFixed(2)}`);
  console.log(`Error: €${error.toFixed(2)} (${errorPercent.toFixed(1)}%)`);
  
  // ADR ratio example
  console.log(`\n--- ADR Ratio Example ---`);
  console.log(`Some ADRs represent multiple underlying shares:`);
  console.log(`Example: 1 ING.NYSE ADR = 2 INGA.AS shares`);
  console.log(`If dashboard uses ADR price but you own underlying shares:`);
  
  const underlyingShares = 100;
  const adrRatio = 2; // 1 ADR = 2 underlying
  const underlyingPriceEur = 10; // €10 per underlying share
  const adrPriceUsd = 18; // $18 per ADR
  const adrPriceEur = adrPriceUsd / eurUsd; // ~€16.67
  
  const correctValue = underlyingShares * underlyingPriceEur; // €1,000
  const wrongValue = underlyingShares * adrPriceEur; // €1,667
  
  const ratioError = wrongValue - correctValue;
  console.log(`\n${underlyingShares} underlying shares at €${underlyingPriceEur} = €${correctValue}`);
  console.log(`Dashboard treats as ${underlyingShares} ADRs at €${adrPriceEur.toFixed(2)} = €${wrongValue.toFixed(2)}`);
  console.log(`Error: €${ratioError.toFixed(2)} (${(ratioError/correctValue*100).toFixed(1)}%)`);
  console.log(`\n⚠️  ADR ratio issues can cause 50-200%+ discrepancies!`);
}

/**
 * Diagnose Issue #3: Combined Impact
 */
function diagnoseCombinedImpact() {
  console.log('\n' + '='.repeat(80));
  console.log('DIAGNOSIS #3: Combined Impact Estimate');
  console.log('='.repeat(80));
  
  const scenarios = [
    { name: 'Small portfolio', usdValue: 50000, fxRateChange: 0.05, adrError: 0.02 },
    { name: 'Medium portfolio', usdValue: 100000, fxRateChange: 0.08, adrError: 0.05 },
    { name: 'Large portfolio', usdValue: 200000, fxRateChange: 0.10, adrError: 0.10 },
  ];
  
  console.log('\nAssuming 50% of portfolio is in USD-denominated transactions:');
  console.log('And 30% is in EU stocks using US ADR prices\n');
  
  for (const scenario of scenarios) {
    const usdPortion = scenario.usdValue * 0.5;
    const adrPortion = scenario.usdValue * 0.3;
    
    const fxError = usdPortion * scenario.fxRateChange;
    const adrError = adrPortion * scenario.adrError;
    const totalError = fxError + adrError;
    const errorPercent = (totalError / scenario.usdValue) * 100;
    
    console.log(`${scenario.name}:`);
    console.log(`  Portfolio value: $${scenario.usdValue}`);
    console.log(`  FX rate error: €${fxError.toFixed(0)}`);
    console.log(`  ADR price error: €${adrError.toFixed(0)}`);
    console.log(`  Total error: €${totalError.toFixed(0)} (${errorPercent.toFixed(1)}%)`);
    console.log('');
  }
  
  console.log('⚠️  A €10,000+ discrepancy is EASILY explained by these issues!');
}

/**
 * Analyze your actual transaction data
 */
async function analyzeActualData() {
  console.log('\n' + '='.repeat(80));
  console.log('DIAGNOSIS #4: Your Actual Data Analysis');
  console.log('='.repeat(80));
  
  try {
    console.log('\nParsing your transaction CSV...');
    
    const transactions = parseTransactionsCsv(testCsv, testPortfolioConfig);
    
    console.log(`\nFound ${transactions.length} transactions:`);
    for (const txn of transactions) {
      console.log(`  ${txn.date.toISOString().split('T')[0]}: ${txn.quantity} ${txn.ticker} @ €${txn.price.toFixed(2)} = €${(txn.quantity * txn.price).toFixed(2)}`);
    }
    
    console.log('\n⚠️  IMPORTANT: Check if the EUR values above match your source app!');
    console.log('   If they differ, it is the FX rate issue (Issue #1).');
    
    // Check for potential issues
    console.log('\nChecking for potential issues...');
    for (const txn of transactions) {
      if (txn.currency !== testPortfolioConfig.currency) {
        console.log(`  ℹ️  Transaction in ${txn.currency}, converted to ${testPortfolioConfig.currency}`);
        console.log(`     This uses CURRENT exchange rate, which may be incorrect!`);
      }
    }
    
    // Check instruments
    console.log('\nChecking instrument configurations...');
    for (const [ticker, instrument] of Object.entries(testPortfolioConfig.instruments)) {
      console.log(`  ${ticker}: €${instrument.currentPrice} (${instrument.name})`);
    }
    
  } catch (error) {
    console.error('Error analyzing data:', error);
  }
}

// ============================================================================
// RUN DIAGNOSTICS
// ============================================================================

async function main() {
  console.log('Portfolio Value Discrepancy Diagnostic Tool');
  console.log('='.repeat(80));
  console.log('This tool helps identify why your dashboard shows >10k difference');
  console.log('from your source transaction app.\n');
  
  diagnoseFxRateIssue();
  diagnoseAdrIssue();
  diagnoseCombinedImpact();
  await analyzeActualData();
  
  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY & RECOMMENDATIONS');
  console.log('='.repeat(80));
  
  console.log(`
🔴 CRITICAL ISSUES (Fix these FIRST):

1. HISTORICAL FX RATES
   - Your parser uses CURRENT exchange rates for HISTORICAL transactions
   - This can cause 5-20%+ errors depending on FX rate movements
   - FIX: Store historical FX rates or fetch rates for each transaction date

2. US ADR SYMBOLS
   - If you're using US symbols (AAPL, MSFT) for EU stocks (ASML.AS, IEV.AS)
   - Prices can differ by 10-50%+ due to ADR ratios and market differences
   - FIX: Use the EXACT same tickers as in your source app
   - Check portfolio.yml for quote_symbol overrides

🟡 SECONDARY ISSUES:

3. CURRENT PRICES
   - Verify your dashboard is using the same price source as your app
   - Check if prices are from the same timestamp

4. FEE CALCULATIONS
   - Fees are also converted using current FX rates
   - Usually <1% impact unless you have very high fees

📊 NEXT STEPS:

1. Fill in your actual transaction data in this script
2. Run: npx tsx diagnose-discrepancy.ts
3. Check the output for specific errors
4. Fix the FX rate issue first (highest impact)
5. Then verify all symbol mappings
6. Finally, check price sources
`);
}

main().catch(console.error);
