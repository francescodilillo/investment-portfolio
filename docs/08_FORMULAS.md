# Dashboard Formulas

## Purpose

This document defines every mathematical calculation used by the dashboard.

Every KPI, chart, table and report must derive its values from these formulas.

Business rules (such as RSU treatment) are documented in `01_ASSUMPTIONS.md`.

---

# Portfolio Value

Current market value of all open positions.

```
Portfolio Value = Σ(Current Quantity × Current Market Price)
```

---

# Cost Basis

Cost basis of all currently open positions.

```
Cost Basis = Σ(Current Quantity × Average Cost)
```

Average Cost is calculated using the Average Cost Method.

---

# Unrealized Gain

```
Unrealized Gain = Portfolio Value − Cost Basis
```

---

# Unrealized Gain %

```
Unrealized Gain % = Unrealized Gain / Cost Basis
```

---

# Realized Gain

For every sale:

```
Realized Gain =
Sale Proceeds − (Average Cost × Quantity Sold)
```

Total realized gain:

```
Realized Gain = Σ(Realized Gain per Sale)
```

---

# Total Gain

```
Total Gain =
Realized Gain +
Unrealized Gain
```

---

# Net Invested Capital

```
Net Invested Capital =
External Contributions − External Withdrawals
```

Internal portfolio reallocations do not affect invested capital.

---

# External Contributions

```
External Contributions =
Σ(All external deposits into the portfolio)
```

Examples:

- Salary investments
- Cash transfers
- Bonus investments

---

# External Withdrawals

```
External Withdrawals =
Σ(All money permanently leaving the portfolio)
```

Examples:

- Apartment purchase
- Cash withdrawals
- Future house down payment

---

# Investment Return

```
Investment Return =
Portfolio Value
− Net Invested Capital
− Employer Equity
```

---

# Portfolio Weight

```
Weight =
Position Value
/
Portfolio Value
```

---

# Employer Exposure

```
Employer Exposure =
Employer Equity
/
Portfolio Value
```

---

# Asset Allocation

```
Asset Allocation =
Asset Class Value
/
Portfolio Value
```

---

# Currency Exposure

```
Currency Exposure =
Currency Value
/
Portfolio Value
```

---

# Country Exposure

```
Country Exposure =
Country Value
/
Portfolio Value
```

---

# Sector Exposure

```
Sector Exposure =
Sector Value
/
Portfolio Value
```

---

# Month-over-Month (MoM)

```
MoM % =
(Current Value − Previous Month Value)
/
Previous Month Value
```

For return calculations, external cash flows should first be removed.

---

# Quarter-over-Quarter (QoQ)

```
QoQ % =
(Current Value − Previous Quarter Value)
/
Previous Quarter Value
```

---

# Year-to-Date (YTD)

```
YTD % =
(Current Value − Start of Year Value)
/
Start of Year Value
```

Performance calculations should remove external cash flows.

---

# Year-over-Year (YoY)

```
YoY % =
(Current Value − Value One Year Ago)
/
Value One Year Ago
```

Performance calculations should remove external cash flows.

---

# Since Inception

```
Since Inception % =
Current Gain
/
Net Invested Capital
```

---

# Compound Annual Growth Rate (CAGR)

```
CAGR =
(Ending Value / Beginning Value)^(1 / Years) − 1
```

---

# Money-Weighted Return (MWR)

Calculated using XIRR.

Cash flows include:

- External Contributions
- External Withdrawals

Cash flows exclude:

- Internal trades
- Employer RSU grants

---

# Time-Weighted Return (TWR)

Calculated by geometrically linking sub-period returns after removing external cash flows.

---

# Benchmark Return

```
Benchmark Return =
(Current Benchmark Value / Initial Benchmark Value) − 1
```

---

# Alpha

```
Alpha =
Portfolio Return − Benchmark Return
```

---

# Net Worth

```
Net Worth =
Investments
+ Cash
+ Home Equity
+ Pension
− Mortgage
− Other Debt
```

---

# Home Equity

```
Home Equity =
Property Market Value
− Outstanding Mortgage
```

---

# Savings Rate

```
Savings Rate =
Annual Investments
/
Annual Net Income
```

---

# Forecast

For each projection year:

```
Ending Portfolio =
Beginning Portfolio × (1 + Expected Return)
+ Annual Contribution
```

---

# Inflation-Adjusted Portfolio

```
Real Portfolio Value =
Nominal Portfolio Value
/
(1 + Inflation)^Years
```

---

# Passive Income

```
Passive Income =
Portfolio Value × Withdrawal Rate
```

---

# Financial Independence Target

```
FI Target =
Annual Spending × 25
```

---

# Maximum Drawdown

```
Drawdown =
(Current Value − Historical Peak)
/
Historical Peak
```

Maximum Drawdown is the lowest value observed.

---

# Volatility

Standard deviation of periodic returns.

Default period:

- Monthly

Annualized using:

```
Annualized Volatility =
Monthly Volatility × √12
```

---

# Sharpe Ratio

```
Sharpe =
(Return − Risk Free Rate)
/
Volatility
```

---

# Sortino Ratio

```
Sortino =
(Return − Risk Free Rate)
/
Downside Deviation
```