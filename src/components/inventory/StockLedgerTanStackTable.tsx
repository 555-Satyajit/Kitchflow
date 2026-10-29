'use client';

import React, { useState, useMemo } from 'react';
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
  History, 
  Search, 
  Download, 
  ChevronDown, 
  ChevronUp, 
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight
} from 'lucide-react';
import { StockLedgerEntry } from '@/types';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface StockLedgerTanStackTableProps {
  stockLedger: StockLedgerEntry[];
}

export function StockLedgerTanStackTable({ stockLedger }: StockLedgerTanStackTableProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'timestamp', desc: true } // Default most recent logs first
  ]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [reasonFilter, setReasonFilter] = useState<string>('ALL');
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 15,
  });

  const columns = useMemo<ColumnDef<StockLedgerEntry>[]>(
    () => [
      {
        accessorKey: 'timestamp',
        header: ({ column }) => (
          <button
            type="button"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="flex items-center gap-1 font-bold uppercase tracking-wider text-[10px] text-muted-foreground hover:text-foreground cursor-pointer select-none font-mono"
          >
            <span>Time</span>
            {column.getIsSorted() === 'asc' ? (
              <ChevronUp className="w-3 h-3 text-primary" />
            ) : column.getIsSorted() === 'desc' ? (
              <ChevronDown className="w-3 h-3 text-primary" />
            ) : (
              <ChevronsUpDown className="w-3 h-3 opacity-40" />
            )}
          </button>
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground text-[11px] font-mono whitespace-nowrap">
            {new Date(row.original.timestamp).toLocaleString('en-IN', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        ),
      },
      {
        accessorKey: 'ingredientName',
        header: ({ column }) => (
          <button
            type="button"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="flex items-center gap-1 font-bold uppercase tracking-wider text-[10px] text-muted-foreground hover:text-foreground cursor-pointer select-none font-mono"
          >
            <span>Ingredient</span>
            {column.getIsSorted() === 'asc' ? (
              <ChevronUp className="w-3 h-3 text-primary" />
            ) : column.getIsSorted() === 'desc' ? (
              <ChevronDown className="w-3 h-3 text-primary" />
            ) : (
              <ChevronsUpDown className="w-3 h-3 opacity-40" />
            )}
          </button>
        ),
        cell: ({ row }) => (
          <span className="font-bold text-foreground text-xs whitespace-nowrap">
            {row.original.ingredientName}
          </span>
        ),
      },
      {
        accessorKey: 'reason',
        header: () => (
          <span className="font-bold uppercase tracking-wider text-[10px] text-muted-foreground font-mono">
            Reason Code
          </span>
        ),
        cell: ({ row }) => {
          const reason = row.original.reason;
          const isPurchase = reason === 'PURCHASE_INFLOW';
          return (
            <Badge
              className={cn(
                'text-[10px] font-medium font-sans uppercase px-2 py-0.5 rounded-full border whitespace-nowrap',
                reason === 'WASTAGE_SPOILAGE'
                  ? 'bg-destructive/15 text-destructive border-destructive/30'
                  : isPurchase
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                  : 'bg-muted text-muted-foreground border-border/80'
              )}
            >
              {reason.replace(/_/g, ' ')}
            </Badge>
          );
        },
      },
      {
        accessorKey: 'delta',
        header: ({ column }) => (
          <button
            type="button"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="flex items-center gap-1 font-bold uppercase tracking-wider text-[10px] text-muted-foreground hover:text-foreground cursor-pointer select-none font-mono justify-end w-full"
          >
            <span>Change</span>
            {column.getIsSorted() === 'asc' ? (
              <ChevronUp className="w-3 h-3 text-primary" />
            ) : column.getIsSorted() === 'desc' ? (
              <ChevronDown className="w-3 h-3 text-primary" />
            ) : (
              <ChevronsUpDown className="w-3 h-3 opacity-40" />
            )}
          </button>
        ),
        cell: ({ row }) => {
          const delta = row.original.delta;
          const isDeduction = delta < 0;
          return (
            <div className="text-right font-bold font-mono text-xs whitespace-nowrap">
              <span className={isDeduction ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400'}>
                {delta > 0 ? `+${delta}` : delta} {row.original.unit}
              </span>
            </div>
          );
        },
      },
      {
        accessorKey: 'newStock',
        header: () => (
          <span className="font-bold uppercase tracking-wider text-[10px] text-muted-foreground font-mono text-right block w-full">
            Balance
          </span>
        ),
        cell: ({ row }) => (
          <div className="text-right font-mono font-bold text-xs text-foreground whitespace-nowrap">
            {row.original.newStock} {row.original.unit}
          </div>
        ),
      },
      {
        accessorKey: 'note',
        header: () => (
          <span className="font-bold uppercase tracking-wider text-[10px] text-muted-foreground font-mono">
            Audit Note
          </span>
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground font-sans text-xs min-w-[140px] truncate block">
            {row.original.note || 'Manual line adjustment'}
          </span>
        ),
      },
    ],
    []
  );

  const filteredData = useMemo(() => {
    if (reasonFilter === 'ALL') return stockLedger;
    return stockLedger.filter((e) => e.reason === reasonFilter);
  }, [stockLedger, reasonFilter]);

  const table = useReactTable({
    data: filteredData,
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
    <div className="space-y-3">
      {/* Search & Export Action Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={globalFilter ?? ''}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder="Search ingredient or reason in ledger..."
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-background border border-border/70 focus:outline-none focus:ring-2 focus:ring-primary/40 text-foreground placeholder:text-muted-foreground shadow-2xs"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Reason Code Pill Quick Selector */}
          <select
            value={reasonFilter}
            onChange={(e) => setReasonFilter(e.target.value)}
            className="h-9 px-2.5 text-xs font-semibold rounded-xl border border-border/70 bg-background shadow-2xs focus:outline-none"
          >
            <option value="ALL">All Audit Reasons</option>
            <option value="WASTAGE_SPOILAGE">Wastage & Spoilage</option>
            <option value="PURCHASE_INFLOW">Purchase Inflow</option>
            <option value="RECIPE_AUTO_CONSUMPTION">Cook Consumption</option>
            <option value="AUDIT_CORRECTION">Audit Correction</option>
          </select>

          {/* Export CSV Button */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const headers = ['Timestamp', 'Ingredient', 'Reason', 'Previous Stock', 'Delta', 'New Stock', 'Unit', 'Note'];
              const rows = filteredData.map((e) => [
                `"${new Date(e.timestamp).toLocaleString('en-IN')}"`,
                `"${e.ingredientName.replace(/"/g, '""')}"`,
                `"${e.reason}"`,
                e.previousStock,
                e.delta,
                e.newStock,
                `"${e.unit}"`,
                `"${(e.note || '').replace(/"/g, '""')}"`,
              ]);
              const csv = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
              const link = document.createElement('a');
              link.setAttribute('href', encodeURI(csv));
              link.setAttribute('download', `KitchFlow_Stock_Ledger_${new Date().toISOString().slice(0, 10)}.csv`);
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }}
            className="h-9 px-3 text-xs font-semibold rounded-xl gap-1.5 border-border/80 bg-background/80 hover:bg-muted active:scale-[0.98] transition-all cursor-pointer shadow-2xs"
          >
            <Download className="w-3.5 h-3.5 text-muted-foreground" />
            <span>Export CSV</span>
          </Button>
          <Badge variant="outline" className="font-mono text-[11px] h-9 px-2.5 rounded-xl border-border/80 bg-muted/40">
            {filteredData.length} Logs
          </Badge>
        </div>
      </div>

      {/* TanStack Table View */}
      <div className="overflow-x-auto rounded-xl border border-border/70 bg-background/50">
        <table className="min-w-[640px] w-full text-left text-xs divide-y divide-border/60">
          <thead className="bg-muted/50 text-[10px] font-bold text-muted-foreground uppercase tracking-wider font-mono">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="py-3 px-3.5 whitespace-nowrap">
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-border/50 font-mono">
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-12 text-center text-muted-foreground text-xs font-sans">
                  <p className="font-semibold text-foreground">No ledger events recorded</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Adjust stock or fulfill purchase orders to create audit entries.
                  </p>
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="hover:bg-muted/30 transition-colors">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="py-2.5 px-3.5">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* TanStack Table Pagination Controls */}
      {filteredData.length > 0 && (
        <div className="p-3 rounded-xl border border-border/60 bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="text-muted-foreground font-mono text-[11px]">
            Showing{' '}
            <strong className="text-foreground">
              {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}
            </strong>{' '}
            to{' '}
            <strong className="text-foreground">
              {Math.min(
                (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
                filteredData.length
              )}
            </strong>{' '}
            of <strong className="text-foreground">{filteredData.length}</strong> events
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
              className="h-8 w-8 p-0 rounded-lg cursor-pointer disabled:opacity-40"
              title="First Page"
            >
              <ChevronsLeft className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="h-8 w-8 p-0 rounded-lg cursor-pointer disabled:opacity-40"
              title="Previous Page"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>

            <span className="px-2 font-mono text-xs font-bold text-foreground">
              Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount() || 1}
            </span>

            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="h-8 w-8 p-0 rounded-lg cursor-pointer disabled:opacity-40"
              title="Next Page"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
              className="h-8 w-8 p-0 rounded-lg cursor-pointer disabled:opacity-40"
              title="Last Page"
            >
              <ChevronsRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

