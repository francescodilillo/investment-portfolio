import type { Holding, NormalizedTransaction, PortfolioConfig, PortfolioState } from "./types";
interface PositionAccumulator { ticker: string; name: string; quantity: number; totalCost: number; }

/** Reconstructs open positions and realized gains using the documented average-cost method. */
export function reconstructPortfolio(transactions: NormalizedTransaction[], config: PortfolioConfig): PortfolioState {
  const positions = new Map<string, PositionAccumulator>();
  let realizedGain = 0; let externalContributions = 0; let externalWithdrawals = 0; let employerEquity = 0;
  for (const transaction of transactions) {
    const amount = transaction.quantity * transaction.price;
    if (transaction.action === "CONTRIBUTION") { externalContributions += amount; continue; }
    if (transaction.action === "WITHDRAWAL") { externalWithdrawals += amount; continue; }
    if (transaction.action === "EMPLOYER_EQUITY") { employerEquity += amount; continue; }
    const position = positions.get(transaction.ticker) ?? { ticker: transaction.ticker, name: transaction.name, quantity: 0, totalCost: 0 };
    if (transaction.action === "BUY") { position.quantity += transaction.quantity; position.totalCost += amount; positions.set(transaction.ticker, position); continue; }
    if (transaction.quantity > position.quantity + Number.EPSILON) {
      throw new Error(`Cannot sell ${transaction.quantity} ${transaction.ticker} on ${transaction.date.toISOString().slice(0, 10)} because the CSV has no sufficient open quantity.`);
    }
    const averageCost = position.quantity === 0 ? 0 : position.totalCost / position.quantity;
    realizedGain += amount - averageCost * transaction.quantity;
    position.quantity -= transaction.quantity; position.totalCost -= averageCost * transaction.quantity;
    if (position.quantity <= Number.EPSILON) positions.delete(transaction.ticker); else positions.set(transaction.ticker, position);
  }
  const rawHoldings = [...positions.values()].map((position) => toHolding(position, config));
  const portfolioValue = rawHoldings.reduce((total, holding) => total + holding.marketValue, 0);
  const holdings = rawHoldings.map((holding) => ({ ...holding, weight: portfolioValue === 0 ? 0 : holding.marketValue / portfolioValue }));
  return { holdings: holdings.sort((left, right) => right.marketValue - left.marketValue), transactions, realizedGain, externalContributions, externalWithdrawals, employerEquity };
}
function toHolding(position: PositionAccumulator, config: PortfolioConfig): Holding {
  const instrument = config.instruments[position.ticker];
  if (!instrument) throw new Error(`portfolio.yml is missing an instruments.${position.ticker} entry with currentPrice.`);
  const averageCost = position.totalCost / position.quantity; const marketValue = position.quantity * instrument.currentPrice; const unrealizedGain = marketValue - position.totalCost;
  return { ticker: position.ticker, name: instrument.name ?? position.name, quantity: position.quantity, averageCost, currentPrice: instrument.currentPrice, marketValue, unrealizedGain, unrealizedGainPercent: position.totalCost === 0 ? 0 : unrealizedGain / position.totalCost, weight: 0 };
}
