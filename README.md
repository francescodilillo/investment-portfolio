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

Your YAML defines assets only — prices and exchange rates are fetched automatically:

```yaml
portfolio:
  base_currency: EUR
assets:
  "700.HK":
    name: Tencent Holdings
    quote_symbol: "0700.HK"  # optional Yahoo Finance override
```

When the dashboard loads, it fetches:

- **Stock prices** from Yahoo Finance (via a local dev proxy)
- **Crypto prices (BTC, ETH)** from [CoinGecko](https://www.coingecko.com/)
- **Exchange rates** from [Frankfurter](https://www.frankfurter.app/) (ECB reference rates)

All values are converted to EUR before calculations run.

### Manual overrides (optional)

You can still pin prices or rates in `portfolio.yml` if you prefer:

```yaml
current_prices:
  "700.HK":
    value: 419
    currency: HKD
exchange_rates:
  HKD: 0.12
```

Manual entries take precedence over live data for that asset or currency.

### Symbol mapping

Hong Kong tickers like `700.HK` are automatically mapped to Yahoo's `0700.HK`. Use `quote_symbol` in YAML when automatic mapping does not work.
