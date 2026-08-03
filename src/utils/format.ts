/** Formats a monetary value using the portfolio's configured currency. */
export function formatCurrency(value:number,currency:string):string{return new Intl.NumberFormat(undefined,{style:"currency",currency,maximumFractionDigits:2}).format(value);}
/** Formats a decimal ratio as a percentage. */
export function formatPercent(value:number):string{return new Intl.NumberFormat(undefined,{style:"percent",minimumFractionDigits:2,maximumFractionDigits:2}).format(value);}
/** Formats quantities without a fixed decimal precision. */
export function formatQuantity(value:number):string{return new Intl.NumberFormat(undefined,{maximumFractionDigits:8}).format(value);}
