# Investigation: 10k+ Portfolio Value Discrepancy

## Problem Statement
Dashboard shows >10k difference compared to ground truth from source transaction app.

## Root Cause Analysis

### CRITICAL ISSUE #1: Historical FX Rate Problem

**Location**: `src/core/parser.ts` lines 27-28

**Issue**: The parser applies **current** exchange rates to **historical** transactions.

```typescript
// Current code (WRONG):
price:number(g("price"),line,"price")*pr,  // Uses today's EUR/USD rate
fees:number(g("feesamount"),line,"fees amount")*fr,  // Uses today's EUR/USD rate
```

**Impact**: If exchange rates have moved significantly since your purchase dates, this creates a systematic error in your cost basis calculation.

**Examples**: 
- EUR/USD: Bought $10,000 when EUR/USD = 1.10, today = 1.05 → Error: ~€433 per transaction
- EUR/HKD: Bought HKD 100,000 when EUR/HKD = 8.5, today = 8.8 → Error: ~€380 per transaction
- BTC/EUR: Bought 1 BTC when BTC/EUR = 40,000, today = 50,000 → Error: ~€10,000 on cost basis
- ETH/EUR: Bought 10 ETH when ETH/EUR = 2,000, today = 2,500 → Error: ~€5,000 on cost basis

**Solution Required**: Store historical FX rates or fetch rates for each transaction date.

---

### CRITICAL ISSUE #2: USA Equivalent Shares (ADR Problem)

**Your hypothesis**: "I'm pulling the USA equivalent of the shares I did buy"

**This is VERY LIKELY the main cause**.

**How ADRs cause discrepancies**:

1. **ADR Ratio**: Many companies have ADRs that represent multiple underlying shares
   - Example: ING Groep (INGA.AS) has ADR ING.NYSE where 1 ADR = 2 ordinary shares
   - If you bought 100 underlying shares but the dashboard uses ADR price, it's off by 2x

2. **Different Prices**: ADRs trade independently and can have different prices than underlying
   - Example: ASML.AS (Euronext) vs ASML (NASDAQ)
   - These can differ by more than 10% due to market dynamics

3. **Currency**: ADRs are USD-denominated, underlying might be EUR or HKD

**Check your portfolio.yml**: Look for `quote_symbol` overrides. If you're using US symbols for non-US stocks, this is the issue.

---

### POTENTIAL ISSUE #3: Crypto Currency Handling

**Supported currencies**: EUR, USD, HKD, BTC, ETH

**Issue**: Crypto prices (BTC, ETH) are highly volatile. Using current prices for historical transactions causes massive cost basis errors.

**Example**: 
- Bought 1 BTC at €40,000 on 2023-01-01
- Today BTC = €50,000
- Current code: Uses €50,000 for cost basis calculation (WRONG)
- Correct: Should use €40,000 for cost basis (the actual purchase price)
- **Error on cost basis: €10,000 for just 1 BTC**

**Note**: The current code in `market-data.ts` fetches crypto prices from CoinGecko, but the parser still uses current FX rates for historical transactions.

---

### POTENTIAL ISSUE #4: Hong Kong Stock Exchange (HKD) Handling

**Issue**: HKD-denominated stocks (e.g., 700.HK, 0700.HK) may have:
- Different price sources (Yahoo vs Twelve Data)
- Different symbol formats (700.HK vs 0700:HKEX)
- Currency conversion issues (HKD to EUR)

**Check**: 
- Are your HKD transactions using the correct exchange rate?
- Are the HKD stock prices being fetched correctly?
- Are symbol mappings correct in portfolio.yml?

---

## Investigation Checklist

### Step 1: Verify Symbol Mapping
```bash
# Check if you're using US symbols for non-US stocks
grep -r "quote_symbol" portfolio.yml
```

Look for any entries like:
```yaml
assets:
  "700.HK":
    quote_symbol: "0700.HK"  # This should be correct for HKEX
  "ASML.AS":
    quote_symbol: "ASML"  # This is WRONG - using NASDAQ instead of Euronext
```

### Step 2: Check Currency Handling
```bash
# Check your base currency setting
grep -A2 "base_currency" portfolio.yml

# Check exchange rates
grep -A10 "exchange_rates" portfolio.yml
```

Ensure you have exchange rates for all currencies you use: EUR, USD, HKD, BTC, ETH

### Step 3: Compare a Single Transaction

