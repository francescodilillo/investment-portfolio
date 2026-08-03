import type { DashboardMetrics, DashboardModel, PortfolioState } from "./types";

/** Produces UI-ready metrics and chart data from reconstructed portfolio state. */
export function calculateDashboard(state: PortfolioState, currency: string): DashboardModel {
  const portfolioValue = sum(state.holdings.map((holding) => holding.marketValue));
  const costBasis = sum(state.holdings.map((holding) => holding.quantity * holding.averageCost));
  const unrealizedGain = portfolioValue - costBasis;
  const metrics: DashboardMetrics = {
    portfolioValue, costBasis, unrealizedGain, unrealizedGainPercent: costBasis === 0 ? 0 : unrealizedGain / costBasis,
    realizedGain: state.realizedGain, totalGain: state.realizedGain + unrealizedGain,
    netInvestedCapital: state.externalContributions - state.externalWithdrawals, numberOfHoldings: state.holdings.length,
  };
  const allocation = state.holdings.map((holding) => ({ label: holding.ticker, value: holding.marketValue, weight: holding.weight }));
  return { currency, metrics, holdings: state.holdings, transactions: state.transactions, allocation, topHoldings: allocation.slice(0, 8) };
}
function sum(values: number[]): number { return values.reduce((total, value) => total + value, 0); }
