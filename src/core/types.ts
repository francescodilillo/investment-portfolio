export type TransactionAction = "BUY" | "SELL" | "CONTRIBUTION" | "WITHDRAWAL" | "EMPLOYER_EQUITY";
export interface NormalizedTransaction { id:string;date:Date;ticker:string;name:string;action:TransactionAction;quantity:number;price:number;fees:number;currency:string;broker:string; }
export interface InstrumentConfig { name?:string; currentPrice:number; }
export interface PortfolioConfig { currency:string; instruments:Record<string,InstrumentConfig>; exchangeRates:Record<string,number>; actionAliases?:Record<string,TransactionAction>; }
export interface Holding { ticker:string;name:string;quantity:number;averageCost:number;currentPrice:number;marketValue:number;unrealizedGain:number;unrealizedGainPercent:number;weight:number; }
export interface PortfolioState { holdings:Holding[];transactions:NormalizedTransaction[];realizedGain:number;externalContributions:number;externalWithdrawals:number;employerEquity:number; }
export interface DashboardMetrics { portfolioValue:number;costBasis:number;unrealizedGain:number;unrealizedGainPercent:number;realizedGain:number;totalGain:number;netInvestedCapital:number;numberOfHoldings:number; }
export interface AllocationSlice {label:string;value:number;weight:number;} export interface DashboardModel {currency:string;metrics:DashboardMetrics;holdings:Holding[];transactions:NormalizedTransaction[];allocation:AllocationSlice[];topHoldings:AllocationSlice[];}
