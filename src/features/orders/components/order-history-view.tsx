'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import { 
  Search, 
  Clock, 
  ArrowLeft, 
  ShoppingBag,
  ChevronDown,
  RotateCcw,
  SlidersHorizontal,
  Receipt,
  Phone,
  MapPin,
  Calendar,
  Store,
  Tag,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight
} from 'lucide-react';
import { Order } from '@/types';
import { formatCurrency, cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BillReceiptModal } from '@/components/pos/BillReceiptModal';
import { getOrderHistoryAction } from '@/features/orders/order-actions';
import { useKitchen } from '@/context/KitchenContext';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface OrderHistoryViewProps {
  initialOrders: Order[];
  initialTotal: number;
  initialRevenue: number;
  initialFulfilled: number;
  initialCancelled: number;
  kitchenId?: string;
  outlets?: Array<{ id: string; name: string }>;
  brandsList?: Array<{ id: string; name: string }>;
}

const DATE_PRESETS = [
  { id: 'TODAY', label: 'Today' },
  { id: 'YESTERDAY', label: 'Yesterday' },
  { id: 'LAST_7_DAYS', label: '7 Days' },
  { id: 'THIS_MONTH', label: 'Month' },
  { id: 'ALL', label: 'All' },
] as const;

const STATUS_FILTERS = [
  { id: 'ALL', label: 'All Status' },
  { id: 'DISPATCHED', label: 'Delivered' },
  { id: 'CANCELLED', label: 'Cancelled' },
] as const;

const CHANNEL_FILTERS = [
  { id: 'ALL', label: 'All Channels' },
  { id: 'DIRECT', label: 'Direct POS' },
  { id: 'SWIGGY', label: 'Swiggy' },
  { id: 'ZOMATO', label: 'Zomato' },
  { id: 'WALK_IN', label: 'Walk-In' },
] as const;

