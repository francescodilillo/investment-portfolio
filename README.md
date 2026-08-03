# Investment Dashboard

A local-first investment dashboard. It reads transaction history and portfolio configuration files selected from your computer, reconstructs open positions with the documented average-cost method, and displays foundation KPIs. Nothing is uploaded and this repository contains no personal financial data.

## Run locally

```bash
npm install
npm run dev
```

Create a production build with `npm run build`.

## Load your files

Select a transaction CSV and your private `portfolio.yml`, then choose **Build dashboard**. Both files are parsed only in the browser and are not stored or committed. `portfolio.yml` is ignored by Git; start with `portfolio.example.yml`.

## Transaction CSV format

Headers are case- and space-insensitive:

```csv
date,instrument,action,quantity,price,currency,broker,fees
2025-01-10,VWCE,BUY,10,120.50,EUR,Example Broker,0
2025-02-10,VWCE,SELL,2,125.00,EUR,Example Broker,0
```

Dates use `YYYY-MM-DD`. Supported actions are `BUY`, `SELL`, `CONTRIBUTION`, `WITHDRAWAL`, and `EMPLOYER_EQUITY`; map broker-specific labels through `actionAliases`. All transaction currencies must equal the configured YAML currency because exchange-rate assumptions are not implemented. Fees are displayed as source data; their financial treatment is not inferred because it is not documented in the project formulas.

## portfolio.yml format

Current prices and portfolio-specific assumptions stay in your local YAML file:

```yaml
currency: EUR
instruments:
  VWCE:
    name: Vanguard FTSE All-World UCITS ETF
    currentPrice: 132.45
actionAliases:
  PURCHASE: BUY
```

`currentPrice` is required for every open instrument. The app contains no embedded portfolio values.

## Scope

Implemented: import, normalization, average-cost reconstruction, realized and unrealized gains, foundation KPIs, holdings, transaction history, allocation, and top-holdings charts. Forecasting, benchmarks, Monte Carlo, tax, dividends, and advanced analytics are deferred.
