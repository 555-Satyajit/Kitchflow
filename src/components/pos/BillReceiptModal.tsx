'use client'

import React from 'react'
import { Order } from '@/types'
import { formatCurrency } from '@/lib/utils'
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { 
  Printer, 
  Share2, 
  CheckCircle2, 
  Receipt, 
  Phone,
  QrCode,
  CreditCard,
  Banknote,
  Clock,
  ArrowRight,
  Download,
  ExternalLink
} from 'lucide-react'
import { RealBillPdfDocument } from '@/components/pos/RealBillPdfDocument'
import { pdf } from '@react-pdf/renderer'

interface BillReceiptModalProps {
  order: Order | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onDone?: () => void
}

export function BillReceiptModal({
  order,
  open,
  onOpenChange,
  onDone
}: BillReceiptModalProps) {
  const [isGeneratingPdf, setIsGeneratingPdf] = React.useState(false)

  if (!order) return null

  const itemsTotal = order.items.reduce((s, it) => s + it.price * it.quantity, 0)
  const gstAmount = Math.round(itemsTotal * 0.05)
  const netAmount = itemsTotal + gstAmount

  // Public bill link
  const cleanId = order.id
  const publicInvoiceUrl = typeof window !== 'undefined' ? `${window.location.origin}/invoice/${cleanId}` : `/invoice/${cleanId}`

  // WhatsApp formatted receipt text with direct live digital invoice URL
  const generateWhatsAppMessage = () => {
    const formattedDate = new Date(order.createdAt).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })

    const paymentLabel = order.paymentMethod === 'COD' 
      ? 'Cash on Delivery (COD)'
      : order.paymentMethod === 'UPI' 
      ? 'UPI / QR Payment'
      : order.paymentMethod === 'CARD'
      ? 'Card / EDC'
      : order.paymentMethod === 'DUE'
      ? 'Pay Later / Tab'
      : 'Cash'

    const paymentStatusBadge = order.paymentStatus === 'PAID' ? 'PAID' : 'PENDING'

    const lines: string[] = [
      `------------------------------------`,
      `*${order.brandName.toUpperCase()}*`,
      `Official Tax Invoice & Receipt`,
      `------------------------------------`,
      `*Order #:* ${order.orderNumber}`,
      `*Date:* ${formattedDate}`,
      order.customerName ? `*Customer:* ${order.customerName}` : '',
      order.customerPhone ? `*Phone:* ${order.customerPhone}` : '',
      `------------------------------------`,
      `*ITEMS ORDERED:*`,
      ...order.items.map((it) => `- ${it.quantity}x ${it.name}: Rs. ${it.price * it.quantity}`),
      `------------------------------------`,
      `*Item Subtotal:* Rs. ${itemsTotal}`,
      `*GST (5%):* Rs. ${gstAmount}`,
      `*TOTAL AMOUNT:* *Rs. ${netAmount}*`,
      `------------------------------------`,
      `*Payment Mode:* ${paymentLabel}`,
      `*Payment Status:* ${paymentStatusBadge}`,
      `------------------------------------`,
      `*View or Download Official Bill (PDF):*`,
      publicInvoiceUrl,
      `------------------------------------`,
      `Thank you for ordering with ${order.brandName}.`,
      `Please visit again.`,
      `------------------------------------`
    ].filter(Boolean)

    return lines.join('\n')
  }

  const handleDownloadPdf = async () => {
    try {
      setIsGeneratingPdf(true)
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
      console.error('Failed generating vector PDF receipt', err)
      window.print()
    } finally {
      setIsGeneratingPdf(false)
    }
  }

  const handleSendWhatsApp = () => {
    const rawPhone = (order.customerPhone || '').replace(/\D/g, '')
    // Ensure 10 digits gets prefixed with India country code 91
    let phone = rawPhone
    if (phone.length === 10) phone = `91${phone}`
    
    const message = encodeURIComponent(generateWhatsAppMessage())
    const url = phone ? `https://wa.me/${phone}?text=${message}` : `https://wa.me/?text=${message}`
    window.open(url, '_blank')
  }

  const handlePrint = () => {
    const printableElement = document.getElementById('printable-kitchen-receipt')
    if (!printableElement) {
      window.print()
      return
    }

    const printWindow = window.open('', '_blank', 'width=420,height=600')
    if (!printWindow) {
      // Only fallback to window.print() if browser popup was blocked
      window.print()
      return
    }

    const receiptHtml = printableElement.outerHTML
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Receipt - ${order.orderNumber}</title>
          <style>
            @page {
              size: 80mm 200mm;
              margin: 2mm;
            }
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Courier New", Courier, monospace;
              background: #fff;
              color: #000;
              width: 74mm;
              margin: 0 auto;
              padding: 2mm 0;
              font-size: 11px;
              line-height: 1.35;
            }
            #printable-kitchen-receipt {
              border: none !important;
              box-shadow: none !important;
              padding: 0 !important;
              background: transparent !important;
              width: 100% !important;
            }
            .text-center { text-align: center; }
            .uppercase { text-transform: uppercase; }
            .font-black { font-weight: 900; }
            .font-bold { font-weight: 700; }
            .font-semibold { font-weight: 600; }
            .font-medium { font-weight: 500; }
            .text-zinc-900 { color: #000; }
            .text-zinc-800 { color: #111; }
            .text-zinc-600 { color: #444; }
            .text-zinc-500 { color: #666; }
            .text-zinc-400 { color: #888; }
            .border-b { border-bottom: 1px dashed #999; }
            .border-t { border-top: 1px dashed #999; }
            .pb-2 { padding-bottom: 5px; }
            .pb-3 { padding-bottom: 7px; }
            .pt-1 { padding-top: 4px; }
            .pt-2 { padding-top: 6px; }
            .space-y-1 > * + * { margin-top: 2px; }
            .space-y-1\\.5 > * + * { margin-top: 3px; }
            .space-y-0\\.5 > * + * { margin-top: 1px; }
            .flex { display: flex; }
            .justify-between { justify-content: space-between; }
            .items-center { align-items: center; }
            .truncate { white-space: normal; }
            .rounded { border-radius: 3px; }
            .bg-emerald-100 { background: #e5e7eb; color: #000; }
            .px-2 { padding-left: 4px; padding-right: 4px; }
            .py-0\\.5 { padding-top: 1px; padding-bottom: 1px; }
          </style>
        </head>
        <body>
          ${receiptHtml}
          <script>
            window.onload = function() {
              window.focus();
              window.print();
              setTimeout(function() {
                window.close();
              }, 400);
            };
          </script>
        </body>
      </html>
    `)
    printWindow.document.close()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-full p-0 overflow-hidden border border-border rounded-2xl bg-card shadow-2xl">
        <DialogHeader className="p-4 bg-muted/30 border-b border-border/80 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle className="text-sm font-black text-foreground">
                Bill Generated & Punched
              </DialogTitle>
              <p className="text-[11px] text-muted-foreground font-mono">
                Order {order.orderNumber}
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* Printable Receipt Paper Container */}
        <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
          <div 
            id="printable-kitchen-receipt" 
            className="p-5 bg-white text-zinc-900 rounded-xl border border-zinc-200 font-mono text-xs shadow-inner space-y-3 print:border-none print:shadow-none print:p-0 print:w-full"
          >
            {/* Header */}
            <div className="text-center space-y-0.5 border-b border-dashed border-zinc-300 pb-3">
              <h2 className="text-base font-black tracking-tight uppercase">
                {order.brandName}
              </h2>
              <p className="text-[10px] text-zinc-500">Cloud Kitchen & Counter POS</p>
              <p className="text-[9px] text-zinc-400">GSTIN: 27AABCU9603R1ZM • FSSAI: 11521018000452</p>
            </div>

            {/* Meta */}
            <div className="text-[11px] space-y-1 border-b border-dashed border-zinc-300 pb-2">
              <div className="flex justify-between">
                <span className="text-zinc-500">Invoice No:</span>
                <span className="font-bold">{order.orderNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Date/Time:</span>
                <span>
                  {new Date(order.createdAt).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Customer:</span>
                <span className="font-semibold">{order.customerName || 'Walk-in Guest'}</span>
              </div>
              {order.customerPhone && (
                <div className="flex justify-between">
                  <span className="text-zinc-500">Phone:</span>
                  <span>{order.customerPhone}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-zinc-500">Type:</span>
                <span className="uppercase font-bold text-[10px] bg-zinc-100 px-1 rounded">
                  {order.channel}
                </span>
              </div>
            </div>

            {/* Items Table */}
            <div className="space-y-1.5 border-b border-dashed border-zinc-300 pb-3">
              <div className="flex justify-between text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                <span>Item</span>
                <div className="flex gap-4">
                  <span>Qty</span>
                  <span className="w-12 text-right">Amt</span>
                </div>
              </div>
              {order.items.map((it) => (
                <div key={it.id} className="flex justify-between text-[11px] items-center">
                  <span className="truncate max-w-[170px] font-medium text-zinc-800">
                    {it.name}
                  </span>
                  <div className="flex gap-4 items-center">
                    <span className="w-6 text-center text-zinc-600 font-bold">{it.quantity}</span>
                    <span className="w-12 text-right font-bold text-zinc-900">
                      ₹{it.price * it.quantity}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Calculations Breakdown */}
            <div className="space-y-1 text-[11px] border-b border-dashed border-zinc-300 pb-2">
              <div className="flex justify-between text-zinc-600">
                <span>Item Subtotal</span>
                <span>₹{itemsTotal}</span>
              </div>
              {gstAmount > 0 && (
                <>
                  <div className="flex justify-between text-[10px] text-zinc-500">
                    <span>CGST (2.5%)</span>
                    <span>₹{(gstAmount / 2).toFixed(1)}</span>
                  </div>
                  <div className="flex justify-between text-[10px] text-zinc-500">
                    <span>SGST (2.5%)</span>
                    <span>₹{(gstAmount / 2).toFixed(1)}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between text-sm font-black pt-1 border-t border-zinc-200 text-zinc-900">
                <span>NET TOTAL</span>
                <span>₹{netAmount}</span>
              </div>
            </div>

            {/* Payment Mode Badge */}
            <div className="flex justify-between items-center text-[10px] pt-1">
              <span className="text-zinc-500">Payment Status:</span>
              <span className="font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                {order.paymentMethod || 'CASH'} • {order.paymentStatus || 'PAID'}
              </span>
            </div>

            {/* Footer */}
            <div className="text-center text-[9px] text-zinc-400 pt-2">
              <p>*** THANK YOU! PLEASE VISIT AGAIN ***</p>
              <p>Powered by KitchFlow Kitchen OS</p>
            </div>
          </div>

          {/* Action Buttons: Cleanly placed OUTSIDE the receipt paper so they NEVER appear on PDF or Print */}
          <div className="space-y-2 pt-2">
            {/* WhatsApp e-Bill Action */}
            <Button
              type="button"
              onClick={handleSendWhatsApp}
              className="w-full h-11 text-xs font-bold gap-2 bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-sm transition-transform active:scale-95"
            >
              <Share2 className="w-4 h-4" />
              <span>
                {order.customerPhone 
                  ? `Send Bill to WhatsApp (${order.customerPhone})`
                  : 'Share Bill on WhatsApp'}
              </span>
            </Button>

            {/* Action Grid */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={isGeneratingPdf}
                onClick={handleDownloadPdf}
                className="h-10 text-xs font-bold gap-1.5 border-border hover:bg-muted cursor-pointer"
              >
                <Download className="w-4 h-4 text-emerald-600" />
                <span>{isGeneratingPdf ? 'Creating PDF...' : 'Download PDF'}</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={handlePrint}
                className="h-10 text-xs font-bold gap-1.5 border-border hover:bg-muted cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Print (80mm)</span>
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <a
                href={publicInvoiceUrl}
                target="_blank"
                rel="noreferrer"
                className="h-9 px-3 rounded-lg border border-border text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-muted text-foreground transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Open Web Bill</span>
              </a>

              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  onOpenChange(false)
                  if (onDone) onDone()
                }}
                className="h-9 text-xs font-bold gap-1.5 cursor-pointer border border-border/80"
              >
                <span>Done</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
