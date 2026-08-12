# Investigation: 10k+ Portfolio Value Discrepancy

## Problem Statement
Dashboard shows >10k difference compared to ground truth from source transaction app.

## Root Cause Analysis

### 🔴 CRITICAL ISSUE #1: Historical FX Rate Problem

**Location**: `src/core/parser.ts` lines 27-28

**Issue**: The parser applies **current** exchange rates to **historical** transactions.

```typescript
// Current code (WRONG):
price:number(g("price"),line,"price")*pr,  // Uses today's EUR/USD rate
fees:number(g("feesamount"),line,"fees amount")*fr,  // Uses today's EUR/USD rate
```

**Impact**: If EUR/USD has moved significantly since your purchase dates, this creates a systematic error in your cost basis calculation.

**Example**: 
- You bought $10,000 of stock when EUR/USD = 1.10
- Today EUR/USD = 1.05
- Current code calculates: $10,000 * 1.05 = €9,523.81
- Correct calculation: $10,000 * 1.10 = €9,090.91
- **Error: €433 on this single transaction**

**Solution Required**: Store historical FX rates or fetch rates for transaction dates.

---

### 🔴 CRITICAL ISSUE #2: USA Equivalent Shares (ADR Problem)

**Your hypothesis**: "I'm pulling the USA equivalent of the shares I did buy"

**This is VERY LIKELY the main cause**.

**How ADRs cause discrepancies**:

1. **ADR Ratio**: Many EU companies have ADRs that represent multiple underlying shares
   - Example: ING Groep (INGA.AS) has ADR ING.NYSE where 1 ADR = 2 ordinary shares
   - If you bought 100 underlying shares but the dashboard uses ADR price, it's off by 2x

2. **Different Prices**: ADRs trade independently and can have different prices than underlying
   - Example: ASML.AS (Euronext) vs ASML (NASDAQ)
   - These can differ by more than 10% due to market dynamics

3. **Currency**: ADRs are USD-denominated, underlying might be EUR

**Check your portfolio.yml**: Look for `quote_symbol` overrides. If you're using US symbols for EU stocks, this is the issue.

**Solution**: Use the **exact same ticker** as in your source app, or ensure proper symbol mapping.

---

### 🟡 POTENTIAL ISSUE #3: Current Price vs Historical Price

**Location**: `src/core/portfolio.ts` line 26

```typescript
const marketValue = position.quantity * instrument.currentPrice;
```

This uses **current** prices to calculate market value, which is correct for a dashboard showing current portfolio value.

**However**: If your source app is showing a different "current" value, check:
1. Are you using the same price source?
2. Are the prices from the same timestamp?
3. Are you using bid/ask/mid prices consistently?

---

### 🟡 POTENTIAL ISSUE #4: Fee Calculation

**Location**: `src/core/parser.ts` line 28

```typescript
fees:number(g("feesamount"),line,"fees amount")*fr,
```

Fees are also converted using current FX rates. If fees were significant and EUR/USD has moved, this adds to the discrepancy.

---

## Investigation Checklist

### Step 1: Verify Symbol Mapping
```bash
# Check if you're using US symbols for EU stocks
grep -r "quote_symbol" portfolio.yml
```

Look for any entries like:
```yaml
assets:
  "ASML":
    quote_symbol: "ASML"  # This is NASDAQ, not Euronext!
```

### Step 2: Check Currency Handling
```bash
# Check your base currency setting
grep -A2 "base_currency" portfolio.yml
```

### Step 3: Compare a Single Transaction

Pick one transaction and manually calculate:

1. **Source App Value**: Ask your source app for the EUR value of one specific transaction
2. **Dashboard Calculation**: 
   - Transaction price in original currency × quantity = local value
   - Local value × exchange rate (from portfolio.yml) = EUR value
   - Compare with source app

### Step 4: Check FX Rate Dates

```bash
# When were your major transactions?
# What was EUR/USD on those dates?
# What is EUR/USD today?
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

### Fix 2: Verify and Correct Symbol Mappings (HIGH PRIORITY)

Ensure all EU stocks use their native exchange symbols:

```yaml
# WRONG (using US ADR)
assets:
  "ASML":
    name: ASML Holding
    quote_symbol: "ASML"  # NASDAQ

# CORRECT (using Euronext)
assets:
  "ASML.AS":
    name: ASML Holding
    quote_symbol: "ASML.AS"  # Euronext Amsterdam
```

### Fix 3: Add Debug Logging (MEDIUM PRIORITY)

Add logging to trace the calculation:

```typescript
// In parser.ts
console.log(`Transaction ${line}: ${ticker} ${quantity} @ ${price} ${pc} = ${amount} EUR (rate: ${pr})`);
```

---

## Quick Test

To quickly verify if it's the ADR issue:

1. Find your largest holding
2. Check its ticker in portfolio.yml
3. Compare the price from Twelve Data/Yahoo with your source app
4. If prices differ by >10%, it's a symbol mapping issue

To verify if it's the FX rate issue:

1. Calculate portfolio value using **today's** FX rates for all transactions
2. Calculate portfolio value using **historical** FX rates for each transaction
3. Compare the difference

---

## Expected Impact

Based on typical scenarios:

| Issue | Potential Impact | Likelihood |
|-------|------------------|------------|
| ADR Symbol Mismatch | 10-50% difference | HIGH |
| Historical FX Rates | 5-20% difference | HIGH |
| Current Price Source | 1-5% difference | MEDIUM |
| Fee Calculation | <1% difference | LOW |

**Conclusion**: The ADR issue and historical FX rate issue combined can easily explain a >10k discrepancy.
