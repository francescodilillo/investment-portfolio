import {parse} from "yaml"; import type {InstrumentConfig,PortfolioConfig} from "./types";
/** Parses the authoritative local portfolio.yml format, including base currency, assets, prices, and exchange rates. */
export function parsePortfolioConfig(source:string):PortfolioConfig {
 const raw=parse(source) as Record<string,unknown>; if(!record(raw)||!record(raw.portfolio))throw new Error("portfolio.yml must contain a portfolio mapping.");
 const currency=text(raw.portfolio.base_currency,"portfolio.base_currency").toUpperCase();
 const rates:Record<string,number>={[currency]:1}; if(raw.exchange_rates!==undefined){if(!record(raw.exchange_rates))throw new Error("exchange_rates must be a mapping.");for(const [code,value] of Object.entries(raw.exchange_rates)){const rate=num(value,`exchange_rates.${code}`);if(rate<=0)throw new Error(`exchange_rates.${code} must be positive.`);rates[code.toUpperCase()]=rate;}}
 if(!record(raw.assets))throw new Error("portfolio.yml must contain an assets mapping.");
 if(!record(raw.current_prices))throw new Error("portfolio.yml must contain a current_prices mapping.");
 const instruments:Record<string,InstrumentConfig>={};
 for(const [ticker,asset] of Object.entries(raw.assets)){if(!record(asset))throw new Error(`assets.${ticker} must be a mapping.`);const price=raw.current_prices[ticker];if(!record(price))throw new Error(`current_prices.${ticker} is required.`);const code=text(price.currency,`current_prices.${ticker}.currency`).toUpperCase(),rate=rates[code];if(rate===undefined)throw new Error(`An exchange_rates.${code} value is required.`);instruments[ticker.toUpperCase()]={name:typeof asset.name==="string"?asset.name:ticker,currentPrice:num(price.value,`current_prices.${ticker}.value`)*rate};}
 return {currency,instruments,exchangeRates:rates};
}
function record(v:unknown):v is Record<string,unknown>{return typeof v==="object"&&v!==null&&!Array.isArray(v);}function text(v:unknown,field:string):string{if(typeof v!=="string"||!v.trim())throw new Error(`${field} must be a non-empty string.`);return v.trim();}function num(v:unknown,field:string):number{if(typeof v!=="number"||!Number.isFinite(v))throw new Error(`${field} must be a finite number.`);return v;}
