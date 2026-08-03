import { parse } from "yaml";
import type { InstrumentConfig, PortfolioConfig, TransactionAction } from "./types";

const SUPPORTED_ACTIONS = new Set<TransactionAction>(["BUY", "SELL", "CONTRIBUTION", "WITHDRAWAL", "EMPLOYER_EQUITY"]);

/** Parses and validates the locally selected portfolio configuration. */
export function parsePortfolioConfig(source: string): PortfolioConfig {
  const raw: unknown = parse(source);
  if (!isRecord(raw)) throw new Error("portfolio.yml must contain a mapping at its root.");
  const currency = stringValue(raw.currency, "currency").toUpperCase();
  if (!isRecord(raw.instruments) || Object.keys(raw.instruments).length === 0) {
    throw new Error("portfolio.yml must define at least one instrument under instruments.");
  }
  const instruments: Record<string, InstrumentConfig> = {};
  for (const [ticker, value] of Object.entries(raw.instruments)) {
    if (!isRecord(value)) throw new Error(`Instrument ${ticker} must be a mapping.`);
    const currentPrice = numberValue(value.currentPrice, `instruments.${ticker}.currentPrice`);
    if (currentPrice < 0) throw new Error(`instruments.${ticker}.currentPrice cannot be negative.`);
    instruments[ticker.trim().toUpperCase()] = { currentPrice, ...(typeof value.name === "string" ? { name: value.name.trim() } : {}) };
  }
  const actionAliases = parseActionAliases(raw.actionAliases);
  return { currency, instruments, ...(actionAliases ? { actionAliases } : {}) };
}
function parseActionAliases(value: unknown): Record<string, TransactionAction> | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) throw new Error("actionAliases must be a mapping when provided.");
  const aliases: Record<string, TransactionAction> = {};
  for (const [source, target] of Object.entries(value)) {
    if (typeof target !== "string" || !SUPPORTED_ACTIONS.has(target.toUpperCase() as TransactionAction)) {
      throw new Error(`actionAliases.${source} must map to a supported action.`);
    }
    aliases[source.trim().toUpperCase()] = target.toUpperCase() as TransactionAction;
  }
  return aliases;
}
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function stringValue(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${field} must be a non-empty string.`);
  return value.trim();
}
function numberValue(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${field} must be a finite number.`);
  return value;
}
