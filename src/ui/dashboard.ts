import { parsePortfolioStructure } from "../core/config";
import { calculateDashboard } from "../core/calculations";
import { buildPortfolioConfig, fetchMarketSnapshot } from "../core/market-data";
import { parseTransactionsCsv, scanTransactionsCsv } from "../core/parser";
import { reconstructPortfolio } from "../core/portfolio";
import type { DashboardModel } from "../core/types";
import { formatCurrency, formatPercent } from "../utils/format";
import { renderCharts } from "./charts";
import { renderHoldingsTable, renderTransactionsTable } from "./tables";
import { valueTone } from "./theme";

/** Mounts the local-only dashboard and file import workflow. */
export function mountDashboard(root: HTMLElement): void {
  root.className = "app";
  root.replaceChildren(header(), onboarding());
  root.addEventListener("click", async (e) => {
    if ((e.target as HTMLElement).id !== "load") return;
    const csv = root.querySelector<HTMLInputElement>("#csv")?.files?.[0];
    const yml = root.querySelector<HTMLInputElement>("#yml")?.files?.[0];
    if (!csv || !yml) return replace(root, onboarding("Choose both a transaction CSV and portfolio.yml."));

    replace(root, loading("Fetching live prices — this can take ~1–2 minutes on first load due to API rate limits…"));
    try {
      const csvText = await csv.text();
      const structure = parsePortfolioStructure(await yml.text());
      const scan = scanTransactionsCsv(csvText);
      const tickers = Object.keys(structure.assets);
      const market = await fetchMarketSnapshot(structure, tickers, scan.currencies);
      const config = buildPortfolioConfig(structure, market);
      const state = reconstructPortfolio(parseTransactionsCsv(csvText, config), config);
      const model = calculateDashboard(state, config.currency);
      replace(root, view(model, market.fetchedAt));
    } catch (error) {
      replace(root, onboarding(error instanceof Error ? error.message : "The files could not be loaded."));
    }
  });
}

function header(): HTMLElement {
  const h = document.createElement("header");
  h.innerHTML = "<p>LOCAL-FIRST PORTFOLIO ANALYTICS</p><h1>Investment Dashboard</h1><small>Your selected files stay in this browser.</small>";
  return h;
}

function onboarding(error?: string): HTMLElement {
  const s = document.createElement("section");
  s.className = "panel onboarding";
  s.innerHTML = `<h2>Load your local files</h2><p>Select a transaction CSV and portfolio.yml. Live prices and FX rates are fetched automatically and converted to EUR.</p>${error ? `<p class=error>${escape(error)}</p>` : ""}<label>Transactions CSV<input id=csv type=file accept=".csv,text/csv"></label><label>portfolio.yml<input id=yml type=file accept=".yml,.yaml,text/yaml"></label><button id=load>Build dashboard</button>`;
  return s;
}

function loading(message: string): HTMLElement {
  const s = document.createElement("section");
  s.className = "panel onboarding";
  s.innerHTML = `<h2>Loading market data</h2><p>${escape(message)}</p>`;
  return s;
}

function replace(root: HTMLElement, c: HTMLElement): void {
  root.replaceChildren(header(), c);
}

function view(m: DashboardModel, fetchedAt: Date): HTMLElement {
  const d = document.createElement("div");
  d.className = "dashboard";
  d.append(
    marketNote(fetchedAt),
    cards(m),
    renderCharts(m.allocation, m.topHoldings, m.currency),
    renderHoldingsTable(m.holdings, m.currency),
    renderTransactionsTable(m.transactions, m.currency),
  );
  return d;
}

function marketNote(fetchedAt: Date): HTMLElement {
  const s = document.createElement("section");
  s.className = "panel";
  s.innerHTML = `<p class=empty>Prices and exchange rates fetched at ${fetchedAt.toLocaleString()} (EUR).</p>`;
  return s;
}

function cards(m: DashboardModel): HTMLElement {
  const x = m.metrics;
  const items: [string, string, number][] = [
    ["Portfolio Value", formatCurrency(x.portfolioValue, m.currency), 0],
    ["Cost Basis", formatCurrency(x.costBasis, m.currency), 0],
    ["Unrealized Gain (€)", formatCurrency(x.unrealizedGain, m.currency), x.unrealizedGain],
    ["Unrealized Gain (%)", formatPercent(x.unrealizedGainPercent), x.unrealizedGainPercent],
    ["Realized Gain", formatCurrency(x.realizedGain, m.currency), x.realizedGain],
    ["Total Gain", formatCurrency(x.totalGain, m.currency), x.totalGain],
    ["Net Invested Capital", formatCurrency(x.netInvestedCapital, m.currency), 0],
    ["Number of Holdings", String(x.numberOfHoldings), 0],
  ];
  const s = document.createElement("section");
  s.className = "metrics";
  s.innerHTML = items.map((i) => `<article><p>${i[0]}</p><b class=${valueTone(i[2])}>${i[1]}</b></article>`).join("");
  return s;
}

function escape(v: string): string {
  const e = document.createElement("span");
  e.textContent = v;
  return e.innerHTML;
}
