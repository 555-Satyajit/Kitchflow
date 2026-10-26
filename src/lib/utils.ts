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
      return 'Main Kitchen'
    case 'PACKING':
      return 'Packing / Dispatch'
    case 'ALL':
      return 'All Items'
    default:
      return station
        .toLowerCase()
        .split('_')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ')
  }
}

/**
 * Returns a persistent or session-scoped Device UUID to avoid echoing back local WebSocket frames
 */
export function getDeviceUuid(): string {
  if (typeof window === 'undefined') return 'server';
  try {
    let id = localStorage.getItem('kitchenos_device_uuid');
    if (!id) {
      id = 'dev-' + Math.random().toString(36).substring(2, 9) + '-' + Date.now().toString(36);
      localStorage.setItem('kitchenos_device_uuid', id);
    }
    return id;
  } catch {
    return 'dev-anon';
  }
}