Pick one transaction in each currency (EUR, USD, HKD, BTC, ETH) and manually calculate:

1. **Source App Value**: Ask your source app for the EUR value of the transaction
2. **Dashboard Calculation**: 
   - Transaction price in original currency × quantity = local value
   - Local value × exchange rate (from portfolio.yml) = EUR value
   - Compare with source app

### Step 4: Check FX Rate Dates

```bash
# When were your major transactions?
# What was EUR/USD, EUR/HKD, BTC/EUR, ETH/EUR on those dates?
# What are they today?
```

If the difference is significant (>5%), this is contributing to the error.

---

## Recommended Fixes

### Fix 1: Add Historical FX Rate Support (HIGH PRIORITY)

Modify `parser.ts` to accept historical FX rates:

```typescript
// In PortfolioConfig interface (types.ts)
export interface PortfolioConfig {
  currency: string;
  instruments: Record<string, InstrumentConfig>;
  exchangeRates: Record<string, number>;
  historicalExchangeRates: Record<string, Record<string, number>>; // date -> currency -> rate
  actionAliases?: Record<string, TransactionAction>;
}

// In parser.ts, use historical rate for transaction date
const txnDate = transaction.date.toISOString().split('T')[0];
const historicalRate = config.historicalExchangeRates[txnDate]?.[pc];
const price = number(g("price"), line, "price") * (historicalRate || config.exchangeRates[pc]);
```

**Implementation available**: See `src/core/historical-rates.ts` and `src/core/parser-historical.ts`

### Fix 2: Verify and Correct Symbol Mappings (HIGH PRIORITY)

Ensure all stocks use their native exchange symbols:

```yaml
# CORRECT (using native exchanges)
assets:
  "700.HK":
    name: Tencent Holdings
    quote_symbol: "0700.HK"  # or "700.HK" depending on your data source
  
  "ASML.AS":
    name: ASML Holding
    quote_symbol: "ASML.AS"  # Euronext Amsterdam
  
  "AAPL":
    name: Apple Inc
    quote_symbol: "AAPL"  # NASDAQ (correct for US stocks)
```

### Fix 3: Add Exchange Rates for All Currencies (MEDIUM PRIORITY)

Ensure your portfolio.yml has exchange rates for EUR, USD, HKD, BTC, ETH:

```yaml
exchange_rates:
  EUR: 1
  USD: 0.92    # 1 USD = 0.92 EUR
  HKD: 0.115   # 1 HKD = 0.115 EUR
  BTC: 50000   # 1 BTC = 50,000 EUR (current price, but should be historical!)
  ETH: 2500    # 1 ETH = 2,500 EUR (current price, but should be historical!)
```

**Note**: For BTC and ETH, the "exchange rate" is actually the price in EUR. This is correct for the current implementation, but for historical accuracy, you need historical prices.

---

## Quick Test

To quickly verify the issues:

1. **Find your largest transaction in each currency** (EUR, USD, HKD, BTC, ETH)
2. **Check its value in your source app**
3. **Compare with dashboard value**
4. **If they differ by >5%**, you have an FX rate or symbol mapping issue

### Example Test Cases:

| Currency | Transaction | Source App Value | Dashboard Value | Difference | Issue |
|----------|-------------|------------------|-----------------|------------|-------|
| USD | $10,000 AAPL | €9,090 | €10,870 | +€1,780 | FX Rate |
| HKD | HKD 100,000 700.HK | €11,500 | €11,800 | +€300 | FX Rate |
| BTC | 1 BTC | €40,000 | €50,000 | +€10,000 | Historical Price |
| ETH | 10 ETH | €20,000 | €25,000 | +€5,000 | Historical Price |

---

## Expected Impact

Based on typical scenarios:

| Issue | Potential Impact | Likelihood | Currencies Affected |
|-------|------------------|------------|---------------------|
| Historical FX Rates | 5-20%+ difference | HIGH | USD, HKD |
| ADR Symbol Mismatch | 10-50%+ difference | HIGH | All |
| Crypto Historical Prices | 20-100%+ difference | HIGH | BTC, ETH |
| Current Price Source | 1-5% difference | MEDIUM | All |
| Fee Calculation | <1% difference | LOW | All |

**Conclusion**: The combination of historical FX rate issues (for USD, HKD) and historical price issues (for BTC, ETH) can easily explain a >10k discrepancy.
