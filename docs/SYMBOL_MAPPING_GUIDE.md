# Symbol Mapping Guide for Twelve Data & Yahoo Finance APIs

## Overview

This guide helps you map your portfolio tickers to the correct symbols for **Twelve Data** and **Yahoo Finance** APIs, ensuring accurate price fetching.

**Your Issue**: Your portfolio.yml has several `quote_symbol` overrides that map to **wrong exchanges**, causing price discrepancies.

---

## 🔴 **CRITICAL: Fix These in Your portfolio.yml**

Based on your diagnostic output, these mappings are **INCORRECT**:

### Hong Kong Stocks

| Your Ticker | Current quote_symbol | Issue | Correct Symbol (Yahoo) | Correct Symbol (Twelve Data) |
|-------------|---------------------|-------|------------------------|-------------------------------|
| `700.HK` | `TCEHY` | TCEHY is OTC ADR (US), NOT HKEX | `0700.HK` or `700.HK` | `0700:HKEX` |
| `NNND.F` | `TCEHY` | Same issue as above | `0700.HK` or `700.HK` | `0700:HKEX` |

**Why this matters**: 
- TCEHY (OTC ADR) trades at a different price than 700.HK (HKEX)
- ADR prices can differ by 5-15% due to market dynamics, fees, and timing
- **This alone can cause thousands in discrepancy!**

### Frankfurt ETFs (UCITS)

| Your Ticker | Current quote_symbol | Issue | Correct Symbol (Yahoo) | Correct Symbol (Twelve Data) |
|-------------|---------------------|-------|------------------------|-------------------------------|
| `VHYL.AS` | `VYM` | VYM is US ETF (Vanguard High Dividend Yield) | `VHYL.AS` | `VHYL:AS` |
| `IWDA.AS` | `URTH` | URTH is US ETF (iShares MSCI World) | `IWDA.AS` | `IWDA:AS` |
| `VGWD.F` | `VYM` | VYM is US ETF | `VGWD.DE` or `VGWD.F` | `VGWD:GR` |
| `AMEW.F` | `URTH` | URTH is US ETF | `AMEW.DE` or `AMEW.F` | `AMEW:GR` |
| `IUSN.F` | `VSS` | VSS is US ETF | `IUSN.DE` or `IUSN.F` | `IUSN:GR` |
| `VWCE.F` | `VT` | VT is US ETF (Vanguard Total World) | `VWCE.DE` or `VWCE.F` | `VWCE:GR` |

**Why this matters**:
- US ETFs (VYM, URTH, VT) and EU UCITS ETFs (VHYL.AS, IWDA.AS) are **different products**
- They track similar but not identical indices
- They have different expense ratios
- **Prices can differ by 5-20%!**

### US Stocks

| Your Ticker | Current quote_symbol | Issue | Correct Symbol |
|-------------|---------------------|-------|----------------|
| `NVD.F` | `NVDA` | NVD.F is Frankfurt, NVDA is NASDAQ | `NVDA` (if you own NASDAQ) or `NVD.F` (if you own Frankfurt) |

**Clarify**: Do you own NVDA (NASDAQ) or NVD.F (Frankfurt)? These are different:
- NVDA: NVIDIA stock on NASDAQ
- NVD.F: NVIDIA stock on Frankfurt (same company, different exchange, may have different price)

### Crypto

| Your Ticker | Current quote_symbol | Issue | Correct Symbol (CoinGecko) |
|-------------|---------------------|-------|-----------------------------|
| `BTC.CRYPTO` | `BTC/USD` | Using USD pair with EUR base currency | `BTC` (CoinGecko ID: bitcoin) |
| `ETH.CRYPTO` | `ETH/USD` | Using USD pair with EUR base currency | `ETH` (CoinGecko ID: ethereum) |

**Why this matters**:
- Your base currency is EUR
- Using BTC/USD means: fetch BTC/USD price, then convert USD to EUR
- This adds an extra conversion step that can introduce errors
- **Better**: Use BTC-EUR pair directly, or just BTC (CoinGecko returns EUR price)

---

## ✅ **Recommended portfolio.yml Fixes**

### For Hong Kong Stocks

```yaml
assets:
  "700.HK":
    name: Tencent Holdings
    quote_symbol: "0700.HK"  # Yahoo Finance
    # quote_symbol: "0700:HKEX"  # Twelve Data
```

### For Frankfurt ETFs

```yaml
assets:
  "VHYL.AS":
    name: Vanguard FTSE All-World High Dividend Yield UCITS ETF
    # NO quote_symbol override needed - use native symbol
    # Or if needed:
    quote_symbol: "VHYL.AS"  # Yahoo
    # quote_symbol: "VHYL:AS"  # Twelve Data

  "IWDA.AS":
    name: iShares MSCI World UCITS ETF
    quote_symbol: "IWDA.AS"  # Yahoo
    # quote_symbol: "IWDA:AS"  # Twelve Data

  "VWCE.F":
    name: Vanguard FTSE All-World UCITS ETF
    quote_symbol: "VWCE.DE"  # Yahoo (Frankfurt)
    # quote_symbol: "VWCE:GR"  # Twelve Data (GR = Germany/Frankfurt)

  "VGWD.F":
    name: Vanguard FTSE Developed World UCITS ETF
    quote_symbol: "VGWD.DE"  # Yahoo
    # quote_symbol: "VGWD:GR"  # Twelve Data

  "AMEW.F":
    name: Amundi MSCI EM UCITS ETF
    quote_symbol: "AMEW.DE"  # Yahoo
    # quote_symbol: "AMEW:GR"  # Twelve Data

  "IUSN.F":
    name: iShares MSCI USA UCITS ETF
    quote_symbol: "IUSN.DE"  # Yahoo
    # quote_symbol: "IUSN:GR"  # Twelve Data
```

