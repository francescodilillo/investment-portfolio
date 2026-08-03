import type { NormalizedTransaction } from "./types";
/** Groups transactions for the later historical snapshot iteration. */
export function groupTransactionsByMonth(transactions: NormalizedTransaction[]): Map<string, NormalizedTransaction[]> {
 const months=new Map<string,NormalizedTransaction[]>(); for(const transaction of transactions){const key=transaction.date.toISOString().slice(0,7); const list=months.get(key)??[]; list.push(transaction); months.set(key,list);} return months;
}
