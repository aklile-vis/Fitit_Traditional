import { NextRequest, NextResponse } from 'next/server'

const CBE_URL = 'https://www.combanketh.et/international-banking/exchange-rate/'
const FALLBACK_RATES: Record<string, number> = {
  USD: 56.5,
  EUR: 60.2,
  GBP: 69.4,
  AED: 15.4,
  SAR: 15.1,
  CAD: 41.2,
  CNY: 8.2,
}

function sanitize(value: string): number | null {
  const cleaned = value.replace(/[^0-9.]/g, '')
  const parsed = parseFloat(cleaned)
  return Number.isFinite(parsed) ? parsed : null
}

function parseCbeHtml(html: string): Record<string, number> {
  const rates: Record<string, number> = {}
  const rowRegex = /<tr[^>]*>(.*?)<\/tr>/gis
  let match: RegExpExecArray | null
  while ((match = rowRegex.exec(html)) !== null) {
    const row = match[1]
    const cellRegex = /<t[hd][^>]*>(.*?)<\/t[hd]>/gis
    const cells: string[] = []
    let cellMatch: RegExpExecArray | null
    while ((cellMatch = cellRegex.exec(row)) !== null) {
      const text = cellMatch[1].replace(/<[^>]+>/g, '').trim()
      cells.push(text)
    }
    if (cells.length < 3) continue
    const code = cells[0]?.toUpperCase()
    if (!code || code.length !== 3) continue
    const selling = sanitize(cells[2]) ?? sanitize(cells[1])
    if (!selling) continue
    rates[code] = selling
  }
  return rates
}

function normaliseRates(raw: Record<string, number>): Record<string, number> {
  const rates: Record<string, number> = { ETB: 1 }
  Object.entries(raw).forEach(([code, value]) => {
    if (value > 0) {
      rates[code.toUpperCase()] = value
    }
  })
  return rates
}

export async function GET(request: NextRequest) {
  const base = (new URL(request.url).searchParams.get('base') || 'ETB').toUpperCase()
  let rates = normaliseRates(FALLBACK_RATES)

  try {
    const res = await fetch(CBE_URL, { cache: 'no-store' })
    if (res.ok) {
      const html = await res.text()
      const parsed = parseCbeHtml(html)
      const merged = { ...FALLBACK_RATES, ...parsed }
      rates = normaliseRates(merged)
    }
  } catch (err) {
    console.warn('[exchange-rates] Failed to fetch CBE rates', err)
  }

  if (!rates[base]) {
    return NextResponse.json({ error: `Base currency ${base} not available`, rates }, { status: 400 })
  }

  if (base !== 'ETB') {
    const baseToEtb = rates[base]
    const converted: Record<string, number> = { [base]: 1 }
    Object.entries(rates).forEach(([code, value]) => {
      if (code === base) return
      if (code === 'ETB') {
        converted[code] = baseToEtb
      } else {
        converted[code] = value / baseToEtb
      }
    })
    rates = converted
  }

  return NextResponse.json({ base, rates, source: 'Commercial Bank of Ethiopia (scraped with fallback)' }, { headers: { 'Cache-Control': 'max-age=1800, must-revalidate' } })
}
