import type { NormalizedTransaction, PortfolioConfig } from "./types";

const REQUIRED_COLUMNS = ["symbol", "date", "quantity", "price", "pricecurrency", "feespercentage", "feesamount", "feescurrency"] as const;

/** Parses the broker-export CSV into normalized, chronologically ordered transactions. */
export function parseTransactionsCsv(source: string, config: PortfolioConfig): NormalizedTransaction[] {
  const rows = parseCsv(source);
  if (rows.length < 2) throw new Error("The CSV must contain a header row and at least one transaction.");
  const indexes = requiredIndexes(rows[0].map(normalizeHeader));
  const transactions = rows.slice(1).filter((row) => row.some((value) => value.trim() !== "")).map((row, rowIndex) => {
    const line = rowIndex + 2; const get = (column: keyof typeof indexes) => row[indexes[column]]?.trim() ?? "";
    const signedQuantity = parseNonZeroNumber(get("quantity"), "quantity", line);
    const currency = get("pricecurrency").toUpperCase();
    const feeCurrency = get("feescurrency").toUpperCase();
    if (currency !== config.currency || feeCurrency !== config.currency) {
      throw new Error(`Row ${line}: price and fee currencies must equal ${config.currency}; exchange-rate assumptions are not implemented.`);
    }
    const ticker = get("symbol").toUpperCase();
    return { id: `transaction-${line}`, date: parseDate(get("date"), line), ticker, name: config.instruments[ticker]?.name ?? ticker,
      action: signedQuantity > 0 ? "BUY" : "SELL", quantity: Math.abs(signedQuantity), price: parseNonNegativeNumber(get("price"), "price", line),
      fees: parseNonNegativeNumber(get("feesamount"), "fees amount", line), currency, broker: "" };
  });
  return transactions.sort((left, right) => left.date.getTime() - right.date.getTime());
}
/** Converts CSV text into rows while supporting quoted fields and comma or semicolon delimiters. */
export function parseCsv(source: string): string[][] {
  const delimiter = source.split("\n")[0]?.includes(";") ? ";" : ","; const rows:string[][]=[]; let row:string[]=[];let cell="";let quoted=false;
  for(let index=0;index<source.length;index+=1){const character=source[index];
    if(character==='"'){if(quoted&&source[index+1]==='"'){cell+='"';index+=1;}else quoted=!quoted;}
    else if(character===delimiter&&!quoted){row.push(cell);cell="";}
    else if((character==="\n"||character==="\r")&&!quoted){if(character==="\r"&&source[index+1]==="\n")index+=1;row.push(cell);rows.push(row);row=[];cell="";}
    else cell+=character;}
  if(quoted)throw new Error("The CSV contains an unclosed quoted field.");if(cell!==""||row.length>0){row.push(cell);rows.push(row);}return rows;
}
function normalizeHeader(value:string):string{return value.trim().toLowerCase().replace(/[^a-z0-9]/g,"");}
function requiredIndexes(headers:string[]):Record<(typeof REQUIRED_COLUMNS)[number],number>{const result={} as Record<(typeof REQUIRED_COLUMNS)[number],number>;for(const column of REQUIRED_COLUMNS){const index=headers.indexOf(column);if(index<0)throw new Error(`CSV is missing required column: ${column}.`);result[column]=index;}return result;}
function parseDate(value:string,line:number):Date{const date=new Date(`${value}T00:00:00`);if(Number.isNaN(date.getTime()))throw new Error(`Row ${line}: invalid date "${value}". Use YYYY-MM-DD.`);return date;}
function parseNonZeroNumber(value:string,field:string,line:number):number{const number=parseNumber(value,field,line);if(number===0)throw new Error(`Row ${line}: ${field} cannot be zero.`);return number;}
function parseNonNegativeNumber(value:string,field:string,line:number):number{const number=parseNumber(value,field,line);if(number<0)throw new Error(`Row ${line}: ${field} cannot be negative.`);return number;}
function parseNumber(value:string,field:string,line:number):number{const number=Number(value.replace(/\s/g,"").replace(/,(?=\d{1,2}$)/,"."));if(!Number.isFinite(number))throw new Error(`Row ${line}: ${field} must be a finite number.`);return number;}
