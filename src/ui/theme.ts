/** Returns a presentation-only tone for a value. */
export function valueTone(value:number):string{return value>0?"positive":value<0?"negative":"neutral";}
