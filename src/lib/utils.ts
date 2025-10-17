import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPrice(price: number, currency: string = 'ETB', options?: Intl.NumberFormatOptions): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
      ...options,
    }).format(price)
  } catch {
    return `${currency} ${price.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
  }
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num)
}

export function convertAmount(amount: number, from: string, to: string, rates: Record<string, number>): number {
  if (!Number.isFinite(amount)) return 0
  const upperFrom = from.toUpperCase()
  const upperTo = to.toUpperCase()
  if (upperFrom === upperTo) return amount
  const fromRate = rates[upperFrom]
  const toRate = rates[upperTo]
  if (!fromRate || !toRate) return amount
  if (upperFrom === 'ETB') {
    return amount / toRate
  }
  if (upperTo === 'ETB') {
    return amount * fromRate
  }
  const amountInEtb = amount * fromRate
  return amountInEtb / toRate
}

export const SUPPORTED_CURRENCIES = ['ETB', 'USD', 'EUR', 'GBP', 'AED', 'SAR', 'CAD', 'CNY']
