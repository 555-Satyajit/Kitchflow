'use client'

import React, { useState } from 'react'
import { PurchaseOrder } from '@/types'
import { formatCurrency, cn } from '@/lib/utils'
import { 
  Plus, 
  Check, 
  Truck,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Download,
  FileSpreadsheet,
  Edit3
} from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface PurchaseOrderManagerModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  purchaseOrders: PurchaseOrder[]
  onReceivePO: (
    poId: string, 
    reconciledQuantities?: { [ingredientId: string]: number },
    discrepancyNote?: string
  ) => void
  onCreateNewPO: () => void
}

export function PurchaseOrderManagerModal({
  open,
  onOpenChange,
  purchaseOrders,
  onReceivePO,
  onCreateNewPO,
}: PurchaseOrderManagerModalProps) {
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'RECEIVED'>('ALL')
  const [receivingId, setReceivingId] = useState<string | null>(null)

  // Discrepancy & Intake Inspection Dialog State
  const [inspectingPO, setInspectingPO] = useState<PurchaseOrder | null>(null)
  const [receivedQtyMap, setReceivedQtyMap] = useState<{ [ingId: string]: number }>({})
  const [discrepancyReason, setDiscrepancyReason] = useState('')

  const pendingCount = purchaseOrders.filter((po) => po.status === 'PENDING_DELIVERY').length
  const receivedCount = purchaseOrders.filter((po) => po.status === 'RECEIVED' || po.status === 'PARTIALLY_RECEIVED').length

  const filteredOrders = purchaseOrders.filter((po) => {
    if (filter === 'PENDING') return po.status === 'PENDING_DELIVERY'
    if (filter === 'RECEIVED') return po.status === 'RECEIVED' || po.status === 'PARTIALLY_RECEIVED'
    return true
  })

  // Open intake reconciliation dialog
  const handleStartIntake = (po: PurchaseOrder) => {
    const initialMap: { [ingId: string]: number } = {}
    po.items.forEach((item) => {
      initialMap[item.ingredientId] = item.quantity
    })
    setReceivedQtyMap(initialMap)
    setDiscrepancyReason('')
    setInspectingPO(po)
  }

  // Quick 1-tap accept without changes
  const handleQuickReceive = (poId: string) => {
    setReceivingId(poId)
    setTimeout(() => {
      onReceivePO(poId)
      setReceivingId(null)
    }, 500)
  }

  // Confirm reconciled intake
  const handleConfirmReconciledIntake = () => {
    if (!inspectingPO) return
    setReceivingId(inspectingPO.id)
    onReceivePO(inspectingPO.id, receivedQtyMap, discrepancyReason.trim() || undefined)
    setInspectingPO(null)
    setTimeout(() => setReceivingId(null), 400)
  }

  // Export Purchase Orders to CSV (Excel / Accountant GST filing)
  const handleExportCSV = () => {
    if (purchaseOrders.length === 0) return

    const headers = [
      'PO Number',
      'Supplier Name',
      'Status',
      'Horizon',
      'Order Date',
      'Received Date',
      'Items Detail',
      'Estimated Cost (INR)',
      'Actual Cost (INR)',
      'Discrepancy Note',
    ]

    const rows = purchaseOrders.map((po) => {
      const itemsStr = po.items
        .map((it) => `${it.ingredientName}: ${it.receivedQuantity !== undefined ? it.receivedQuantity : it.quantity} ${it.unit}`)
        .join('; ')

      return [
        `"${po.poNumber}"`,
        `"${po.supplierName.replace(/"/g, '""')}"`,
        `"${po.status}"`,
        `"${po.horizon}"`,
        `"${new Date(po.createdAt).toLocaleDateString('en-IN')}"`,
        `"${po.receivedAt ? new Date(po.receivedAt).toLocaleDateString('en-IN') : 'N/A'}"`,
        `"${itemsStr.replace(/"/g, '""')}"`,
        po.totalEstimatedCost.toFixed(2),
        (po.actualCost !== undefined ? po.actualCost : po.totalEstimatedCost).toFixed(2),
        `"${(po.discrepancyNote || '').replace(/"/g, '""')}"`,
      ]
    })

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `KitchFlow_Supplier_POs_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent 
          side="right" 
          className="w-full sm:max-w-md p-0 flex flex-col justify-between bg-background border-l border-border"
        >
          {/* Clean Header Bar with dedicated top padding & close button clearance */}
          <div className="pt-6 pb-4 px-4 sm:px-5 border-b border-border/70 pr-12 bg-card/60">
            <SheetHeader className="p-0 text-left space-y-1">
              <SheetTitle className="flex items-center gap-2 text-base font-extrabold text-foreground">
                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Truck className="w-4 h-4" />
                </div>
                <span>Supplier Orders & POs</span>
              </SheetTitle>
              <SheetDescription className="text-xs text-muted-foreground leading-relaxed">
                Track vendor purchase indents, adjust intake discrepancies, and export GST logs.
              </SheetDescription>
            </SheetHeader>
          </div>

          {/* Content Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
            {/* Segmented Filter Bar and Action Buttons */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center bg-muted/70 p-1 rounded-xl border border-border/70 flex-1 min-w-0">
                <button
                  type="button"
                  onClick={() => setFilter('ALL')}
                  className={cn(
                    "flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all text-center cursor-pointer truncate",
                    filter === 'ALL'
                      ? "bg-background text-foreground shadow-2xs font-black"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  All ({purchaseOrders.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilter('PENDING')}
                  className={cn(
                    "flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all text-center cursor-pointer truncate",
                    filter === 'PENDING'
                      ? "bg-amber-500 text-white shadow-2xs font-black"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Pending ({pendingCount})
                </button>
                <button
                  type="button"
                  onClick={() => setFilter('RECEIVED')}
                  className={cn(
                    "flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all text-center cursor-pointer truncate",
                    filter === 'RECEIVED'
                      ? "bg-emerald-600 text-white shadow-2xs font-black"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Stocked ({receivedCount})
                </button>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleExportCSV}
                  title="Export POs to CSV / Excel for GST & accounting"
                  className="h-9 px-2.5 text-xs font-bold gap-1 border-border/80 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden xs:inline">Export</span>
                </Button>

                <Button
                  size="sm"
                  onClick={() => {
                    onOpenChange(false)
                    onCreateNewPO()
                  }}
                  className="h-9 px-3 text-xs font-bold gap-1 bg-primary text-primary-foreground hover:bg-primary/90 shrink-0 cursor-pointer shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New PO</span>
                </Button>
              </div>
            </div>

            {/* Orders List */}
            <div className="space-y-3 pt-1">
              {filteredOrders.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center text-center text-muted-foreground space-y-2 rounded-2xl border border-dashed border-border p-6">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                    <Truck className="w-6 h-6 text-muted-foreground/60" />
                  </div>
                  <p className="text-xs font-bold text-foreground">No purchase orders here</p>
                  <p className="text-[11px] max-w-xs text-muted-foreground">
                    Tap &quot;New PO&quot; above to create a stock indent for your kitchen suppliers.
                  </p>
                </div>
              ) : (
                filteredOrders.map((po) => {
                  const isPending = po.status === 'PENDING_DELIVERY'
                  const isPartiallyReceived = po.status === 'PARTIALLY_RECEIVED'
                  const isReceived = po.status === 'RECEIVED' || isPartiallyReceived
                  const isBeingProcessed = receivingId === po.id

                  const createdFormatted = new Date(po.createdAt).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })

                  return (
                    <div
                      key={po.id}
                      className={cn(
                        "p-3.5 rounded-xl border transition-all space-y-3 shadow-2xs",
                        isPending
                          ? "bg-amber-500/5 border-amber-500/40 dark:bg-amber-950/20"
                          : isPartiallyReceived
                          ? "bg-amber-500/5 border-amber-500/30"
                          : "bg-card border-border/80"
                      )}
                    >
                      {/* Header info */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono font-black text-xs text-foreground tracking-tight">
                              {po.poNumber}
                            </span>
                            <span
                              className={cn(
                                "text-[10px] font-bold px-2 py-0.5 rounded-md",
                                isPending
                                  ? "bg-amber-500 text-white"
                                  : isPartiallyReceived
                                  ? "bg-amber-600/15 text-amber-700 dark:text-amber-400 font-bold border border-amber-500/30"
                                  : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-bold"
                              )}
                            >
                              {isPending
                                ? 'Pending Delivery'
                                : isPartiallyReceived
                                ? 'Partially Delivered'
                                : 'Received & Stocked'}
                            </span>
                            <span className="text-[10px] font-mono text-muted-foreground px-1.5 py-0.5 bg-muted rounded">
                              {po.horizon}
                            </span>
                          </div>

                          <p className="text-xs font-bold text-foreground truncate">
                            {po.supplierName}
                          </p>
                          <p className="text-[10px] font-mono text-muted-foreground flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            <span>{createdFormatted}</span>
                          </p>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-sm font-black font-mono text-foreground block">
                            {formatCurrency(po.actualCost !== undefined ? po.actualCost : po.totalEstimatedCost)}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {po.items.length} {po.items.length === 1 ? 'item' : 'items'}
                          </span>
                        </div>
                      </div>

                      {/* Items Summary Pills */}
                      <div className="p-2.5 rounded-lg bg-muted/40 border border-border/60 text-[11px] space-y-1">
                        <div className="flex flex-wrap gap-1.5">
                          {po.items.map((it, idx) => {
                            const isShort = it.receivedQuantity !== undefined && it.receivedQuantity < it.quantity

                            return (
                              <span
                                key={idx}
                                className={cn(
                                  "inline-flex items-center gap-1 px-2 py-0.5 rounded bg-background border border-border/70 text-foreground font-medium text-[10px]",
                                  isShort && "border-amber-500/50 bg-amber-500/10 text-amber-800 dark:text-amber-300"
                                )}
                              >
                                <span>{it.ingredientName}:</span>
                                <strong className="font-mono font-bold text-primary">
                                  {it.receivedQuantity !== undefined ? it.receivedQuantity : it.quantity}
                                  {isShort ? `/${it.quantity}` : ''} {it.unit}
                                </strong>
                              </span>
                            )
                          })}
                        </div>
                      </div>

                      {/* Actions: Receive Button if Pending */}
                      {isPending && (
                        <div className="pt-0.5 grid grid-cols-2 gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => handleStartIntake(po)}
                            className="h-9 text-xs font-bold gap-1.5 border-border/80 hover:bg-muted cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-muted-foreground" />
                            <span>Inspect & Reconcile</span>
                          </Button>

                          <Button
                            type="button"
                            size="sm"
                            onClick={() => handleQuickReceive(po.id)}
                            disabled={isBeingProcessed}
                            className={cn(
                              "h-9 text-xs font-bold gap-1.5 cursor-pointer transition-all",
                              isBeingProcessed
                                ? "bg-emerald-600 text-white opacity-80"
                                : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                            )}
                          >
                            {isBeingProcessed ? (
                              <>
                                <Check className="w-3.5 h-3.5 animate-spin" />
                                <span>Updating...</span>
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>All Received</span>
                              </>
                            )}
                          </Button>
                        </div>
                      )}

                      {isReceived && (
                        <div className="space-y-1 pt-0.5 text-[10px]">
                          {po.receivedAt && (
                            <div className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>
                                Stock credited on{' '}
                                {new Date(po.receivedAt).toLocaleTimeString('en-IN', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>
                          )}
                          {po.discrepancyNote && (
                            <div className="text-amber-700 dark:text-amber-300 font-medium flex items-center gap-1 bg-amber-500/10 p-1.5 rounded border border-amber-500/30">
                              <AlertTriangle className="w-3 h-3 shrink-0" />
                              <span>Note: {po.discrepancyNote}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Clean Footer */}
          <div className="p-3 border-t border-border/60 bg-muted/30 flex items-center justify-between text-[10px] text-muted-foreground font-mono safe-area-pb">
            <span>{purchaseOrders.length} Total Indents</span>
            <button
              type="button"
              onClick={handleExportCSV}
              className="text-primary hover:underline font-bold flex items-center gap-1 cursor-pointer"
            >
              <FileSpreadsheet className="w-3 h-3" />
              <span>Download Excel/CSV</span>
            </button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Discrepancy & Intake Reconciliation Modal */}
      {inspectingPO && (
        <Dialog open={Boolean(inspectingPO)} onOpenChange={(open) => !open && setInspectingPO(null)}>
          <DialogContent className="max-w-md w-[95vw] p-4 sm:p-6 rounded-2xl">
            <DialogHeader className="text-left space-y-1">
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <Truck className="w-4 h-4 text-primary" />
                <span>Delivery Intake: {inspectingPO.poNumber}</span>
              </DialogTitle>
              <p className="text-xs text-muted-foreground">
                Verify physical quantities arrived from <strong>{inspectingPO.supplierName}</strong>. Adjust any short deliveries below.
              </p>
            </DialogHeader>

            <div className="space-y-3 py-2 max-h-[50vh] overflow-y-auto">
              {inspectingPO.items.map((it) => {
                const currentEntered = receivedQtyMap[it.ingredientId] !== undefined ? receivedQtyMap[it.ingredientId] : it.quantity
                const isShort = currentEntered < it.quantity

                return (
                  <div 
                    key={it.ingredientId} 
                    className={cn(
                      "p-3 rounded-xl border space-y-1.5 transition-all",
                      isShort ? "border-amber-500/60 bg-amber-500/5" : "border-border bg-card"
                    )}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-foreground">{it.ingredientName}</span>
                      <span className="font-mono text-muted-foreground text-[11px]">
                        Ordered: <strong>{it.quantity} {it.unit}</strong>
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-3 pt-1">
                      <span className="text-[11px] text-muted-foreground font-medium">
                        Actual Received:
                      </span>
                      <div className="flex items-center border border-border rounded-lg bg-background overflow-hidden">
                        <button
                          type="button"
                          onClick={() => {
                            const step = it.unit === 'g' || it.unit === 'ml' ? 100 : 1
                            setReceivedQtyMap((prev) => ({
                              ...prev,
                              [it.ingredientId]: Math.max(0, currentEntered - step),
                            }))
                          }}
                          className="px-2.5 py-1 text-xs font-bold text-muted-foreground hover:bg-muted cursor-pointer"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          value={currentEntered}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value)
                            setReceivedQtyMap((prev) => ({
                              ...prev,
                              [it.ingredientId]: isNaN(val) ? 0 : Math.max(0, val),
                            }))
                          }}
                          className="w-16 text-center font-mono font-bold text-xs bg-transparent border-0 outline-none text-foreground py-1"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const step = it.unit === 'g' || it.unit === 'ml' ? 100 : 1
                            setReceivedQtyMap((prev) => ({
                              ...prev,
                              [it.ingredientId]: currentEntered + step,
                            }))
                          }}
                          className="px-2.5 py-1 text-xs font-bold text-muted-foreground hover:bg-muted cursor-pointer"
                        >
                          +
                        </button>
                        <span className="px-1.5 text-[10px] font-mono font-bold text-muted-foreground bg-muted/40 border-l border-border h-full flex items-center">
                          {it.unit}
                        </span>
                      </div>
                    </div>
                    {isShort && (
                      <p className="text-[10px] font-bold text-amber-600 flex items-center gap-1 pt-0.5">
                        <AlertTriangle className="w-3 h-3" />
                        <span>Short by {it.quantity - currentEntered} {it.unit} (Bill will adjust automatically)</span>
                      </p>
                    )}
                  </div>
                )
              })}

              <div className="space-y-1.5 pt-1">
                <Label htmlFor="disc-note" className="text-xs">Discrepancy / Intake Note</Label>
                <Input
                  id="disc-note"
                  placeholder="e.g. Vendor delivery van was short 3kg on chicken"
                  value={discrepancyReason}
                  onChange={(e) => setDiscrepancyReason(e.target.value)}
                  className="text-xs h-9"
                />
              </div>
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setInspectingPO(null)}
                className="w-full sm:w-auto text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleConfirmReconciledIntake}
                className="w-full sm:w-auto text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                Confirm Intake & Credit Stock
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
