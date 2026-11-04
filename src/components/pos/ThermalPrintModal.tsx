'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Order } from '@/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, Usb, ChefHat, ReceiptText } from 'lucide-react';
import { generateKotEscPos, generateCustomerBillEscPos, OutletPrintConfig } from '@/lib/printer/receipt-templates';
import { printerService, PaperWidth } from '@/lib/printer/printer-service';
import QRCodeLib from 'qrcode';

interface ThermalPrintModalProps {
  order: Order | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  outletConfig?: OutletPrintConfig;
  defaultMode?: 'kot' | 'bill';
}

export function ThermalPrintModal({
  order,
  open,
  onOpenChange,
  outletConfig,
  defaultMode = 'bill',
}: ThermalPrintModalProps) {
  const [printType, setPrintType] = useState<'kot' | 'bill'>(defaultMode);
  const [paperWidth, setPaperWidth] = useState<PaperWidth>('80mm');
  const [stationFilter, setStationFilter] = useState<string>('ALL');
  const [isPrinting, setIsPrinting] = useState<boolean>(false);
  const [usbConnected, setUsbConnected] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<string>('');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const receiptRef = React.useRef<HTMLDivElement>(null);

  // Invoice URL for QR code
  const publicInvoiceUrl = useMemo(() => {
    if (!order) return '';
    return typeof window !== 'undefined'
      ? `${window.location.origin}/invoice/${order.id}`
      : `/invoice/${order.id}`;
  }, [order]);

  // Generate QR Code data URL
  useEffect(() => {
    if (!publicInvoiceUrl) return;
    QRCodeLib.toDataURL(publicInvoiceUrl, {
      width: 140,
      margin: 1,
      color: { dark: '#18181b', light: '#ffffff' },
    })
      .then((url) => setQrCodeDataUrl(url))
      .catch((err) => console.warn('QR Code generation error:', err));
  }, [publicInvoiceUrl]);

  // Extract unique stations present in order
  const stationsInOrder = useMemo(() => {
    if (!order) return ['ALL'];
    const set = new Set<string>();
    order.items.forEach((it) => {
      if (it.station) set.add(it.station);
    });
    return ['ALL', ...Array.from(set)];
  }, [order]);

  // Financial calculations matching RealBillPdfDocument exactly
  const financials = useMemo(() => {
    if (!order) return { itemsTotal: 0, discount: 0, cgst: '0.0', sgst: '0.0', netTotal: 0 };
    const itemsTotal = order.items.reduce((s, it) => s + it.price * it.quantity, 0);
    const discount = order.financials?.discount || 0;
    const taxable = Math.max(0, itemsTotal - discount);
    const gstRate = typeof outletConfig?.gstRate === 'number' ? outletConfig.gstRate : 5.0;
    const gstAmount = Math.round(taxable * (gstRate / 100));
    const halfGst = (gstAmount / 2).toFixed(1);
    const netTotal = taxable + gstAmount;
    return { itemsTotal, discount, cgst: halfGst, sgst: halfGst, netTotal };
  }, [order, outletConfig]);

  // Filter items for KOT if stationFilter is set
  const kotItems = useMemo(() => {
    if (!order) return [];
    if (stationFilter === 'ALL') return order.items;
    return order.items.filter(
      (it) => it.station === stationFilter || it.secondaryStations?.includes(stationFilter as any)
    );
  }, [order, stationFilter]);

  // Generate binary ESC/POS data for thermal printer transmission
  const printData = useMemo(() => {
    if (!order) return { bytes: new Uint8Array(), plainText: '' };
    if (printType === 'kot') {
      return generateKotEscPos(order, {
        stationFilter,
        width: paperWidth,
      });
    } else {
      return generateCustomerBillEscPos(order, outletConfig, {
        width: paperWidth,
        openCashDrawer: true,
        qrData: publicInvoiceUrl,
      });
    }
  }, [order, printType, paperWidth, stationFilter, outletConfig, publicInvoiceUrl]);

  if (!order) return null;

  const handlePairUsb = async () => {
    try {
      setStatusMsg('Pairing USB printer...');
      await printerService.requestUsbDevice();
      setUsbConnected(true);
      setStatusMsg('USB Printer connected!');
    } catch (err: any) {
      setStatusMsg(err.message || 'USB pairing cancelled');
    }
  };

  const handleExecutePrint = async () => {
    try {
      setIsPrinting(true);
      setStatusMsg('Dispatching to thermal head...');
      const htmlContent = receiptRef.current ? receiptRef.current.innerHTML : undefined;
      await printerService.printRaw(printData.bytes, printData.plainText, htmlContent);
      setStatusMsg('Printed successfully!');
      setTimeout(() => {
        onOpenChange(false);
      }, 700);
    } catch (err: any) {
      setStatusMsg(err.message || 'Print error');
    } finally {
      setIsPrinting(false);
    }
  };

  const formattedDate = new Date(order.createdAt).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const brandTitle = outletConfig?.name || order.brandName || 'BEHEROZ BIRIYANI';
  const outletAddress = outletConfig?.address || 'Link Road, Near Badambedi Bus Stand, Cuttack, Odisha - 753012';
  const gstin = outletConfig?.gstin || '21AABCU9603R3ZP';
  const fssai = outletConfig?.fssaiLic || '12024020000771';
  const phone = outletConfig?.phone || '+91 97780 99881';
  const email = outletConfig?.email || 'cuttack.orders@beheroz.in';
  const terms = outletConfig?.invoiceTerms || "Food once sold can't be returned.";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[92vh] flex flex-col p-0 overflow-hidden bg-zinc-950 text-zinc-100 border-zinc-800 shadow-2xl">
        {/* Header */}
        <DialogHeader className="p-4 border-b border-zinc-800 bg-zinc-900/60 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-orange-500/20 text-orange-400 flex items-center justify-center border border-orange-500/30">
              <Printer className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-sm font-bold tracking-tight text-zinc-100">
                Thermal ESC/POS Print Engine
              </DialogTitle>
              <p className="text-xs text-zinc-400 font-mono">Order {order.orderNumber} • 80mm / 58mm POS</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePairUsb}
              className={`h-7 text-xs border-zinc-700 ${usbConnected ? 'text-emerald-400 border-emerald-500/40 bg-emerald-950/20' : 'text-zinc-300 hover:bg-zinc-800'}`}
            >
              <Usb className="h-3 w-3 mr-1" />
              {usbConnected ? 'USB Connected' : 'Pair USB'}
            </Button>
          </div>
        </DialogHeader>

        {/* Toolbar & Mode Selector */}
        <div className="px-4 py-2.5 bg-zinc-900/40 border-b border-zinc-800 flex flex-wrap gap-2 items-center justify-between text-xs">
          {/* Mode Switch */}
          <div className="flex rounded-lg bg-zinc-800/80 p-0.5 border border-zinc-700/80">
            <button
              onClick={() => setPrintType('bill')}
              className={`px-3 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
                printType === 'bill' ? 'bg-orange-600 text-white shadow-xs' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <ReceiptText className="h-3.5 w-3.5" />
              Customer Tax Bill
            </button>
            <button
              onClick={() => setPrintType('kot')}
              className={`px-3 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
                printType === 'kot' ? 'bg-orange-600 text-white shadow-xs' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <ChefHat className="h-3.5 w-3.5" />
              Kitchen KOT
            </button>
          </div>

          {/* Width Selector */}
          <div className="flex items-center gap-2">
            <span className="text-zinc-400 font-medium">Roll:</span>
            <div className="flex rounded-lg bg-zinc-800/80 p-0.5 border border-zinc-700/80">
              <button
                onClick={() => setPaperWidth('80mm')}
                className={`px-2.5 py-0.5 rounded text-xs font-medium transition-all ${
                  paperWidth === '80mm' ? 'bg-zinc-700 text-white font-bold' : 'text-zinc-400'
                }`}
              >
                80mm (3")
              </button>
              <button
                onClick={() => setPaperWidth('58mm')}
                className={`px-2.5 py-0.5 rounded text-xs font-medium transition-all ${
                  paperWidth === '58mm' ? 'bg-zinc-700 text-white font-bold' : 'text-zinc-400'
                }`}
              >
                58mm (2")
              </button>
            </div>
          </div>

          {/* Station Filter for KOT */}
          {printType === 'kot' && stationsInOrder.length > 2 && (
            <div className="flex items-center gap-1.5">
              <span className="text-zinc-400 font-medium">Station:</span>
              <select
                value={stationFilter}
                onChange={(e) => setStationFilter(e.target.value)}
                className="bg-zinc-800 border border-zinc-700 rounded px-2 py-0.5 text-xs text-zinc-200 outline-none"
              >
                {stationsInOrder.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Live Thermal Paper Visual Preview */}
        <div className="flex-1 overflow-y-auto p-4 bg-zinc-950 flex flex-col items-center">
          <div
            ref={receiptRef}
            className={`bg-white text-zinc-900 shadow-2xl p-5 font-mono text-xs rounded-lg border border-zinc-300 relative transition-all ${
              paperWidth === '58mm' ? 'w-[270px]' : 'w-[360px]'
            }`}
          >
            {printType === 'bill' ? (
              /* CUSTOMER TAX BILL */
              <div className="space-y-3">
                {/* Header */}
                <div className="text-center space-y-1 border-b border-dashed border-zinc-300 pb-3">
                  <h2 className="text-base font-black tracking-tight uppercase text-zinc-900">
                    {brandTitle}
                  </h2>
                  <p className="text-[10px] font-bold text-zinc-600">
                    GSTIN: {gstin} • FSSAI: {fssai}
                  </p>
                  <p className="text-[9px] text-zinc-500 leading-tight">
                    {outletAddress}
                  </p>
                  <p className="text-[9px] text-zinc-500">
                    Contact: {phone} | Email: {email}
                  </p>
                  <div className="pt-1">
                    <span className="text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-zinc-100 text-zinc-800">
                      TAX INVOICE
                    </span>
                  </div>
                </div>

                {/* Meta */}
                <div className="text-[11px] space-y-1 border-b border-dashed border-zinc-300 pb-2">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Invoice No:</span>
                    <span className="font-bold">{order.orderNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Date/Time:</span>
                    <span>{formattedDate}</span>
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
                    <span className="text-zinc-500">Channel:</span>
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
                      <span className="w-14 text-right">Amt</span>
                    </div>
                  </div>
                  {order.items.map((it) => (
                    <div key={it.id} className="flex justify-between text-[11px] items-center">
                      <span className="truncate max-w-[170px] font-medium text-zinc-800">
                        {it.name}
                      </span>
                      <div className="flex gap-4 items-center">
                        <span className="w-6 text-center text-zinc-600 font-bold">{it.quantity}</span>
                        <span className="w-14 text-right font-bold text-zinc-900">
                          Rs. {it.price * it.quantity}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Totals & GST */}
                <div className="space-y-1 text-[11px] border-b border-dashed border-zinc-300 pb-2">
                  <div className="flex justify-between text-zinc-600">
                    <span>Item Subtotal</span>
                    <span>Rs. {financials.itemsTotal}</span>
                  </div>
                  {financials.discount > 0 && (
                    <div className="flex justify-between text-emerald-600 font-bold">
                      <span>Discount {order.couponCode ? `[${order.couponCode}]` : ''}</span>
                      <span>- Rs. {financials.discount}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-[10px] text-zinc-500">
                    <span>CGST (2.5%)</span>
                    <span>Rs. {financials.cgst}</span>
                  </div>
                  <div className="flex justify-between text-[10px] text-zinc-500">
                    <span>SGST (2.5%)</span>
                    <span>Rs. {financials.sgst}</span>
                  </div>
                  <div className="flex justify-between text-sm font-black pt-1 border-t border-zinc-200 text-zinc-900">
                    <span>NET TOTAL</span>
                    <span>Rs. {financials.netTotal}</span>
                  </div>
                </div>

                {/* Payment Badge */}
                <div className="flex justify-between items-center text-[10px] pt-1">
                  <span className="text-zinc-500">Payment Status:</span>
                  <span className="font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                    {order.paymentMethod || 'CASH'} • {order.paymentStatus || 'PAID'}
                  </span>
                </div>

                {/* QR Code & Terms */}
                {qrCodeDataUrl && (
                  <div className="flex flex-col items-center justify-center pt-2 border-t border-dashed border-zinc-300">
                    <img
                      src={qrCodeDataUrl}
                      alt="Invoice QR Code"
                      className="w-24 h-24 border border-zinc-200 rounded p-1 bg-white shadow-xs"
                    />
                    <span className="text-[9px] font-mono font-bold text-zinc-500 mt-1 uppercase tracking-wider">
                      Scan to View / Pay Digital Bill
                    </span>
                  </div>
                )}

                {/* Footer */}
                <div className="text-center text-[9px] text-zinc-400 pt-1 space-y-0.5">
                  <p>* {terms} *</p>
                  <p>*** THANK YOU! VISIT AGAIN ***</p>
                  <p>Computer Generated Tax Invoice</p>
                </div>
              </div>
            ) : (
              /* KITCHEN ORDER TICKET (KOT) */
              <div className="space-y-3">
                <div className="text-center space-y-1 border-b border-dashed border-zinc-300 pb-2">
                  <h2 className="text-lg font-black tracking-widest uppercase text-zinc-900">
                    *** K O T ***
                  </h2>
                  <p className="text-xs font-bold text-zinc-700 uppercase">{brandTitle}</p>
                  <span className="inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-orange-100 text-orange-800">
                    STATION: {stationFilter}
                  </span>
                </div>

                {/* Token */}
                <div className="text-center py-1 border-b-2 border-zinc-900">
                  <span className="text-2xl font-black font-mono tracking-tight text-zinc-950">
                    {order.orderNumber}
                  </span>
                </div>

                {/* Metadata */}
                <div className="text-[11px] space-y-1 border-b border-dashed border-zinc-300 pb-2">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Type:</span>
                    <span className="font-bold uppercase">{order.channel}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Time:</span>
                    <span>{formattedDate.split(',')[1]?.trim() || ''}</span>
                  </div>
                  {order.customerName && (
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Customer:</span>
                      <span className="font-semibold">{order.customerName}</span>
                    </div>
                  )}
                </div>

                {/* Cook Items List */}
                <div className="space-y-2 border-b border-dashed border-zinc-300 pb-3">
                  <div className="flex justify-between text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                    <span>Item Description</span>
                    <span>Qty</span>
                  </div>
                  {kotItems.map((it) => (
                    <div key={it.id} className="flex justify-between items-baseline pt-1">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-zinc-900">{it.name}</span>
                        {it.station && stationFilter === 'ALL' && (
                          <span className="text-[9px] text-zinc-500">Station: {it.station}</span>
                        )}
                      </div>
                      <span className="text-base font-black font-mono text-zinc-950 ml-2">
                        x{it.quantity}
                      </span>
                    </div>
                  ))}
                </div>

                {/* KOT Footer */}
                <div className="text-center text-[10px] text-zinc-500 pt-1 space-y-1">
                  <p className="font-bold">Total Items: {kotItems.reduce((s, it) => s + it.quantity, 0)}</p>
                  <p className="uppercase text-[9px] text-zinc-400">--- SEND TO PACKING ON COMPLETION ---</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action Footer */}
        <div className="p-3 bg-zinc-900 border-t border-zinc-800 flex items-center justify-between">
          <div className="text-xs text-zinc-400 truncate max-w-[260px]">
            {statusMsg || (usbConnected ? 'USB Thermal Head Ready (0ms latency)' : 'Ready to print')}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="text-xs text-zinc-300">
              Close
            </Button>
            <Button
              size="sm"
              onClick={handleExecutePrint}
              disabled={isPrinting}
              className="bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs flex items-center gap-1.5 px-4 shadow-sm"
            >
              <Printer className="h-3.5 w-3.5" />
              {isPrinting ? 'Printing...' : `Print ${printType === 'kot' ? 'KOT' : 'Bill'} Now`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
