/**
 * KitchFlow OS — Granular Permissions & Role-Based Access Control (RBAC)
 */

export const PERMISSIONS = {
  // Live Queue & Orders
  ORDERS: 'orders',
  ORDERS_MANAGE: 'orders:manage',

  // Point of Sale & Billing
  POS: 'pos',

  // Kitchen Display System (Cook Bump Screen)
  KDS: 'kds',

  // Dispatch & Packing QA
  PACKING: 'packing',

  // Inventory & Stock Ledger
  INVENTORY: 'inventory',

  // Supplier Indents & Purchase Orders
  PROCUREMENT: 'procurement',

  // Financial Analytics & Profit Margins
  MARGINS: 'margins',

  // Facility, Taxes, Brand & Staff Settings
  SETTINGS: 'settings',

  // Delivery Boy Station
  DELIVERY: 'delivery',

  // Past Shift Order History & Invoices
  HISTORY: 'history',

  // Customer Directory & CRM
  CUSTOMERS: 'customers',
} as const;

export type PermissionKey = typeof PERMISSIONS[keyof typeof PERMISSIONS] | string;

export type MemberRole = 'owner' | 'admin' | 'manager' | 'kitchen_staff';

/**
 * Standard role-to-permission presets
 */
export const ROLE_DEFAULT_PERMISSIONS: Record<MemberRole, string[]> = {
  owner: [
    PERMISSIONS.ORDERS,
    PERMISSIONS.ORDERS_MANAGE,
    PERMISSIONS.POS,
    PERMISSIONS.KDS,
    PERMISSIONS.PACKING,
    PERMISSIONS.INVENTORY,
    PERMISSIONS.PROCUREMENT,
    PERMISSIONS.MARGINS,
    PERMISSIONS.SETTINGS,
    PERMISSIONS.DELIVERY,
    PERMISSIONS.HISTORY,
    PERMISSIONS.CUSTOMERS,
  ],
  admin: [
    PERMISSIONS.ORDERS,
    PERMISSIONS.ORDERS_MANAGE,
    PERMISSIONS.POS,
    PERMISSIONS.KDS,
    PERMISSIONS.PACKING,
    PERMISSIONS.INVENTORY,
    PERMISSIONS.PROCUREMENT,
    PERMISSIONS.MARGINS,
    PERMISSIONS.SETTINGS,
    PERMISSIONS.DELIVERY,
    PERMISSIONS.HISTORY,
    PERMISSIONS.CUSTOMERS,
  ],
  manager: [
    PERMISSIONS.ORDERS,
    PERMISSIONS.ORDERS_MANAGE,
    PERMISSIONS.POS,
    PERMISSIONS.KDS,
    PERMISSIONS.PACKING,
    PERMISSIONS.INVENTORY,
    PERMISSIONS.PROCUREMENT,
    PERMISSIONS.DELIVERY,
    PERMISSIONS.HISTORY,
    PERMISSIONS.CUSTOMERS,
  ],
  kitchen_staff: [
    PERMISSIONS.ORDERS,
    PERMISSIONS.KDS,
    PERMISSIONS.PACKING,
  ],
};

/**
 * Evaluates whether a role or explicit permission set grants access to a capability.
 * Store Owners and Admins always bypass checks.
 */
export function hasPermission(
  role: string | null | undefined,
  userPermissions: string[] | null | undefined,
  requiredPermission: string
): boolean {
  if (role === 'owner' || role === 'admin') {
    return true;
  }

  const perms = Array.isArray(userPermissions) ? userPermissions : [];

  // Exact match
  if (perms.includes(requiredPermission)) {
    return true;
  }

  // Broad category match (e.g., 'orders' grants 'orders:manage')
  const baseCategory = requiredPermission.split(':')[0];
  if (perms.includes(baseCategory)) {
    return true;
  }

  return false;
}

/**
 * Validates that all permissions in an array are satisfied
 */
export function hasAllPermissions(
  role: string | null | undefined,
  userPermissions: string[] | null | undefined,
  requiredPermissions: string[]
): boolean {
  return requiredPermissions.every((perm) => hasPermission(role, userPermissions, perm));
}

/**
 * Validates that at least one permission in an array is satisfied
 */
export function hasAnyPermission(
  role: string | null | undefined,
  userPermissions: string[] | null | undefined,
  requiredPermissions: string[]
): boolean {
  return requiredPermissions.some((perm) => hasPermission(role, userPermissions, perm));
}

