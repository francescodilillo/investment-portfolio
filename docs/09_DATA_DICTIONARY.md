# Data Dictionary

## Purpose

Defines every data field used throughout the application.

Each field has:

- Name
- Type
- Unit
- Source
- Description

---

# Portfolio

## portfolio_value

Type

Number

Unit

EUR

Source

Calculated

Description

Current market value of all open positions.

---

## cost_basis

Type

Number

Unit

EUR

Source

Calculated

Description

Average-cost value of all open positions.

---

## unrealized_gain

Type

Number

Unit

EUR

Source

Calculated

Description

Portfolio Value minus Cost Basis.

---

## unrealized_gain_pct

Type

Percentage

Source

Calculated

---

## realized_gain

Type

Number

Unit

EUR

Source

Calculated

Description

Cumulative realized gains from closed transactions.

---

## total_gain

Type

Number

Unit

EUR

Source

Calculated

Description

Realized Gain + Unrealized Gain.

---

## net_invested_capital

Type

Number

Unit

EUR

Source

Calculated

Description

External Contributions minus External Withdrawals.

---

## employer_equity

Type

Number

Unit

EUR

Source

Calculated

Description

Current value of employer-granted RSUs.

---

## external_contributions

Type

Number

Unit

EUR

Source

Calculated

Description

Money entering the portfolio from outside.

---

## external_withdrawals

Type

Number

Unit

EUR

Source

Calculated

Description

Money permanently leaving the portfolio.

---

# Position

## ticker

Type

String

Example

VWCE

---

## name

Type

String

---

## asset_class

Type

Enum

Possible values

- ETF
- Stock
- Crypto
- Cash
- Bond
- RSU

---

## sector

Type

String

---

## country

Type

String

---

## currency

Type

String

ISO-4217 currency code.

---

## broker

Type

String

---

## quantity

Type

Decimal

---

## average_cost

Type

Number

Unit

EUR

---

## current_price

Type

Number

Unit

EUR

---

## market_value

Type

Number

Unit

EUR

---

## weight

Type

Percentage

---

## holding_period

Type

Duration

---

# Performance

## mom_return

Percentage

---

## qoq_return

Percentage

---

## ytd_return

Percentage

---

## yoy_return

Percentage

---

## cagr

Percentage

---

## twr

Percentage

---

## mwr

Percentage

---

## xirr

Percentage

---

## benchmark_return

Percentage

---

## alpha

Percentage

---

# Forecast

## expected_return

Percentage

---

## inflation

Percentage

---

## annual_contribution

EUR

---

## retirement_age

Years

---

## withdrawal_rate

Percentage

Default

4%

---

# Tax

## box3_value

EUR

---

## actual_return

EUR

---

## realized_return

EUR

---

## unrealized_return

EUR

---

## dividend_income

EUR

---

## interest_income

EUR

---

# Net Worth

## cash

EUR

---

## investments

EUR

---

## home_value

EUR

---

## home_equity

EUR

---

## mortgage

EUR

---

## pension

EUR

---

## total_net_worth

EUR

Computed from all assets and liabilities.

---

# Metadata

## report_date

Date

---

## price_timestamp

Datetime

---

## transaction_count

Integer

---

## portfolio_currency

String

Default

EUR

---

## dashboard_version

String

Semantic Versioning (SemVer).