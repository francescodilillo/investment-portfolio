import type { NormalizedTransaction, PortfolioConfig, TransactionAction } from "./types";

const REQUIRED_COLUMNS = ["date", "instrument", "action", "quantity", "price", "currency", "broker", "fees"] as const;
const DEFAULT_ACTIONS: Record<string, TransactionAction> = { BUY: "BUY", SELL: "SELL", CONTRIBUTION: "CONTRIBUTION", WITHDRAWAL: "WITHDRAWAL", EMPLOYER_EQUITY: "EMPLOYER_EQUITY" };

/** Parses transaction CSV content into normalized, chronologically ordered transactions. */
export function parseTransactionsCsv(source: string, config: PortfolioConfig): NormalizedTransaction[] {
  const rows = parseCsv(source);
  if (rows.length < 2) throw new Error("The CSV must contain a header row and at least one transaction.");
  const headers = rows[0].map(normalizeHeader);
  const indexes = requiredIndexes(headers);
  const transactions = rows.slice(1).filter((row) => row.some((value) => value.trim() !== "")).map((row, rowIndex) => {
    const line = rowIndex + 2;
    const get = (column: keyof typeof indexes) => row[indexes[column]]?.trim() ?? "";
    const ticker = get("instrument").toUpperCase();
    const action = resolveAction(get("action"), config, line);
    const currency = get("currency").toUpperCase();
    if (currency !== config.currency) throw new Error(`Row ${line}: ${currency} cannot be calculated without an exchange-rate assumption in portfolio.yml.`);
    return { id: `transaction-${line}`, date: parseDate(get("date"), line), ticker, name: config.instruments[ticker]?.name ?? ticker, action,
      quantity: parsePositiveNumber(get("quantity"), "quantity", line), price: parseNonNegativeNumber(get("price"), "price", line),
      fees: parseNonNegativeNumber(get("fees"), "fees", line), currency, broker: get("broker") };
  });
  return transactions.sort((left, right) => left.date.getTime() - right.date.getTime());
}
/** Converts a CSV string into rows while supporting quoted fields and comma or semicolon delimiters. */
export function parseCsv(source: string): string[][] {
  const delimiter = source.split("\n")[0]?.includes(";") ? ";" : ",";
  const rows: string[][] = []; let row: string[] = []; let cell = ""; let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === '"') { if (quoted && source[index + 1] === '"') { cell += '"'; index += 1; } else quoted = !quoted; }
    else if (character === delimiter && !quoted) { row.push(cell); cell = ""; }
    else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && source[index + 1] === "\n") index += 1;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += character;
  }
  if (quoted) throw new Error("The CSV contains an unclosed quoted field.");
  if (cell !== "" || row.length > 0) { row.push(cell); rows.push(row); }
  return rows;
}
function normalizeHeader(value: string): string { return value.trim().toLowerCase().replace(/[^a-z0-9]/g, ""); }
function requiredIndexes(headers: string[]): Record<(typeof REQUIRED_COLUMNS)[number], number> {
  const aliases: Record<(typeof REQUIRED_COLUMNS)[number], string[]> = {
    date: ["date"], instrument: ["instrument", "ticker"], action: ["action", "buysell", "transactiontype"],
    quantity: ["quantity"], price: ["price"], currency: ["currency"], broker: ["broker"], fees: ["fees", "fee"],
  };
  const result = {} as Record<(typeof REQUIRED_COLUMNS)[number], number>;
  for (const column of REQUIRED_COLUMNS) {
    const index = headers.findIndex((header) => aliases[column].includes(header));
    if (index < 0) throw new Error(`CSV is missing required column: ${column}.`);
    result[column] = index;
  }
  return result;
}
function resolveAction(value: string, config: PortfolioConfig, line: number): TransactionAction {
  const key = value.trim().toUpperCase(); const action = config.actionAliases?.[key] ?? DEFAULT_ACTIONS[key];
  if (!action) throw new Error(`Row ${line}: unsupported action "${value}". Add an actionAliases entry in portfolio.yml if needed.`);
  return action;
}
function parseDate(value: string, line: number): Date {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) throw new Error(`Row ${line}: invalid date "${value}". Use YYYY-MM-DD.`);
  return date;
}
function parsePositiveNumber(value: string, field: string, line: number): number { const number = parseNumber(value, field, line); if (number <= 0) throw new Error(`Row ${line}: ${field} must be greater than zero.`); return number; }
function parseNonNegativeNumber(value: string, field: string, line: number): number { const number = parseNumber(value, field, line); if (number < 0) throw new Error(`Row ${line}: ${field} cannot be negative.`); return number; }
function parseNumber(value: string, field: string, line: number): number {
  const number = Number(value.replace(/\s/g, "").replace(/,(?=\d{1,2}$)/, "."));
  if (!Number.isFinite(number)) throw new Error(`Row ${line}: ${field} must be a finite number.`);
  return number;
}
