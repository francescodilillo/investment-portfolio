# Investment Dashboard

A local-first investment dashboard: files stay in the browser and are never uploaded.

## Run

```bash
npm install
npm run dev
```

## Local files

Select your broker CSV and private `portfolio.yml`.

The CSV headers are: `Symbol, Date, Quantity, Price, Price Currency, Fees Percentage, Fees Amount, Fees Currency`. Positive quantity is a buy and negative quantity is a sell. Dates use `DD/MM/YYYY`.

Your YAML follows the documented structure:

```yaml
portfolio:
  base_currency: EUR
assets:
  "700.HK":
    name: Tencent Holdings
current_prices:
  "700.HK":
    value: 419
    currency: HKD
exchange_rates:
  HKD: 0.12 # EUR value of one HKD; use your local assumption
```

Current prices and exchange rates are local portfolio assumptions. The app requires a `current_prices` entry for each open asset and an `exchange_rates` entry for every non-base currency. No portfolio values are embedded in the application.
