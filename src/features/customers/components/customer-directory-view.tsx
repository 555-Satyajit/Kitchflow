'use client';

import React, { useState, useMemo, useTransition } from 'react';
import Link from 'next/link';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
  SortingState,
} from '@tanstack/react-table';
import { 
  Users, 
  Search, 
  Phone, 
  Star, 
  ArrowLeft, 
  Plus, 
  ChevronDown, 
  ChevronUp,
  ChevronsUpDown,
  MapPin,
  Clock,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Receipt,
  Utensils
} from 'lucide-react';
import { CustomerStats } from '@/features/customers/customer-actions';
import { formatCurrency, cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { getCustomerDirectoryAction } from '@/features/customers/customer-actions';

interface CustomerDirectoryViewProps {
  initialCustomers: CustomerStats[];
  initialTotal: number;
  initialRevenue: number;
  initialVipCount: number;
  initialRepeatRate: number;
  kitchenId?: string;
}

const TIER_TABS = [
  { id: 'ALL', label: 'All' },
  { id: 'VIP', label: 'VIP' },
  { id: 'REGULAR', label: 'Regular' },
  { id: 'NEW', label: 'New' },
] as const;

export function CustomerDirectoryView({
  initialCustomers,
  initialTotal,
  initialRevenue,
  initialVipCount,
  initialRepeatRate,
  kitchenId,
}: CustomerDirectoryViewProps) {
  const [data, setData] = useState<CustomerStats[]>(initialCustomers);
  const [totalRevenue, setTotalRevenue] = useState(initialRevenue);
  const [vipCount, setVipCount] = useState(initialVipCount);
  const [repeatRate, setRepeatRate] = useState(initialRepeatRate);

  // TanStack Table states
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'totalSpend', desc: true }
  ]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [tierFilter, setTierFilter] = useState<'ALL' | 'VIP' | 'REGULAR' | 'NEW'>('ALL');
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  });

  const [expandedPhone, setExpandedPhone] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleFetch = (
    newSearch = globalFilter,
    newTier = tierFilter
  ) => {
    startTransition(async () => {
      try {
        const res = await getCustomerDirectoryAction({
          kitchenId,
          search: newSearch,
          tier: newTier,
          page: 1,
          limit: 100,
        });

        setData(res.customers);
        setTotalRevenue(res.totalRevenue);
        setVipCount(res.vipCount);
        setRepeatRate(res.repeatRate);
      } catch (err) {
        console.error('Failed to query customer directory:', err);
      }
    });
  };

  const onTierChange = (val: typeof tierFilter) => {
    setTierFilter(val);
    handleFetch(globalFilter, val);
  };

  // Define TanStack Table Columns
  const columns = useMemo<ColumnDef<CustomerStats>[]>(
    () => [
      {
        accessorKey: 'name',
        header: ({ column }) => (
          <button
            type="button"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[11px] text-muted-foreground hover:text-foreground cursor-pointer select-none"
          >
            <span>Customer</span>
            {column.getIsSorted() === 'asc' ? (
              <ChevronUp className="w-3.5 h-3.5 text-primary" />
            ) : column.getIsSorted() === 'desc' ? (
              <ChevronDown className="w-3.5 h-3.5 text-primary" />
            ) : (
              <ChevronsUpDown className="w-3.5 h-3.5 opacity-40" />
            )}
          </button>
        ),
        cell: ({ row }) => {
          const c = row.original;
          return (
            <div className="flex items-center gap-3 py-1">
              <div className="relative shrink-0">
                <div className="w-9 h-9 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center uppercase font-mono shadow-2xs">
                  {c.name.charAt(0) || 'G'}
                </div>
                {c.tier === 'VIP' && (
                  <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-amber-500 text-white flex items-center justify-center text-[7px] font-bold shadow-2xs">
                    ★
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-sm text-foreground whitespace-nowrap">
                    {c.name}
                  </span>
                  {c.tier === 'VIP' && (
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                      VIP
                    </span>
                  )}
                  {c.tier === 'REGULAR' && (
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/30">
                      Regular
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-muted-foreground font-mono flex items-center gap-1">
                  <Phone className="w-3 h-3 text-muted-foreground/60" />
                  <a
                    href={`tel:${c.phone}`}
                    onClick={(e) => e.stopPropagation()}
                    className="hover:text-primary hover:underline"
                  >
                    {c.phone}
                  </a>
                </div>
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: 'totalOrders',
        header: ({ column }) => (
          <button
            type="button"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[11px] text-muted-foreground hover:text-foreground cursor-pointer select-none text-right justify-end w-full"
          >
            <span>Orders</span>
            {column.getIsSorted() === 'asc' ? (
              <ChevronUp className="w-3.5 h-3.5 text-primary" />
            ) : column.getIsSorted() === 'desc' ? (
              <ChevronDown className="w-3.5 h-3.5 text-primary" />
            ) : (
              <ChevronsUpDown className="w-3.5 h-3.5 opacity-40" />
            )}
          </button>
        ),
        cell: ({ row }) => (
          <div className="text-right">
            <span className="font-mono font-bold text-sm text-foreground">
              {row.original.totalOrders}
            </span>
            <span className="text-[10px] text-muted-foreground ml-1">ords</span>
          </div>
        ),
      },
      {
        accessorKey: 'totalSpend',
        header: ({ column }) => (
          <button
            type="button"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[11px] text-muted-foreground hover:text-foreground cursor-pointer select-none text-right justify-end w-full"
          >
            <span>Lifetime Spend</span>
            {column.getIsSorted() === 'asc' ? (
              <ChevronUp className="w-3.5 h-3.5 text-primary" />
            ) : column.getIsSorted() === 'desc' ? (
              <ChevronDown className="w-3.5 h-3.5 text-primary" />
            ) : (
              <ChevronsUpDown className="w-3.5 h-3.5 opacity-40" />
            )}
          </button>
        ),
        cell: ({ row }) => (
          <div className="text-right">
            <div className="font-mono font-bold text-sm text-foreground">
              {formatCurrency(row.original.totalSpend)}
            </div>
            <div className="text-[10px] text-muted-foreground font-mono">
              avg {formatCurrency(row.original.avgOrderValue)}
            </div>
          </div>
        ),
      },
      {
        accessorKey: 'preferredBrand',
        header: () => (
          <span className="font-bold uppercase tracking-wider text-[11px] text-muted-foreground">
            Fav Brand
          </span>
        ),
        cell: ({ row }) => (
          <div className="text-xs">
            <span className="font-medium text-foreground truncate max-w-[120px] block">
              {row.original.preferredBrand}
            </span>
            <span className="text-[10px] text-muted-foreground font-mono uppercase">
              {row.original.preferredChannel}
            </span>
          </div>
        ),
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => {
          const c = row.original;
          const isExpanded = expandedPhone === c.phone;
          return (
            <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
              <Link
                href={`/pos?phone=${encodeURIComponent(c.phone)}&name=${encodeURIComponent(c.name)}`}
                onClick={(e) => e.stopPropagation()}
              >
                <Button
                  size="sm"
                  className="h-8 px-3 rounded-full bg-primary text-primary-foreground font-semibold text-xs gap-1 shadow-2xs touch-manipulation active:scale-95"
                >
                  <Plus className="w-3 h-3" />
                  <span>Bill</span>
                </Button>
              </Link>
              <button
                type="button"
                onClick={() => setExpandedPhone(isExpanded ? null : c.phone)}
                className="w-8 h-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center justify-center transition-colors"
                aria-label="Toggle details"
              >
                <ChevronDown className={cn('w-4 h-4 transition-transform duration-200', isExpanded && 'rotate-180')} />
              </button>
            </div>
          );
        },
      },
    ],
    [expandedPhone]
  );

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      globalFilter,
      pagination,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  return (
    <div className="min-h-screen bg-[#f2f2f7] dark:bg-black text-foreground pb-28 pt-2 sm:pt-4 px-3 sm:px-6 max-w-5xl mx-auto space-y-3.5">
      {/* iOS Translucent Navigation Header */}
      <header className="sticky top-0 z-30 -mx-3 -mt-2 px-3 pt-3 pb-2.5 sm:mx-0 sm:mt-0 sm:px-0 sm:pt-0 sm:pb-0 backdrop-blur-xl bg-[#f2f2f7]/85 dark:bg-black/85 supports-[backdrop-filter]:bg-[#f2f2f7]/70 border-b border-border/40 sm:border-0 sm:bg-transparent transition-all">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Link
              href="/orders"
              className="w-9 h-9 -ml-1 rounded-full flex items-center justify-center text-foreground hover:bg-neutral-200/60 dark:hover:bg-neutral-800 active:scale-95 transition-all shrink-0 touch-manipulation"
              title="Return to Kitchen Orders"
              aria-label="Back to Orders"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-foreground truncate">
                  Customer Directory
                </h1>
                {isPending && (
                  <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
                )}
              </div>
              <p className="text-[11px] text-muted-foreground truncate hidden xs:block">
                TanStack powered CRM table with instant sorting & billing
              </p>
            </div>
          </div>

          <Link href="/pos" className="shrink-0">
            <Button
              size="sm"
              className="h-8.5 px-3.5 rounded-full font-semibold text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 shadow-2xs touch-manipulation active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>POS Bill</span>
            </Button>
          </Link>
        </div>
      </header>

      {/* Glanceable KPI Summary Bar */}
      <div className="grid grid-cols-4 bg-white dark:bg-neutral-900 rounded-2xl shadow-2xs border border-border/40 divide-x divide-border/40 py-2.5">
        <div className="text-center px-2 space-y-0.5">
          <span className="text-[9px] uppercase font-bold tracking-wider text-muted-foreground block truncate">
            Guests
          </span>
          <div className="font-mono text-sm sm:text-base font-bold text-foreground">
            {data.length}
          </div>
        </div>

        <div className="text-center px-2 space-y-0.5">
          <span className="text-[9px] uppercase font-bold tracking-wider text-muted-foreground block truncate">
            VIPs
          </span>
          <div className="font-mono text-sm sm:text-base font-bold text-amber-600 dark:text-amber-400 flex items-center justify-center gap-0.5">
            <Star className="w-3 h-3 fill-amber-500 text-amber-500 shrink-0" />
            <span>{vipCount}</span>
          </div>
        </div>

        <div className="text-center px-2 space-y-0.5">
          <span className="text-[9px] uppercase font-bold tracking-wider text-muted-foreground block truncate">
            Repeat
          </span>
          <div className="font-mono text-sm sm:text-base font-bold text-emerald-600 dark:text-emerald-400">
            {repeatRate}%
          </div>
        </div>

        <div className="text-center px-2 space-y-0.5">
          <span className="text-[9px] uppercase font-bold tracking-wider text-muted-foreground block truncate">
            Total LTV
          </span>
          <div className="font-mono text-sm sm:text-base font-bold text-foreground truncate">
            {formatCurrency(totalRevenue)}
          </div>
        </div>
      </div>

      {/* TanStack Table Search & Filter Strip */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={globalFilter ?? ''}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder="Search by customer name, phone, or brand..."
            className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm rounded-xl bg-white dark:bg-neutral-900 border border-border/40 focus:outline-none focus:ring-2 focus:ring-primary/40 text-foreground placeholder:text-muted-foreground shadow-2xs transition-all"
          />
          {globalFilter && (
            <button
              type="button"
              onClick={() => setGlobalFilter('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 text-xs"
            >
              ✕
            </button>
          )}
        </div>

        {/* Tier Segmented Tabs */}
        <div className="p-1 rounded-xl bg-neutral-200/80 dark:bg-neutral-800/80 flex items-center gap-1 shadow-inner">
          {TIER_TABS.map((tab) => {
            const isActive = tierFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onTierChange(tab.id)}
                className={cn(
                  'flex-1 py-1 px-2.5 rounded-lg text-xs font-semibold transition-all select-none touch-manipulation active:scale-[0.98]',
                  isActive
                    ? 'bg-white dark:bg-neutral-900 text-foreground shadow-2xs font-bold'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* TanStack Data Table Card */}
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xs border border-border/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[580px]">
            <thead className="bg-neutral-50/80 dark:bg-neutral-800/40 border-b border-border/50 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th key={header.id} className="py-2.5 px-3.5 whitespace-nowrap">
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-border/40">
              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="py-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <Users className="w-8 h-8 opacity-40" />
                      <p className="font-semibold text-xs">No matching customers found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => {
                  const c = row.original;
                  const isExpanded = expandedPhone === c.phone;

                  return (
                    <React.Fragment key={row.id}>
                      <tr 
                        onClick={() => setExpandedPhone(isExpanded ? null : c.phone)}
                        className="hover:bg-neutral-50/70 dark:hover:bg-neutral-800/40 transition-colors cursor-pointer select-none"
                      >
                        {row.getVisibleCells().map((cell) => (
                          <td key={cell.id} className="py-2.5 px-3.5 whitespace-nowrap">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>

                      {/* Expandable Order History Details */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={columns.length} className="p-3.5 bg-neutral-50/80 dark:bg-neutral-900/60 border-y border-border/40">
                            <div className="space-y-2.5 max-w-3xl">
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                  Recent Orders ({c.recentOrders.length})
                                </span>
                                {c.address && (
                                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                    <MapPin className="w-3 h-3 shrink-0" />
                                    <span>{c.address}</span>
                                  </div>
                                )}
                              </div>

                              <div className="rounded-xl bg-white dark:bg-neutral-900 border border-border/50 overflow-hidden divide-y divide-border/40">
                                {c.recentOrders.length === 0 ? (
                                  <div className="p-3 text-center text-xs text-muted-foreground">
                                    No past orders recorded.
                                  </div>
                                ) : (
                                  c.recentOrders.map((ord) => (
                                    <div
                                      key={ord.id}
                                      className="p-2.5 flex items-center justify-between gap-3 text-xs"
                                    >
                                      <div className="flex items-center gap-2 min-w-0">
                                        <span className="font-mono font-bold text-foreground shrink-0">
                                          #{ord.orderNumber}
                                        </span>
                                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase font-mono bg-neutral-100 dark:bg-neutral-800 text-muted-foreground shrink-0">
                                          {ord.channel}
                                        </span>
                                        <span className="text-muted-foreground truncate">
                                          {ord.itemSummary}
                                        </span>
                                      </div>

                                      <div className="flex items-center gap-2.5 shrink-0 font-mono text-right">
                                        <span className="font-bold text-foreground">
                                          {formatCurrency(ord.grossAmount)}
                                        </span>
                                        <span className="text-[10px] text-muted-foreground">
                                          {new Date(ord.createdAt).toLocaleDateString([], {
                                            month: 'short',
                                            day: 'numeric',
                                          })}
                                        </span>
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Apple HIG Clean Pagination Strip */}
        <div className="p-3 border-t border-border/40 bg-neutral-50/50 dark:bg-neutral-800/30 flex items-center justify-between gap-2 text-xs">
          {/* Showing Count */}
          <div className="text-muted-foreground text-[11px]">
            <span className="font-bold text-foreground">
              {table.getFilteredRowModel().rows.length === 0
                ? 0
                : table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}
              -
              {Math.min(
                (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
                table.getFilteredRowModel().rows.length
              )}
            </span>{' '}
            of <span className="font-bold text-foreground">{table.getFilteredRowModel().rows.length}</span>
          </div>

          {/* Page Buttons: Clean rounded segment buttons with tap feedback */}
          <div className="flex items-center gap-1.5">
            {/* Page Size Picker */}
            <select
              value={table.getState().pagination.pageSize}
              onChange={(e) => table.setPageSize(Number(e.target.value))}
              className="h-8 px-2 rounded-lg bg-white dark:bg-neutral-900 border border-border/60 text-xs font-semibold focus:outline-none cursor-pointer"
            >
              {[10, 20, 50].map((pageSize) => (
                <option key={pageSize} value={pageSize}>
                  {pageSize}/page
                </option>
              ))}
            </select>

            {/* Navigation buttons */}
            <div className="flex items-center gap-1 bg-white dark:bg-neutral-900 p-0.5 rounded-lg border border-border/60">
              <button
                type="button"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                className="w-7 h-7 rounded-md flex items-center justify-center text-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-30 disabled:pointer-events-none transition-all active:scale-95"
                title="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="px-2 font-mono text-xs font-bold text-foreground">
                {table.getState().pagination.pageIndex + 1} / {Math.max(1, table.getPageCount())}
              </span>

              <button
                type="button"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                className="w-7 h-7 rounded-md flex items-center justify-center text-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-30 disabled:pointer-events-none transition-all active:scale-95"
                title="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
