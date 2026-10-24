'use client'

import React, { use, Suspense } from 'react'
import { useKitchen } from '@/context/KitchenContext'
import { Order } from '@/types'
import { Download, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { pdf } from '@react-pdf/renderer'
import { RealBillPdfDocument } from '@/components/pos/RealBillPdfDocument'

export default function InvoicePublicPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center p-4 bg-zinc-50 font-sans">
        <div className="text-xs font-mono text-zinc-400">Loading invoice...</div>
      </div>
    }>
      <InvoiceContent params={params} />
    </Suspense>
  )
}

function InvoiceContent({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const orderId = resolvedParams.id
  const { orders } = useKitchen()
  const [order, setOrder] = React.useState<Order | null>(null)
  const [mounted, setMounted] = React.useState(false)
  const [isDownloading, setIsDownloading] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
    let found = orders.find((o) => o.id === orderId || o.orderNumber.replace(/[^a-zA-Z0-9]/g, '') === orderId)
    if (!found) {
      try {
        const stored = localStorage.getItem(`kitchflow_order_${orderId}`)
        if (stored) found = JSON.parse(stored)
      } catch (e) {
        console.error(e)
      }
    }
    setOrder(found || null)
  }, [orderId, orders])

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-zinc-50 font-sans">
        <div className="text-xs font-mono text-zinc-400">Loading invoice...</div>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-zinc-50 font-sans">
        <div className="max-w-md w-full bg-white p-6 rounded-2xl border border-zinc-200 text-center space-y-4 shadow-sm">
          <h2 className="text-base font-bold text-zinc-900">Invoice Not Found</h2>
          <p className="text-xs text-zinc-500">
            This bill reference does not exist or has expired. Please contact kitchen support.
          </p>
        </div>
      </div>
    )
  }

  const itemsTotal = order.items.reduce((s, it) => s + it.price * it.quantity, 0)
  const gstAmount = Math.round(itemsTotal * 0.05)
  const netAmount = itemsTotal + gstAmount

  const handleDownloadPdf = async () => {
    if (!order) return
    try {
      setIsDownloading(true)
      const blob = await pdf(<RealBillPdfDocument order={order} />).toBlob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `Bill-${order.orderNumber.replace(/[^a-zA-Z0-9]/g, '')}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Error generating PDF', err)
      window.print()
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-100 py-8 px-4 flex flex-col items-center justify-start print:bg-white print:p-0">
      {/* Customer Action Bar: Download PDF only (No links to internal POS / Orders / Kitchen) */}
      <div className="w-full max-w-md flex items-center justify-end mb-4 print:hidden">
        <Button
          onClick={handleDownloadPdf}
          disabled={isDownloading}
          size="sm"
          className="h-9 px-4 text-xs font-bold gap-2 bg-zinc-900 hover:bg-zinc-800 text-white cursor-pointer shadow-sm rounded-xl transition-all"
        >
          {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          <span>Download Official Bill (PDF)</span>
        </Button>
      </div>

      {/* Tax Invoice Bill Sheet */}
      <div 
        id="official-customer-invoice"
        className="w-full max-w-md bg-white p-6 rounded-2xl border border-zinc-200 shadow-md font-mono text-xs space-y-4 print:shadow-none print:border-none print:p-0 print:w-full"
      >
        {/* Header */}
        <div className="text-center space-y-1 border-b border-dashed border-zinc-300 pb-4">
          <h1 className="text-lg font-black tracking-tight text-zinc-900 uppercase">
            {order.brandName}
          </h1>
          <p className="text-[11px] text-zinc-600">Authentic Multi-Brand Cloud Kitchen</p>
          <p className="text-[10px] text-zinc-400">
            GSTIN: 27AABCU9603R1ZM • FSSAI Lic: 11521018000452
          </p>
        </div>

        {/* Invoice Meta */}
        <div className="space-y-1.5 border-b border-dashed border-zinc-300 pb-3 text-[11px]">
          <div className="flex justify-between">
            <span className="text-zinc-500">Invoice No:</span>
            <span className="font-bold text-zinc-900">{order.orderNumber}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">Date & Time:</span>
            <span className="text-zinc-800">
              {new Date(order.createdAt).toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">Customer:</span>
            <span className="font-semibold text-zinc-900">{order.customerName || 'Walk-in Guest'}</span>
          </div>
          {order.customerPhone && (
            <div className="flex justify-between">
              <span className="text-zinc-500">Phone:</span>
              <span className="text-zinc-800">{order.customerPhone}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-zinc-500">Order Channel:</span>
            <span className="font-bold text-zinc-800 uppercase">{order.channel}</span>
          </div>
        </div>

        {/* Items Table */}
        <div className="space-y-2 border-b border-dashed border-zinc-300 pb-4">
          <div className="flex justify-between text-[10px] font-bold text-zinc-400 uppercase tracking-wider pb-1">
            <span>Item Description</span>
            <div className="flex gap-4">
              <span>Qty</span>
              <span className="w-14 text-right">Amount</span>
            </div>
          </div>
          {order.items.map((it) => (
            <div key={it.id} className="flex justify-between items-center text-[11px]">
              <span className="truncate max-w-[210px] font-medium text-zinc-900">
                {it.name}
              </span>
              <div className="flex gap-4 items-center">
                <span className="w-6 text-center text-zinc-600 font-bold">{it.quantity}</span>
                <span className="w-14 text-right font-bold text-zinc-900">
                  ₹{it.price * it.quantity}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Calculations */}
        <div className="space-y-1.5 border-b border-dashed border-zinc-300 pb-3 text-[11px]">
          <div className="flex justify-between text-zinc-600">
            <span>Item Subtotal:</span>
            <span>₹{itemsTotal}</span>
          </div>
          <div className="flex justify-between text-[10px] text-zinc-500">
            <span>CGST (2.5%):</span>
            <span>₹{(gstAmount / 2).toFixed(1)}</span>
          </div>
          <div className="flex justify-between text-[10px] text-zinc-500">
            <span>SGST (2.5%):</span>
            <span>₹{(gstAmount / 2).toFixed(1)}</span>
          </div>
          <div className="flex justify-between text-sm font-black pt-2 border-t border-zinc-200 text-zinc-900">
            <span>GRAND TOTAL:</span>
            <span>₹{netAmount}</span>
          </div>
        </div>

        {/* Payment Details */}
        <div className="flex justify-between items-center text-[11px] pt-1">
          <span className="text-zinc-500">Payment Mode:</span>
          <span className="font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-zinc-100 text-zinc-900 border border-zinc-200">
            {order.paymentMethod || 'CASH'} • {order.paymentStatus || 'PAID'}
          </span>
        </div>

        {/* Footer */}
        <div className="text-center text-[9px] text-zinc-400 pt-4 space-y-0.5">
          <p>This is a computer generated invoice.</p>
          <p>Thank you for ordering with {order.brandName}!</p>
        </div>
      </div>
    </div>
  )
}
