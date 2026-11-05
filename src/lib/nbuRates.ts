/**
 * Official reference currency rates from the National Bank of Ukraine.
 * Values are UAH for ONE unit of each foreign currency.
 * This cache controls display-only UAH conversion; it never changes payroll.
 */
export type NbuCurrency = 'USD' | 'EUR' | 'PLN' | 'GBP'
export type NbuRateCache = {
  checkedOn: string // Kyiv calendar date when the API request succeeded
  exchangeDate: string // the date reported by the NBU
  rates: Record<NbuCurrency,number>
}
const key='paytakt-nbu-daily-rates-v1'
const codes:readonly NbuCurrency[]=['USD','EUR','PLN','GBP']
const endpoint='https://bank.gov.ua/NBUStatService/v1/statdirectory/exchangenew?json'
const MAX_VALID_RATE=1000000
let pending:Promise<NbuRateCache|null>|null=null
let retryAfter=0

export function kyivToday(date:Date=new Date()):string {
  const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Kyiv',
    year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date)
  const part=(name:string)=>parts.find(x=>x.type===name)?.value??''
  return `${part('year')}-${part('month')}-${part('day')}`
}

export function parseNbuResponse(payload:unknown,checkedOn:string):NbuRateCache {
  if(!Array.isArray(payload))throw Error('НБУ повернув некоректний список курсів.')
  const rates:Partial<Record<NbuCurrency,number>>={}
  let exchangeDate=''
  for(const row of payload){
    if(!row||typeof row!=='object')continue
    const value=row as Record<string,unknown>
    const code=value.cc
    if(typeof code!=='string'||!codes.includes(code as NbuCurrency))continue
    const rate=value.rate
    if(typeof rate!=='number'||!Number.isFinite(rate)||rate<=0||rate>MAX_VALID_RATE)continue
    if(typeof value.exchangedate!=='string'||!/^\d{2}\.\d{2}\.\d{4}$/.test(value.exchangedate))continue
    rates[code as NbuCurrency]=rate
    exchangeDate=value.exchangedate
  }
  if(codes.some(code=>!rates[code]))throw Error('НБУ не повернув курси всіх підтримуваних валют.')
  return {checkedOn,exchangeDate,rates:rates as Record<NbuCurrency,number>}
}
export function readNbuRates():NbuRateCache|null {
  try {
    const json=typeof localStorage==='undefined'?null:localStorage.getItem(key)
    if(!json)return null
    const raw:unknown=JSON.parse(json)
    if(!raw||typeof raw!=='object')return null
    const data=raw as Partial<NbuRateCache>
    if(typeof data.checkedOn!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(data.checkedOn))return null
    if(typeof data.exchangeDate!=='string'||!/^\d{2}\.\d{2}\.\d{4}$/.test(data.exchangeDate))return null
    if(!data.rates||codes.some(code=>typeof data.rates?.[code]!=='number'||!Number.isFinite(data.rates[code])||data.rates[code]<=0||data.rates[code]>MAX_VALID_RATE))return null
    return data as NbuRateCache
  } catch {return null}
}
/** Fetch at most once per Kyiv calendar day after a successful response.
 * Failed requests retain the last valid cached rates and retry after an hour.
 * Calls are only made while the app is open and has connectivity.
 */
export async function refreshNbuRates(options?:{force?:boolean;fetcher?:typeof fetch;now?:Date}):Promise<NbuRateCache|null>{
  const today=kyivToday(options?.now)
  const cached=readNbuRates()
  if(!options?.force&&cached?.checkedOn===today)return cached
  if(!options?.force&&Date.now()<retryAfter)return cached
  if(typeof navigator!=='undefined'&&!navigator.onLine)return cached
  if(pending)return pending
  const fetcher=options?.fetcher??fetch
  pending=(async()=>{
    const controller=new AbortController()
    const timeout=setTimeout(()=>controller.abort(),12000)
    try {
      const response=await fetcher(endpoint,{cache:'no-store',signal:controller.signal})
      if(!response.ok)throw Error('Сервіс НБУ тимчасово недоступний.')
      const data=parseNbuResponse(await response.json(),today)
      try {localStorage.setItem(key,JSON.stringify(data))}catch{/* cache unavailable */}
      retryAfter=0
      return data
    } catch {
      retryAfter=Date.now()+60*60*1000
      return cached
    } finally {clearTimeout(timeout)}
  })()
  try {return await pending}finally{pending=null}
}
export function nbuRate(cache:NbuRateCache|null,currency:string):number|null{
  if(currency==='UAH')return 1
  if(!cache||!codes.includes(currency as NbuCurrency))return null
  return cache.rates[currency as NbuCurrency]
}
export function rateCacheIsCurrent(cache:NbuRateCache|null,at:Date=new Date()):boolean{
  return Boolean(cache&&cache.checkedOn===kyivToday(at))
}