export function OrderHistoryView({
  initialOrders,
  initialTotal,
  initialRevenue,
  initialFulfilled,
  initialCancelled,
  kitchenId,
  outlets = [],
  brandsList = [],
}: OrderHistoryViewProps) {
  const { brands: contextBrands } = useKitchen();
  const availableBrands = brandsList.length > 0 ? brandsList : contextBrands;

  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [totalCount, setTotalCount] = useState(initialTotal);
  const [totalRevenue, setTotalRevenue] = useState(initialRevenue);
  const [fulfilledCount, setFulfilledCount] = useState(initialFulfilled);
  const [cancelledCount, setCancelledCount] = useState(initialCancelled);

  // Filter States
  const [selectedKitchenId, setSelectedKitchenId] = useState<string>(kitchenId || 'ALL');
  const [selectedBrandId, setSelectedBrandId] = useState<string>('ALL');
  const [dateRange, setDateRange] = useState<'TODAY' | 'YESTERDAY' | 'LAST_7_DAYS' | 'THIS_MONTH' | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'DISPATCHED' | 'CANCELLED'>('ALL');
  const [channelFilter, setChannelFilter] = useState<'ALL' | 'SWIGGY' | 'ZOMATO' | 'DIRECT' | 'WALK_IN'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [showFiltersSheet, setShowFiltersSheet] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Receipt modal state
  const [selectedReceiptOrder, setSelectedReceiptOrder] = useState<Order | null>(null);
  // Expandable item breakdown map
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => {
    setExpandedOrders((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleFetch = (
    newKitchen = selectedKitchenId,
    newBrand = selectedBrandId,
    newDate = dateRange,
    newStatus = statusFilter,
    newChannel = channelFilter,
    newSearch = searchQuery,
    newPage = 1
  ) => {
    startTransition(async () => {
      try {
        const res = await getOrderHistoryAction({
          kitchenId: newKitchen,
          brandId: newBrand,
          dateRange: newDate,
          status: newStatus,
          channel: newChannel,
          search: newSearch,
          page: newPage,
          limit: 20,
        });

        if (res.ok) {
          setOrders(res.data.orders);
          setTotalCount(res.data.totalCount);
          setTotalRevenue(res.data.totalRevenue);
          setFulfilledCount(res.data.totalFulfilled);
          setCancelledCount(res.data.totalCancelled);
          setPage(newPage);
        }
      } catch (err) {
        console.error('Failed to query order history:', err);
      }
    });
  };

  const onKitchenChange = (val: string) => {
    setSelectedKitchenId(val);
    handleFetch(val, selectedBrandId, dateRange, statusFilter, channelFilter, searchQuery, 1);
  };

  const onBrandChange = (val: string) => {
    setSelectedBrandId(val);
    handleFetch(selectedKitchenId, val, dateRange, statusFilter, channelFilter, searchQuery, 1);
  };

  const onDateChange = (val: typeof dateRange) => {
    setDateRange(val);
    handleFetch(selectedKitchenId, selectedBrandId, val, statusFilter, channelFilter, searchQuery, 1);
  };

  const onStatusChange = (val: typeof statusFilter) => {
    setStatusFilter(val);
    handleFetch(selectedKitchenId, selectedBrandId, dateRange, val, channelFilter, searchQuery, 1);
  };

  const onChannelChange = (val: typeof channelFilter) => {
    setChannelFilter(val);
    handleFetch(selectedKitchenId, selectedBrandId, dateRange, statusFilter, val, searchQuery, 1);
  };

  const onSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleFetch(selectedKitchenId, selectedBrandId, dateRange, statusFilter, channelFilter, searchQuery, 1);
  };

  const activeFiltersCount = 
    (statusFilter !== 'ALL' ? 1 : 0) + 
    (channelFilter !== 'ALL' ? 1 : 0) + 
    (selectedKitchenId !== 'ALL' ? 1 : 0) + 
    (selectedBrandId !== 'ALL' ? 1 : 0) + 
    (searchQuery ? 1 : 0);

  return (
    <div className="min-h-screen bg-neutral-50/70 dark:bg-background text-foreground pb-28 pt-2 sm:pt-6 px-3 sm:px-6 max-w-4xl mx-auto space-y-4">
      {/* iOS Navigation Header Bar */}
      <header className="sticky top-0 z-30 -mx-3 -mt-2 px-3 pt-3 pb-2.5 sm:mx-0 sm:mt-0 sm:px-0 sm:pt-0 sm:pb-0 backdrop-blur-xl bg-background/80 supports-[backdrop-filter]:bg-background/60 border-b border-border/40 sm:border-0 sm:bg-transparent transition-all">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Link
              href="/orders"
              className="w-10 h-10 -ml-1 rounded-full flex items-center justify-center text-foreground hover:bg-neutral-200/60 dark:hover:bg-neutral-800 active:scale-95 transition-all shrink-0 touch-manipulation"
              title="Return to Kitchen Orders"
              aria-label="Back to Orders"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground truncate">
                  Order History
                </h1>
                {isPending && (
                  <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
                )}
              </div>
              <p className="text-[11px] text-muted-foreground truncate hidden xs:block">
                Archived bills, customer receipts & margins
              </p>
            </div>
          </div>

          {/* Filter sheet toggle for mobile & count badge */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setShowFiltersSheet(!showFiltersSheet)}
              className={cn(
                "h-9 px-3 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all touch-manipulation active:scale-95 border",
                activeFiltersCount > 0
                  ? "bg-primary text-primary-foreground border-primary shadow-xs"
                  : "bg-background/90 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-foreground border-border/60"
              )}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Filters</span>
              {activeFiltersCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-background text-primary font-mono text-[10px] font-bold flex items-center justify-center ml-0.5">
                  {activeFiltersCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* iOS Glanceable KPI Summary Bar (Cards with secondary label above prominent stat) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="p-3 sm:p-3.5 rounded-2xl bg-card border border-border/60 shadow-2xs space-y-1">
          <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">Delivered</span>
          <div className="flex items-baseline justify-between">
            <span className="text-lg sm:text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
              {fulfilledCount}
            </span>
            <span className="text-[10px] font-medium text-muted-foreground">orders</span>
          </div>
        </div>

        <div className="p-3 sm:p-3.5 rounded-2xl bg-card border border-border/60 shadow-2xs space-y-1">
          <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">Total Revenue</span>
          <div className="flex items-baseline justify-between">
            <span className="text-lg sm:text-xl font-bold font-mono text-foreground truncate">
              {formatCurrency(totalRevenue)}
            </span>
          </div>
        </div>

        <div className="p-3 sm:p-3.5 rounded-2xl bg-card border border-border/60 shadow-2xs space-y-1">
          <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">Cancelled</span>
          <div className="flex items-baseline justify-between">
            <span className="text-lg sm:text-xl font-bold font-mono text-rose-500">
              {cancelledCount}
            </span>
            <span className="text-[10px] font-medium text-muted-foreground">orders</span>
          </div>
        </div>

        <div className="p-3 sm:p-3.5 rounded-2xl bg-card border border-border/60 shadow-2xs space-y-1">
          <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">Total Volume</span>
          <div className="flex items-baseline justify-between">
            <span className="text-lg sm:text-xl font-bold font-mono text-foreground">
              {totalCount}
            </span>
            <span className="text-[10px] font-medium text-muted-foreground">entries</span>
          </div>
        </div>
      </div>

      {/* iOS Segmented Control: Date Presets */}
      <div className="p-1 rounded-2xl bg-neutral-200/70 dark:bg-neutral-800/80 flex items-center gap-1 overflow-x-auto no-scrollbar shadow-inner">
        {DATE_PRESETS.map((tab) => {
          const isActive = dateRange === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onDateChange(tab.id)}
              className={cn(
                'flex-1 min-w-[64px] sm:min-w-[80px] py-1.5 px-2.5 rounded-xl text-xs font-semibold transition-all text-center select-none touch-manipulation active:scale-[0.98]',
                isActive
                  ? 'bg-card text-foreground shadow-xs font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Search Bar + Filter Options (Collapsible on mobile for maximum clean space) */}
      <div className="rounded-2xl bg-card border border-border/60 shadow-2xs p-3 space-y-3">
        {/* iOS Inset Search Input Field */}
        <form onSubmit={onSearchSubmit} className="relative flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search #order, name, or phone..."
              className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm rounded-xl bg-neutral-100 dark:bg-neutral-800/80 border-0 focus:outline-none focus:ring-2 focus:ring-primary/40 text-foreground placeholder:text-muted-foreground transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  handleFetch(selectedKitchenId, selectedBrandId, dateRange, statusFilter, channelFilter, '', 1);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 text-xs"
              >
                ✕
              </button>
            )}
          </div>
          <Button
            type="submit"
            size="sm"
            disabled={isPending}
            className="h-9 px-4 rounded-xl font-bold text-xs shadow-2xs touch-manipulation"
          >
            {isPending ? '...' : 'Search'}
          </Button>
        </form>

        {/* Filter Pills (Always visible or toggled) */}
        {(showFiltersSheet || activeFiltersCount > 0) && (
          <div className="pt-2 border-t border-border/50 space-y-3 animate-in fade-in duration-200">
            {/* Kitchen & Brand Dropdowns: Apple HIG Inset Grouped Selectors */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {outlets.length > 0 && (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <Store className="w-3 h-3 text-primary" />
                    <span>Kitchen Facility</span>
                  </label>
                  <Select value={selectedKitchenId} onValueChange={onKitchenChange}>
                    <SelectTrigger className="h-9 rounded-xl text-xs bg-neutral-100 dark:bg-neutral-800/80 border-0">
                      <SelectValue placeholder="All Outlets" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="ALL" className="text-xs font-semibold">
                        All Kitchen Outlets
                      </SelectItem>
                      {outlets.map((k) => (
                        <SelectItem key={k.id} value={k.id} className="text-xs">
                          {k.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {availableBrands.length > 0 && (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <Tag className="w-3 h-3 text-primary" />
                    <span>Brand</span>
                  </label>
                  <Select value={selectedBrandId} onValueChange={onBrandChange}>
                    <SelectTrigger className="h-9 rounded-xl text-xs bg-neutral-100 dark:bg-neutral-800/80 border-0">
                      <SelectValue placeholder="All Brands" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="ALL" className="text-xs font-semibold">
                        All Brands
                      </SelectItem>
                      {availableBrands.map((b) => (
                        <SelectItem key={b.id} value={b.id} className="text-xs">
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Status Segment */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Order Status</span>
              <div className="flex flex-wrap items-center gap-1.5">
                {STATUS_FILTERS.map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => onStatusChange(st.id)}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-xs font-semibold transition-all touch-manipulation active:scale-95',
                      statusFilter === st.id
                        ? 'bg-primary text-primary-foreground font-bold shadow-2xs'
                        : 'bg-neutral-100 dark:bg-neutral-800 text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Channel Segment */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Ordering Channel</span>
              <div className="flex flex-wrap items-center gap-1.5">
                {CHANNEL_FILTERS.map((ch) => (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => onChannelChange(ch.id)}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-xs font-semibold transition-all touch-manipulation active:scale-95',
                      channelFilter === ch.id
                        ? 'bg-neutral-900 text-neutral-100 dark:bg-neutral-100 dark:text-neutral-900 font-bold shadow-2xs'
                        : 'bg-neutral-100 dark:bg-neutral-800 text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {ch.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Reset Filters shortcut */}
            {activeFiltersCount > 0 && (
              <div className="pt-1 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('ALL');
                    setChannelFilter('ALL');
                    setSelectedBrandId('ALL');
                    handleFetch(selectedKitchenId, 'ALL', dateRange, 'ALL', 'ALL', '', 1);
                  }}
                  className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 py-1 px-2"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset all filters
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Orders List: iOS Grouped Inset List Pattern */}
      <div className="space-y-3">
        {orders.length === 0 ? (
          <div className="py-14 px-6 text-center rounded-3xl bg-card border border-border/60 shadow-2xs space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-neutral-100 dark:bg-neutral-800 text-muted-foreground mx-auto flex items-center justify-center">
              <ShoppingBag className="w-7 h-7 stroke-[1.5]" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-foreground">No Orders Found</h3>
              <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                No orders match your selected time range or search filters.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setDateRange('ALL');
                setStatusFilter('ALL');
                setChannelFilter('ALL');
                setSelectedBrandId('ALL');
                setSelectedKitchenId('ALL');
                setSearchQuery('');
                handleFetch('ALL', 'ALL', 'ALL', 'ALL', 'ALL', '', 1);
              }}
              className="text-xs rounded-full font-semibold px-4 cursor-pointer mt-1"
            >
              Clear filters
            </Button>
          </div>
        ) : (
          orders.map((order) => {
            const isExpanded = !!expandedOrders[order.id];
            const orderDate = new Date(order.createdAt);
            const timeFormatted = orderDate.toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            });
            const dateFormatted = orderDate.toLocaleDateString([], {
              month: 'short',
              day: 'numeric',
            });

            const channelBadgeClass = 
              order.channel === 'SWIGGY' ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20' :
              order.channel === 'ZOMATO' ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20' :
              order.channel === 'DIRECT' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' :
              'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20';

            const statusBadgeClass = 
              order.status === 'DISPATCHED' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' :
              order.status === 'CANCELLED' ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20' :
              'bg-neutral-500/10 text-muted-foreground border-neutral-500/20';

            return (
              <Card
                key={order.id}
                className="overflow-hidden border border-border/60 bg-card rounded-2xl sm:rounded-3xl shadow-xs transition-all hover:border-border/90"
              >
                {/* Tappable summary header */}
                <div 
                  onClick={() => toggleExpand(order.id)}
                  className="p-3.5 sm:p-4.5 cursor-pointer select-none active:bg-neutral-100/50 dark:active:bg-neutral-800/40 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2.5">
                    {/* Order ID + Brand info */}
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-sm sm:text-base text-foreground tracking-tight">
                          #{order.orderNumber}
                        </span>
                        <span className={cn('px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border', channelBadgeClass)}>
                          {order.channel}
                        </span>
                        <span className={cn('px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border', statusBadgeClass)}>
                          {order.status === 'DISPATCHED' ? 'Delivered' : order.status}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-muted-foreground truncate">
                        <span className="font-semibold text-foreground truncate max-w-[150px]">
                          {order.brandName}
                        </span>
                        <span>•</span>
                        <span>{order.customerName || 'Walk-in Guest'}</span>
                      </div>
                    </div>

                    {/* Amount + Time */}
                    <div className="text-right shrink-0">
                      <div className="font-mono font-bold text-base sm:text-lg text-foreground">
                        {formatCurrency(order.financials?.grossAmount ?? 0)}
                      </div>
                      <div className="text-[11px] text-muted-foreground flex items-center justify-end gap-1 font-mono">
                        <Clock className="w-3 h-3" />
                        <span>{timeFormatted}</span>
                      </div>
                    </div>
                  </div>

                  {/* Items list preview chips */}
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    {order.items.slice(0, 3).map((it, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-neutral-100/80 dark:bg-neutral-800/70 text-[11px] font-medium text-foreground"
                      >
                        <span className="font-mono font-bold text-primary">{it.quantity}×</span>
                        <span className="truncate max-w-[130px] sm:max-w-none">{it.name}</span>
                      </span>
                    ))}
                    {order.items.length > 3 && (
                      <span className="text-[11px] font-medium text-muted-foreground px-1.5 py-0.5">
                        +{order.items.length - 3} more
                      </span>
                    )}
                  </div>
                </div>

                {/* Bottom Action Strip (Always accessible 44pt tap targets on mobile) */}
                <div className="px-3.5 py-2.5 bg-neutral-50/60 dark:bg-neutral-900/40 border-t border-border/40 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground font-mono">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{dateFormatted}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Bill Receipt action button */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedReceiptOrder(order);
                      }}
                      className="h-8 sm:h-8.5 px-3 rounded-full text-xs font-semibold gap-1.5 border-border/70 hover:bg-neutral-100 dark:hover:bg-neutral-800 shadow-2xs touch-manipulation active:scale-95"
                    >
                      <Receipt className="w-3.5 h-3.5 text-muted-foreground" />
                      <span>Receipt</span>
                    </Button>

                    {/* Expand/Collapse Chevron button */}
                    <button
                      type="button"
                      onClick={() => toggleExpand(order.id)}
                      className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-neutral-200/50 dark:hover:bg-neutral-800 transition-colors touch-manipulation"
                      aria-label={isExpanded ? 'Hide details' : 'Show details'}
                    >
                      <ChevronDown
                        className={cn(
                          'w-4 h-4 transition-transform duration-200',
                          isExpanded && 'rotate-180'
                        )}
                      />
                    </button>
                  </div>
                </div>

                {/* Expanded Details: Financials, All Items & Customer Info */}
                {isExpanded && (
                  <div className="p-4 bg-neutral-100/40 dark:bg-neutral-900/60 border-t border-border/40 text-xs space-y-3.5 animate-in slide-in-from-top-2 duration-150">
                    {/* All Items Breakdown */}
                    <div className="space-y-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Order Items</span>
                      <div className="rounded-xl bg-card border border-border/60 overflow-hidden divide-y divide-border/40">
                        {order.items.map((item, idx) => (
                          <div key={idx} className="p-2.5 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="w-5 h-5 rounded-md bg-neutral-100 dark:bg-neutral-800 font-mono font-bold text-xs flex items-center justify-center shrink-0">
                                {item.quantity}
                              </span>
                              <span className="font-medium text-foreground truncate">{item.name}</span>
                            </div>
                            <span className="font-mono font-semibold text-muted-foreground shrink-0">
                              {formatCurrency(item.price * item.quantity)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Financial Metrics Cards */}
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <div className="p-2.5 rounded-xl bg-card border border-border/60 space-y-0.5">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Channel Margin</span>
                        <div className="font-mono font-bold text-foreground">
                          {formatCurrency(order.financials?.netMargin ?? 0)}
                          <span className="text-[10px] text-muted-foreground ml-1">
                            ({order.financials?.netMarginPercentage ?? 0}%)
                          </span>
                        </div>
                      </div>

                      <div className="p-2.5 rounded-xl bg-card border border-border/60 space-y-0.5">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Commission</span>
                        <div className="font-mono font-bold text-foreground">
                          {formatCurrency(order.financials?.commissionAmount ?? 0)}
                        </div>
                      </div>

                      <div className="p-2.5 rounded-xl bg-card border border-border/60 space-y-0.5">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Tax & Packing</span>
                        <div className="font-mono font-bold text-foreground">
                          {formatCurrency((order.financials?.taxes ?? 0) + (order.financials?.packagingCost ?? 0))}
                        </div>
                      </div>

                      <div className="p-2.5 rounded-xl bg-card border border-border/60 space-y-0.5">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Payment</span>
                        <div className="font-mono font-bold text-foreground uppercase truncate">
                          {order.paymentMethod || 'COD'} • {order.paymentStatus || 'PAID'}
                        </div>
                      </div>
                    </div>

                    {/* Customer & Delivery address */}
                    {(order.customerPhone || order.customerAddress) && (
                      <div className="p-3 rounded-xl bg-card border border-border/60 space-y-1.5">
                        {order.customerPhone && (
                          <div className="flex items-center gap-2 text-xs">
                            <Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            <a 
                              href={`tel:${order.customerPhone}`}
                              className="font-mono text-primary font-semibold hover:underline"
                            >
                              {order.customerPhone}
                            </a>
                          </div>
                        )}
                        {order.customerAddress && (
                          <div className="flex items-start gap-2 text-xs text-muted-foreground pt-1 border-t border-border/40">
                            <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                            <span className="text-foreground">{order.customerAddress}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })
        )}
      </div>

      {/* Pagination Controls */}
      {totalCount > 0 && (
        <div className="p-3 rounded-2xl border border-border/60 bg-card shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="text-muted-foreground font-mono text-[11px]">
            Showing{' '}
            <strong className="text-foreground">
              {Math.min((page - 1) * 20 + 1, totalCount)}
            </strong>{' '}
            to{' '}
            <strong className="text-foreground">
              {Math.min(page * 20, totalCount)}
            </strong>{' '}
            of <strong className="text-foreground">{totalCount}</strong> orders
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || isPending}
              onClick={() => handleFetch(selectedKitchenId, selectedBrandId, dateRange, statusFilter, channelFilter, searchQuery, 1)}
              className="h-8 w-8 p-0 rounded-lg cursor-pointer disabled:opacity-40"
              title="First Page"
            >
              <ChevronsLeft className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || isPending}
              onClick={() => handleFetch(selectedKitchenId, selectedBrandId, dateRange, statusFilter, channelFilter, searchQuery, page - 1)}
              className="h-8 px-2.5 rounded-lg cursor-pointer disabled:opacity-40 gap-1"
              title="Previous Page"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Prev</span>
            </Button>

            <span className="px-2.5 font-mono text-xs font-bold text-foreground">
              Page {page} of {Math.ceil(totalCount / 20) || 1}
            </span>

            <Button
              variant="outline"
              size="sm"
              disabled={page >= Math.ceil(totalCount / 20) || isPending}
              onClick={() => handleFetch(selectedKitchenId, selectedBrandId, dateRange, statusFilter, channelFilter, searchQuery, page + 1)}
              className="h-8 px-2.5 rounded-lg cursor-pointer disabled:opacity-40 gap-1"
              title="Next Page"
            >
              <span className="hidden sm:inline">Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= Math.ceil(totalCount / 20) || isPending}
              onClick={() => handleFetch(selectedKitchenId, selectedBrandId, dateRange, statusFilter, channelFilter, searchQuery, Math.ceil(totalCount / 20))}
              className="h-8 w-8 p-0 rounded-lg cursor-pointer disabled:opacity-40"
              title="Last Page"
            >
              <ChevronsRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Bill & WhatsApp Receipt Dialog Modal */}
      <BillReceiptModal
        order={selectedReceiptOrder}
        open={Boolean(selectedReceiptOrder)}
        onOpenChange={(open) => {
          if (!open) setSelectedReceiptOrder(null);
        }}
      />
    </div>
  );
}
