'use client'

import React, { use, Suspense } from 'react'
import { useKitchen } from '@/context/KitchenContext'
import { Order } from '@/types'
import { Download, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { pdf } from '@react-pdf/renderer'
import { RealBillPdfDocument } from '@/components/pos/RealBillPdfDocument'
import { getPublicInvoiceAction } from '@/actions/invoice'
import { useQuery } from '@tanstack/react-query'
import QRCode from 'qrcode'

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
  const { orders, brands } = useKitchen()
  const [mounted, setMounted] = React.useState(false)
  const [isDownloading, setIsDownloading] = React.useState(false)

  // 1. TanStack Query for authoritative server data fetch (includes joined brand and kitchen records)
  const { data: dbInvoiceData, isLoading, isError } = useQuery({
    queryKey: ['invoice', orderId],
    queryFn: async () => {
      const res = await getPublicInvoiceAction(orderId);
      if (!res.ok || !res.data) {
        throw new Error(res.error || 'Failed loading invoice');
      }
      return res.data;
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    retry: 2,
  });

  // Client context / localStorage fallback only if offline / offline sync
  const clientOrder = React.useMemo(() => {
    let found = orders.find((o) => o.id === orderId || o.orderNumber.replace(/[^a-zA-Z0-9]/g, '') === orderId);
    if (!found && typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(`kitchflow_order_${orderId}`);
        if (stored) found = JSON.parse(stored);
      } catch (e) {}
    }
    return found || null;
  }, [orderId, orders]);

  const order = dbInvoiceData?.order || clientOrder;
  const [qrCodeDataUrl, setQrCodeDataUrl] = React.useState<string>('');

  React.useEffect(() => {
    if (typeof window !== 'undefined' && order?.orderNumber) {
      // Direct URL to this digital bill
      const invoiceUrl = `${window.location.origin}/invoice/${order.id || order.orderNumber}`;
      QRCode.toDataURL(invoiceUrl, {
        width: 140,
        margin: 1,
        color: {
          dark: '#18181b',
          light: '#ffffff',
        },
      })
        .then((url) => setQrCodeDataUrl(url))
        .catch((err) => console.warn('QR code generation failed:', err));
    }
  }, [order?.id, order?.orderNumber]);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Brand data directly from authoritative DB response, or matching in-memory brand
  const matchedBrand = dbInvoiceData?.brand || brands.find(
    (b) => b.id === order?.brandId || b.name.toLowerCase().trim() === order?.brandName?.toLowerCase().trim()
  );

  const kitchenSettings = dbInvoiceData?.kitchen;

  // 100% Dynamic Brand Credentials from Database:
  // - Brand storefront name
  // - Brand address
  // - Brand contact phone & email (specific to the brand)
  // - Brand FSSAI license & Legal terms
  // - Kitchen GSTIN & Tax rate
  const displayBrandName = matchedBrand?.name || order?.brandName || kitchenSettings?.name || 'KitchFlow'
  const displayAddress = matchedBrand?.address || kitchenSettings?.address || ''
  const displayPhone = matchedBrand?.phone || kitchenSettings?.phone || ''
  const displayEmail = matchedBrand?.email || kitchenSettings?.email || ''
  const displayGstin = kitchenSettings?.gstin || ''
  const displayFssai = matchedBrand?.fssaiLic || kitchenSettings?.fssaiLic || ''
  const displayTerms = matchedBrand?.invoiceTerms || kitchenSettings?.invoiceTerms || "Food once sold can't be returned."
  const gstRate = typeof kitchenSettings?.gstRate === 'number' ? kitchenSettings.gstRate : 5.0
  const halfGstRate = (gstRate / 2).toFixed(1)

  // Gate rendering while TanStack Query is actively fetching
  if (!mounted || (isLoading && !order)) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-zinc-50 font-sans">
        <div className="flex flex-col items-center gap-2 text-zinc-500">
          <Loader2 className="w-5 h-5 animate-spin text-zinc-900" />
          <span className="text-xs font-mono">Loading official bill...</span>
        </div>
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

  const itemsTotal = (order.items || []).reduce((s: number, it: any) => s + (it.price || 0) * (it.quantity || 1), 0)
  const discountAmount = order.financials?.discount || 0
  const taxableAmount = Math.max(0, itemsTotal - discountAmount)
  const gstAmount = Math.round(taxableAmount * (gstRate / 100))
  const netAmount = taxableAmount + gstAmount

  const handleDownloadPdf = async () => {
    if (!order) return
    try {
      setIsDownloading(true)
      
      // Ensure QR Code data URL is ready and not undefined
      let qrUrl = qrCodeDataUrl
      if (!qrUrl && typeof window !== 'undefined' && order?.orderNumber) {
        try {
          const invoiceUrl = `${window.location.origin}/invoice/${order.id || order.orderNumber}`
          qrUrl = await QRCode.toDataURL(invoiceUrl, {
            width: 140,
            margin: 1,
            color: { dark: '#18181b', light: '#ffffff' }
          })
        } catch (e) {
          console.warn('Fallback QR code creation failed:', e)
        }
      }

      const blob = await pdf(<RealBillPdfDocument order={{
        ...order,
        brandName: displayBrandName
      }} outletConfig={{
        address: displayAddress,
        phone: displayPhone,
        email: displayEmail,
        gstin: displayGstin,
        fssaiLic: displayFssai,
        invoiceTerms: displayTerms,
        gstRate,
        qrCodeUrl: qrUrl,
      }} />).toBlob()
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
      {/* Customer Action Bar: Download PDF only */}
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

      {/* Tax Invoice Long Thermal Bill Sheet */}
      <div 
        id="official-customer-invoice"
        className="w-full max-w-md bg-white p-6 rounded-2xl border border-zinc-200 shadow-md font-mono text-xs space-y-4 print:shadow-none print:border-none print:p-0 print:w-full"
      >
        {/* Header (Brand name, GSTIN & FSSAI, Outlet Address just below as per law, Phone & Email) */}
        <div className="text-center space-y-1.5 border-b border-dashed border-zinc-300 pb-4">
          <h1 className="text-lg font-black tracking-tight text-zinc-900 uppercase">
            {displayBrandName}
          </h1>
          <p className="text-[10px] font-bold text-zinc-700">
            GSTIN: {displayGstin} • FSSAI Lic: {displayFssai}
          </p>
          <p className="text-[11px] text-zinc-800 leading-relaxed px-4 font-semibold">
            {displayAddress}
          </p>
          <p className="text-[10px] text-zinc-600 font-medium">
            Contact: {displayPhone} | Email: {displayEmail}
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
          {(order.items || []).map((it: any) => (
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

          {discountAmount > 0 && (
            <div className="flex justify-between text-emerald-600 font-bold">
              <span>Coupon Discount {order.couponCode ? `[${order.couponCode}]` : ''}:</span>
              <span>- ₹{discountAmount}</span>
            </div>
          )}

          <div className="flex justify-between text-[10px] text-zinc-500">
            <span>CGST ({halfGstRate}%):</span>
            <span>₹{(gstAmount / 2).toFixed(1)}</span>
          </div>
          <div className="flex justify-between text-[10px] text-zinc-500">
            <span>SGST ({halfGstRate}%):</span>
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

        {/* Mandatory Legal Terms & Conditions and QR Code */}
        <div className="border-t border-dashed border-zinc-200 pt-3 flex items-center justify-between gap-3">
          <div className="space-y-1 text-left flex-1">
            <p className="text-[10px] font-bold text-zinc-700">
              * Food once sold can&apos;t be returned. *
            </p>
            <p className="text-[9px] text-zinc-400">
              Scan QR code on the right with phone camera to view digital copy.
            </p>
          </div>
          {qrCodeDataUrl ? (
            <div className="shrink-0 flex flex-col items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrCodeDataUrl}
                alt="Invoice QR Code"
                className="w-16 h-16 border border-zinc-200 rounded-lg p-0.5 bg-white shadow-2xs"
              />
              <span className="text-[8px] font-mono text-zinc-400 mt-0.5 uppercase tracking-tight">Scan Bill</span>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="text-center text-[9px] text-zinc-400 pt-1 space-y-0.5">
          <p>*** THANK YOU! VISIT AGAIN ***</p>
          <p>This is a computer generated tax invoice.</p>
        </div>
      </div>
    </div>
  )
}
