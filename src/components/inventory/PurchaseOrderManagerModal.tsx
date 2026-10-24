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
          <div className="pt-6 pb-4 px-4 sm:px-5 border-b border-border/70 pr-12 bg-card/60 backdrop-blur-md">
            <SheetHeader className="p-0 text-left space-y-1">
              <SheetTitle className="flex items-center gap-2.5 text-base font-extrabold text-foreground">
                <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0 shadow-inner">
                  <Truck className="w-4.5 h-4.5" />
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
            {/* Top Action Row: Primary New PO button & Export Action */}
            <div className="flex items-center justify-between gap-2.5">
              <Button
                size="sm"
                onClick={() => {
                  onOpenChange(false)
                  onCreateNewPO()
                }}
                className="flex-1 h-10 px-4 text-xs font-bold gap-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer shadow-sm active:scale-[0.98] transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Create New PO</span>
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={handleExportCSV}
                title="Export POs to CSV / Excel for GST & accounting"
                className="h-10 px-3.5 rounded-xl text-xs font-semibold gap-1.5 border-border/80 bg-card hover:bg-muted/50 cursor-pointer shadow-2xs active:scale-[0.98] transition-all"
              >
                <Download className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Export</span>
              </Button>
            </div>

            {/* Apple Full-Width Segmented Tab Control */}
            <div className="grid grid-cols-3 gap-1 bg-muted/50 p-1 rounded-2xl border border-border/60 text-xs font-semibold shadow-2xs">
              <button
                type="button"
                onClick={() => setFilter('ALL')}
                className={cn(
                  "h-8.5 rounded-xl transition-all cursor-pointer text-center flex items-center justify-center gap-1.5 active:scale-[0.98]",
                  filter === 'ALL'
                    ? "bg-background text-foreground shadow-sm font-bold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span>All</span>
                <span className="text-[10px] font-mono text-muted-foreground font-bold">({purchaseOrders.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setFilter('PENDING')}
                className={cn(
                  "h-8.5 rounded-xl transition-all cursor-pointer text-center flex items-center justify-center gap-1.5 active:scale-[0.98]",
                  filter === 'PENDING'
                    ? "bg-background text-amber-600 dark:text-amber-400 shadow-sm font-bold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span>Pending</span>
                {pendingCount > 0 && (
                  <span className="h-4.5 px-1.5 rounded-full bg-amber-500 text-white text-[10px] font-mono font-bold flex items-center justify-center">
                    {pendingCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setFilter('RECEIVED')}
                className={cn(
                  "h-8.5 rounded-xl transition-all cursor-pointer text-center flex items-center justify-center gap-1.5 active:scale-[0.98]",
                  filter === 'RECEIVED'
                    ? "bg-background text-emerald-600 dark:text-emerald-400 shadow-sm font-bold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span>Stocked</span>
                {receivedCount > 0 && (
                  <span className="text-[10px] font-mono text-muted-foreground font-bold">({receivedCount})</span>
                )}
              </button>
            </div>

            {/* Orders List */}
            <div className="space-y-3.5 pt-1">
              {filteredOrders.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center text-center text-muted-foreground space-y-2 rounded-3xl border border-dashed border-border/80 p-6 bg-muted/20">
                  <div className="w-12 h-12 rounded-2xl bg-muted/60 flex items-center justify-center mx-auto text-muted-foreground/60">
                    <Truck className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-bold text-foreground">No purchase orders here</p>
                  <p className="text-xs max-w-xs text-muted-foreground leading-relaxed">
                    Tap &quot;Create New PO&quot; above to generate a stock indent for your kitchen suppliers.
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
                        "p-4 rounded-2xl border transition-all space-y-3.5 shadow-2xs backdrop-blur-sm",
                        isPending
                          ? "bg-amber-500/5 border-amber-500/40 ring-1 ring-amber-500/10"
                          : isPartiallyReceived
                          ? "bg-amber-500/5 border-amber-500/30"
                          : "bg-card/90 border-border/80"
                      )}
                    >
                      {/* Header info */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono font-extrabold text-sm text-foreground tracking-tight">
                              {po.poNumber}
                            </span>
                            <span
                              className={cn(
                                "text-[10px] font-bold px-2 py-0.5 rounded-lg border-none",
                                isPending
                                  ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 font-bold"
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
                            <span className="text-[10px] font-mono text-muted-foreground px-1.5 py-0.5 bg-muted rounded-md">
                              {po.horizon}
                            </span>
                          </div>

                          <p className="text-xs font-bold text-foreground truncate pt-0.5">
                            {po.supplierName}
                          </p>
                          <p className="text-[10px] font-mono text-muted-foreground flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-muted-foreground/70" />
                            <span>{createdFormatted}</span>
                          </p>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-base font-extrabold font-mono text-foreground block">
                            {formatCurrency(po.actualCost !== undefined ? po.actualCost : po.totalEstimatedCost)}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {po.items.length} {po.items.length === 1 ? 'item' : 'items'}
                          </span>
                        </div>
                      </div>

                      {/* Items Summary Pills (Clean Apple Inset Pill Style) */}
                      <div className="p-2.5 rounded-xl bg-muted/40 border border-border/50 text-xs">
                        <div className="flex flex-wrap gap-1.5">
                          {po.items.map((it, idx) => {
                            const isShort = it.receivedQuantity !== undefined && it.receivedQuantity < it.quantity

                            return (
                              <span
                                key={idx}
                                className={cn(
                                  "inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-background border border-border/70 text-foreground text-[11px] font-medium shadow-2xs",
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

                      {/* Actions: Receive Button if Pending (Apple 42px Touch Targets) */}
                      {isPending && (
                        <div className="pt-1 grid grid-cols-2 gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => handleStartIntake(po)}
                            className="h-10 text-xs font-bold gap-1.5 rounded-xl border-border/80 bg-background hover:bg-muted/50 cursor-pointer active:scale-[0.98] transition-all shadow-2xs"
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
                              "h-10 text-xs font-bold gap-1.5 rounded-xl cursor-pointer active:scale-[0.98] transition-all shadow-sm",
                              isBeingProcessed
                                ? "bg-emerald-600 text-white opacity-80"
                                : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20"
                            )}
                          >
                            {isBeingProcessed ? (
                              <>
                                <Check className="w-3.5 h-3.5 animate-spin" />
                                <span>Updating...</span>
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="w-4 h-4" />
                                <span>All Received</span>
                              </>
                            )}
                          </Button>
                        </div>
                      )}

                      {isReceived && (
                        <div className="space-y-1 pt-1 text-[11px]">
                          {po.receivedAt && (
                            <div className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1.5 font-mono">
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
                            <div className="text-amber-700 dark:text-amber-300 font-medium flex items-center gap-1.5 bg-amber-500/10 p-2 rounded-xl border border-amber-500/30">
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
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

          {/* Clean Footer Bar */}
          <div className="p-3.5 border-t border-border/70 bg-card/80 backdrop-blur-md flex items-center justify-between text-xs text-muted-foreground font-mono safe-area-pb">
            <span className="font-semibold text-foreground/80">{purchaseOrders.length} Total Indents</span>
            <button
              type="button"
              onClick={handleExportCSV}
              className="text-primary hover:underline font-bold flex items-center gap-1.5 cursor-pointer active:scale-[0.98] transition-all"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Download Excel/CSV</span>
            </button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Discrepancy & Intake Reconciliation Modal (Apple HIG Inset Modal) */}
      {inspectingPO && (
        <Dialog open={Boolean(inspectingPO)} onOpenChange={(open) => !open && setInspectingPO(null)}>
          <DialogContent className="max-w-md w-[95vw] p-5 sm:p-6 rounded-3xl border border-border/80 bg-card/95 backdrop-blur-xl shadow-2xl space-y-4">
            <DialogHeader className="text-left space-y-1.5 pb-1 border-b border-border/60">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0 shadow-inner">
                  <Truck className="w-4 h-4" />
                </div>
                <div>
                  <DialogTitle className="text-base font-extrabold text-foreground flex items-center gap-2">
                    <span>Delivery Intake</span>
                    <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-muted text-foreground">
                      {inspectingPO.poNumber}
                    </span>
                  </DialogTitle>
                </div>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed pt-1">
                Verify physical items delivered by <strong className="text-foreground">{inspectingPO.supplierName}</strong>. Adjust any damaged or short items below.
              </p>
            </DialogHeader>

            <div className="space-y-3 py-1 max-h-[50vh] overflow-y-auto no-scrollbar">
              {inspectingPO.items.map((it) => {
                const currentEntered = receivedQtyMap[it.ingredientId] !== undefined ? receivedQtyMap[it.ingredientId] : it.quantity
                const isShort = currentEntered < it.quantity

                return (
                  <div 
                    key={it.ingredientId} 
                    className={cn(
                      "p-3.5 rounded-2xl border space-y-2.5 transition-all shadow-2xs",
                      isShort 
                        ? "border-amber-500/50 bg-amber-500/5 ring-1 ring-amber-500/20" 
                        : "border-border/80 bg-muted/20"
                    )}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-foreground">{it.ingredientName}</span>
                      <span className="font-mono text-muted-foreground text-[11px] bg-background/80 px-2 py-0.5 rounded-md border border-border/60">
                        Ordered: <strong className="text-foreground">{it.quantity} {it.unit}</strong>
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-3 pt-0.5">
                      <span className="text-[11px] text-muted-foreground font-semibold">
                        Actual Received:
                      </span>
                      
                      {/* Apple HIG iOS Stepper Control */}
                      <div className="flex items-center gap-1.5 bg-background p-1 rounded-xl border border-border/80 shadow-2xs">
                        <button
                          type="button"
                          onClick={() => {
                            const step = it.unit === 'g' || it.unit === 'ml' ? 100 : 1
                            setReceivedQtyMap((prev) => ({
                              ...prev,
                              [it.ingredientId]: Math.max(0, currentEntered - step),
                            }))
                          }}
                          className="w-8 h-8 rounded-lg bg-muted/60 hover:bg-muted text-foreground font-bold text-sm flex items-center justify-center active:scale-90 transition-all cursor-pointer"
                        >
                          −
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
                          className="w-16 text-center font-mono font-extrabold text-sm bg-transparent border-0 outline-hidden text-foreground py-0.5"
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
                          className="w-8 h-8 rounded-lg bg-muted/60 hover:bg-muted text-foreground font-bold text-sm flex items-center justify-center active:scale-90 transition-all cursor-pointer"
                        >
                          +
                        </button>

                        <span className="px-2 text-[11px] font-mono font-bold text-muted-foreground border-l border-border/60 pl-2">
                          {it.unit}
                        </span>
                      </div>
                    </div>

                    {isShort && (
                      <div className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1.5 pt-1 bg-amber-500/10 p-2 rounded-xl border border-amber-500/20">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>Short by {it.quantity - currentEntered} {it.unit} (Bill adjusts automatically)</span>
                      </div>
                    )}
                  </div>
                )
              })}

              <div className="space-y-1.5 pt-2">
                <Label htmlFor="disc-note" className="text-xs font-semibold text-foreground">
                  Intake or Discrepancy Remarks
                </Label>
                <Input
                  id="disc-note"
                  placeholder="e.g. Vendor delivery van was short 3kg on chicken"
                  value={discrepancyReason}
                  onChange={(e) => setDiscrepancyReason(e.target.value)}
                  className="text-xs h-10 rounded-xl bg-background border-border/80 text-foreground placeholder:text-muted-foreground/70"
                />
              </div>
            </div>

            <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 pt-2 border-t border-border/60">
              <Button
                type="button"
                variant="outline"
                onClick={() => setInspectingPO(null)}
                className="w-full sm:w-auto h-11 rounded-xl text-xs font-semibold border-border/80 hover:bg-muted/50 active:scale-[0.98] transition-all"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleConfirmReconciledIntake}
                className="w-full sm:flex-1 h-11 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20 active:scale-[0.98] transition-all gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirm Intake & Credit Stock</span>
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}

