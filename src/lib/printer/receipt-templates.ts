import { Order, OrderItem } from '@/types';
import { EscPosBuilder, PaperWidth } from './escpos';

export interface OutletPrintConfig {
  name?: string;
  address?: string;
  phone?: string;
  email?: string;
  fssaiLic?: string;
  gstin?: string;
  invoiceTerms?: string;
  gstRate?: number;
}

/**
 * Format date for thermal receipt
 */
function formatReceiptDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return iso;
  }
}

/**
 * Generate Kitchen Order Ticket (KOT) ESC/POS binary & preview
 */
export function generateKotEscPos(
  order: Order,
  options: {
    stationFilter?: string;
    width?: PaperWidth;
  } = {}
): { bytes: Uint8Array; plainText: string } {
  const width = options.width || '80mm';
  const builder = new EscPosBuilder({ width });

  let itemsToPrint: OrderItem[] = order.items;
  if (options.stationFilter && options.stationFilter !== 'ALL') {
    itemsToPrint = order.items.filter(
      (it) => it.station === options.stationFilter || it.secondaryStations?.includes(options.stationFilter as any)
    );
  }

  // Header
  builder.align('center');
  builder.bold(true).size(2, 2);
  builder.line('*** K O T ***');
  builder.size(1, 1).bold(false);
  builder.line(order.brandName ? order.brandName.toUpperCase() : 'KITCHEN');
  
  if (options.stationFilter && options.stationFilter !== 'ALL') {
    builder.bold(true).line(`[ STATION: ${options.stationFilter} ]`);
  } else {
    builder.line('[ STATION: ALL PREP ]');
  }

  builder.divider('=');

  // Big Token Number
  builder.bold(true).size(2, 2);
  builder.line(order.orderNumber);
  builder.size(1, 1).bold(false);

  // Metadata
  builder.align('left');
  builder.row(`TYPE: ${order.channel}`, `TIME: ${formatReceiptDate(order.createdAt).split(',')[1]?.trim() || ''}`);
  builder.row(`DATE: ${formatReceiptDate(order.createdAt).split(',')[0] || ''}`, `ORD: ${order.id.slice(0, 8)}`);
  
  if (order.customerName && order.customerName !== 'Guest Customer') {
    builder.line(`CUSTOMER: ${order.customerName}`);
  }

  builder.divider('-');

  // Item list
  builder.bold(true);
  builder.row('ITEM DESCRIPTION', 'QTY');
  builder.bold(false);
  builder.divider('-');

  for (const it of itemsToPrint) {
    builder.bold(true).size(1, 2);
    builder.row(it.name, `x ${it.quantity}`);
    builder.size(1, 1).bold(false);
    if (it.station && (!options.stationFilter || options.stationFilter === 'ALL')) {
      builder.line(`  -> Station: ${it.station}`);
    }
  }

  builder.divider('-');
  builder.align('center');
  builder.line(`Total Items: ${itemsToPrint.reduce((sum, it) => sum + it.quantity, 0)}`);
  builder.line('--- SEND TO PACKING ON COMPLETION ---');
  builder.feed(2);
  builder.cut(false);

  return {
    bytes: builder.build(),
    plainText: builder.toPlainText(),
  };
}

/**
 * Generate Customer Tax Invoice / Bill ESC/POS binary & preview
 * 100% Synchronized with RealBillPdfDocument.tsx
 */
export function generateCustomerBillEscPos(
  order: Order,
  outlet: OutletPrintConfig = {},
  options: {
    width?: PaperWidth;
    openCashDrawer?: boolean;
    qrData?: string;
  } = {}
): { bytes: Uint8Array; plainText: string } {
  const width = options.width || '80mm';
  const builder = new EscPosBuilder({ width });

  if (options.openCashDrawer) {
    builder.cashDrawer();
  }

  // 1. Calculate matching RealBillPdfDocument financials exactly
  const itemsTotal = order.items.reduce((s, it) => s + it.price * it.quantity, 0);
  const discountAmount = order.financials?.discount || 0;
  const taxableAmount = Math.max(0, itemsTotal - discountAmount);
  const gstRate = typeof outlet.gstRate === 'number' ? outlet.gstRate : 5.0;
  const halfGstRate = (gstRate / 2).toFixed(1);
  const gstAmount = Math.round(taxableAmount * (gstRate / 100));
  const netAmount = taxableAmount + gstAmount;

  const brandName = outlet.name || order.brandName || 'BEHEROZ BIRIYANI';
  const gstin = outlet.gstin || '21AABCU9603R3ZP';
  const fssai = outlet.fssaiLic || '12024020000771';
  const outletAddress = outlet.address || 'Link Road, Near Badambedi Bus Stand, Cuttack, Odisha - 753012';
  const outletPhone = outlet.phone || '+91 97780 99881';
  const outletEmail = outlet.email || 'cuttack.orders@beheroz.in';
  const terms = outlet.invoiceTerms || "Food once sold can't be returned.";

  // Header
  builder.align('center');
  builder.bold(true).size(2, 2);
  builder.line(brandName.toUpperCase());
  builder.size(1, 1).bold(false);

  builder.line(`GSTIN: ${gstin} • FSSAI: ${fssai}`);
  builder.line(outletAddress);
  builder.line(`Contact: ${outletPhone} | Email: ${outletEmail}`);

  builder.divider('=');
  builder.bold(true).line('TAX INVOICE');
  builder.bold(false);
  builder.divider('-');

  // Metadata
  builder.align('left');
  builder.row(`Invoice No:`, order.orderNumber);
  builder.row(`Date & Time:`, formatReceiptDate(order.createdAt));
  builder.row(`Customer:`, order.customerName || 'Walk-in Guest');
  if (order.customerPhone) {
    builder.row(`Phone:`, order.customerPhone);
  }
  builder.row(`Channel:`, order.channel);

  builder.divider('-');

  // Items table
  builder.bold(true);
  builder.itemRow('Item', 'Qty', 'Amount');
  builder.bold(false);
  builder.divider('-');

  for (const it of order.items) {
    builder.itemRow(it.name, `${it.quantity}`, `Rs. ${it.price * it.quantity}`);
  }

  builder.divider('-');

  // Totals & Taxes
  builder.row('Item Subtotal', `Rs. ${itemsTotal}`);

  if (discountAmount > 0) {
    builder.row(`Coupon Discount ${order.couponCode ? `[${order.couponCode}]` : ''}`, `- Rs. ${discountAmount}`);
  }

  builder.row(`CGST (${halfGstRate}%)`, `Rs. ${(gstAmount / 2).toFixed(1)}`);
  builder.row(`SGST (${halfGstRate}%)`, `Rs. ${(gstAmount / 2).toFixed(1)}`);

  builder.divider('=');
  builder.bold(true).size(2, 2);
  builder.row('TOTAL AMOUNT', `Rs. ${netAmount}`);
  builder.size(1, 1).bold(false);
  builder.divider('=');

  // Payment status
  builder.row(`Payment Status:`, `${order.paymentMethod || 'CASH'} • ${order.paymentStatus || 'PAID'}`);

  // Digital Invoice / UPI QR Code
  if (options.qrData) {
    builder.feed(1);
    builder.align('center');
    builder.qrCode(options.qrData, width === '58mm' ? 4 : 5);
  }

  builder.feed(1);
  builder.align('center');
  builder.line(`* ${terms} *`);
  builder.line('*** THANK YOU! VISIT AGAIN ***');
  builder.line('Computer Generated Tax Invoice');

  builder.feed(2);
  builder.cut(false);

  return {
    bytes: builder.build(),
    plainText: builder.toPlainText(),
  };
}