### For US Stocks

```yaml
assets:
  "NVDA":
    name: NVIDIA Corporation
    # NO quote_symbol needed - NVDA is standard

  "AAPL":
    name: Apple Inc
    # NO quote_symbol needed

  "AMZN":
    name: Amazon.com Inc
    # NO quote_symbol needed
```

### For Crypto

```yaml
assets:
  "BTC.CRYPTO":
    name: Bitcoin
    # NO quote_symbol needed - CoinGecko uses "BTC"
    # Or explicitly:
    quote_symbol: "BTC"

  "ETH.CRYPTO":
    name: Ethereum
    quote_symbol: "ETH"
```

---

## 📊 **API-Specific Symbol Formats**

### Yahoo Finance

| Exchange | Format | Examples |
|----------|--------|----------|
| NASDAQ/NYSE | `{TICKER}` | AAPL, MSFT, AMZN, NVDA |
| Euronext Amsterdam | `{TICKER}.AS` | ASML.AS, IWDA.AS, VHYL.AS |
| Frankfurt | `{TICKER}.DE` or `{TICKER}.F` | VWCE.DE, VWCE.F, AMEW.DE |
| Hong Kong | `{TICKER}.HK` | 0700.HK, 700.HK |
| London | `{TICKER}.L` | LLoyd.L, BP.L |
| XETRA | `{TICKER}.DE` | LYP6.DE (for LYP6.XETRA) |

**Note**: Yahoo Finance has rate limits. Your code already has fallback to Twelve Data.

### Twelve Data

| Exchange | Format | Examples |
|----------|--------|----------|
| NASDAQ/NYSE | `{TICKER}` | AAPL, MSFT, AMZN |
| Euronext Amsterdam | `{TICKER}:AS` | ASML:AS, IWDA:AS |
| Frankfurt | `{TICKER}:GR` | VWCE:GR, AMEW:GR |
| Hong Kong | `{TICKER}:HKEX` | 0700:HKEX |
| London | `{TICKER}:L` | Lloyd:L |
| XETRA | `{TICKER}:GR` | LYP6:GR |

**Note**: Twelve Data free tier has limitations:
- 8 requests per second
- 800 requests per day
- Does NOT support all EU markets for free (use suffixes like :AS, :GR, :L)

### CoinGecko (for Crypto)

| Asset | CoinGecko ID | Symbol |
|-------|---------------|--------|
| Bitcoin | `bitcoin` | BTC |
| Ethereum | `ethereum` | ETH |

**Note**: CoinGecko returns prices in EUR directly when you specify `vs_currencies=eur`

---

## 🎯 **Action Plan**

### Step 1: Fix Critical Symbol Mappings
Remove or correct these overrides in portfolio.yml:

```yaml
# REMOVE or FIX these:
"700.HK":
  quote_symbol: "TCEHY"  # WRONG - use "0700.HK" or "700.HK"

"VHYL.AS":
  quote_symbol: "VYM"  # WRONG - use "VHYL.AS" or remove

"IWDA.AS":
  quote_symbol: "URTH"  # WRONG - use "IWDA.AS" or remove

"VGWD.F":
  quote_symbol: "VYM"  # WRONG - use "VGWD.DE" or remove

"AMEW.F":
  quote_symbol: "URTH"  # WRONG - use "AMEW.DE" or remove

"IUSN.F":
  quote_symbol: "VSS"  # WRONG - use "IUSN.DE" or remove

"VWCE.F":
  quote_symbol: "VT"  # WRONG - use "VWCE.DE" or remove

"NVD.F":
  quote_symbol: "NVDA"  # CLARIFY - do you own NVDA or NVD.F?

"BTC.CRYPTO":
  quote_symbol: "BTC/USD"  # Use "BTC" instead

"ETH.CRYPTO":
  quote_symbol: "ETH/USD"  # Use "ETH" instead

"NNND.F":
  quote_symbol: "TCEHY"  # Same as 700.HK issue

"LYP6.XETRA":
  quote_symbol: "IEUR"  # WRONG - IEUR is a different ETF
```

### Step 2: Verify Exchange Rates
Ensure your portfolio.yml has exchange rates for all currencies:

```yaml
exchange_rates:
  EUR: 1
  USD: 0.92    # Current EUR/USD
  HKD: 0.115   # Current EUR/HKD (1 HKD = 0.115 EUR)
  # BTC and ETH don't need exchange rates - they use price directly
```

### Step 3: Test with Diagnostic
After fixing, run:
```bash
npx tsx diagnose-discrepancy.ts
```

Check that:
- All currencies (EUR, USD, HKD, BTC, ETH) are detected
- No WARNING messages about symbol mappings
- Parsed values match your source app

---

## 📞 **Need More Help?**

If you're unsure about any specific symbol, check:
1. **Yahoo Finance**: Go to finance.yahoo.com and search for your ticker
2. **Twelve Data**: Check their symbol lookup API
3. **Your broker**: What symbol does your broker use?

**Rule of thumb**: Use the **exact same symbol** as in your source transaction app.
