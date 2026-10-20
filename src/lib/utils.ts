import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format currency in Indian Rupees (INR) with standard 2 decimal places (paise precision)
 * Avoiding premature rounding discrepancies (e.g. ₹297.94 vs ₹297.9).
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

/**
 * Human-readable station names
 */
export function formatStationName(station: string): string {
  switch (station) {
    case 'DUM_BIRYANI':
      return 'Dum Biryani'
    case 'GRILL':
      return 'Grill'
    case 'FRY':
      return 'Fry'
    case 'TANDOOR':
      return 'Tandoor'
    case 'WOK':
      return 'Wok'
    case 'PIZZA':
      return 'Pizza'
    case 'BEVERAGE':
      return 'Beverage'
    case 'DESSERT':
      return 'Dessert'
    case 'ASSEMBLY':
      return 'Assembly'
    case 'PACKING':
      return 'Packing'
    case 'ALL':
      return 'All Stations'
    default:
      return station
        .toLowerCase()
        .split('_')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ')
  }
}
