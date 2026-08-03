# Investment Dashboard

A local-first investment dashboard. It reads transaction history and portfolio configuration files selected from your computer. Nothing is uploaded and this repository contains no personal financial data.

## Run locally

```bash
npm install
npm run dev
```

Create a production build with `npm run build`.

## Load your files

Select a transaction CSV and your private `portfolio.yml`, then choose **Build dashboard**. Both files are parsed only in the browser and are not stored or committed. `portfolio.yml` is ignored by Git; start with `portfolio.example.yml`.

## Transaction CSV format

The importer expects these columns, in this exact order:

```csv
Symbol,Date,Quantity,Price,Price Currency,Fees Percentage,Fees Amount,Fees Currency
VWCE,2025-01-10,10,120.50,EUR,0,0,EUR
VWCE,2025-02-10,-2,125.00,EUR,0,0,EUR
```

- A positive `Quantity` is a buy; a negative `Quantity` is a sell.
- `Price Currency` and `Fees Currency` must equal the configured YAML currency because exchange-rate assumptions are not implemented.
- `Fees Percentage` and `Fees Amount` are imported; the fee amount is displayed. Its financial treatment is not inferred because the project formulas do not specify one.

## portfolio.yml format

```yaml
currency: EUR
instruments:
  VWCE:
    name: Vanguard FTSE All-World UCITS ETF
    currentPrice: 132.45
```

`currentPrice` is required for every open instrument. The app contains no embedded portfolio values.

## Scope

Implemented: import, normalization, average-cost reconstruction, realized and unrealized gains, foundation KPIs, holdings, transaction history, allocation, and top-holdings charts. Forecasting, benchmarks, Monte Carlo, tax, dividends, and advanced analytics are deferred.
