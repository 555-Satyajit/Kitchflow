import React from 'react'
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import { Order } from '@/types'

const styles = StyleSheet.create({
  page: {
    padding: 14,
    fontFamily: 'Helvetica',
    fontSize: 8.5,
    color: '#111827',
    backgroundColor: '#ffffff',
  },
  header: {
    alignItems: 'center',
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#9ca3af',
    borderBottomStyle: 'dashed',
    paddingBottom: 8,
  },
  brandName: {
    fontSize: 14,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    textAlign: 'center',
    marginBottom: 3,
  },
  outletAddress: {
    fontSize: 7.5,
    color: '#374151',
    textAlign: 'center',
    marginBottom: 3,
    lineHeight: 1.3,
    paddingHorizontal: 8,
  },
  complianceRow: {
    fontSize: 7,
    fontWeight: 'bold',
    color: '#4b5563',
    textAlign: 'center',
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  contactRow: {
    fontSize: 7,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 1,
  },
  metaSection: {
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#d1d5db',
    borderBottomStyle: 'dashed',
    paddingBottom: 6,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2.5,
  },
  metaLabel: {
    color: '#6b7280',
    fontSize: 8,
  },
  metaValue: {
    fontWeight: 'bold',
    fontSize: 8,
  },
  tableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#9ca3af',
    paddingBottom: 4,
    marginBottom: 5,
    color: '#374151',
    fontWeight: 'bold',
    fontSize: 7.5,
    textTransform: 'uppercase',
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  itemName: {
    width: '58%',
    color: '#1f2937',
    fontSize: 8,
  },
  itemQty: {
    width: '14%',
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 8,
  },
  itemAmount: {
    width: '28%',
    textAlign: 'right',
    fontWeight: 'bold',
    fontSize: 8,
  },
  totalsSection: {
    borderTopWidth: 1,
    borderTopColor: '#d1d5db',
    borderTopStyle: 'dashed',
    paddingTop: 6,
    marginTop: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#d1d5db',
    borderBottomStyle: 'dashed',
    paddingBottom: 6,
    marginBottom: 8,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2.5,
  },
  discountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2.5,
    color: '#15803d',
  },
  discountLabel: {
    color: '#15803d',
    fontWeight: 'bold',
    fontSize: 8,
  },
  discountValue: {
    color: '#15803d',
    fontWeight: 'bold',
    fontSize: 8,
  },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#9ca3af',
    borderTopStyle: 'solid',
    paddingTop: 5,
    marginTop: 4,
  },
  grandTotalLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  grandTotalValue: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  paymentSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  paymentBadge: {
    fontSize: 7.5,
    fontWeight: 'bold',
    backgroundColor: '#ecfdf5',
    color: '#065f46',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 3,
  },
  termsSection: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    borderTopStyle: 'dashed',
    paddingTop: 6,
    marginBottom: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  termsText: {
    fontSize: 7,
    color: '#4b5563',
    fontWeight: 'bold',
    lineHeight: 1.3,
    width: '72%',
  },
  qrCode: {
    width: 44,
    height: 44,
    borderRadius: 4,
  },
  footer: {
    textAlign: 'center',
    fontSize: 7,
    color: '#9ca3af',
    marginTop: 4,
    lineHeight: 1.4,
  },
})

interface RealBillPdfDocumentProps {
  order: Order
  outletConfig?: {
    address?: string
    phone?: string
    email?: string
    gstin?: string
    fssaiLic?: string
    invoiceTerms?: string
    gstRate?: number
    qrCodeUrl?: string
  }
}

export function RealBillPdfDocument({ order, outletConfig }: RealBillPdfDocumentProps) {
  const itemsTotal = order.items.reduce((s, it) => s + it.price * it.quantity, 0)
  const discountAmount = order.financials?.discount || 0
  const taxableAmount = Math.max(0, itemsTotal - discountAmount)
  const gstRate = typeof outletConfig?.gstRate === 'number' ? outletConfig.gstRate : 5.0
  const halfGstRate = (gstRate / 2).toFixed(1)
  const gstAmount = Math.round(taxableAmount * (gstRate / 100))
  const netAmount = taxableAmount + gstAmount

  const formattedDate = new Date(order.createdAt).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  // Outlet address & tax credentials (dynamic from brand & kitchen settings, never order.customerAddress)
  const outletAddress = outletConfig?.address || ''
  const gstin = outletConfig?.gstin || ''
  const fssai = outletConfig?.fssaiLic || ''
  const outletPhone = outletConfig?.phone || ''
  const outletEmail = outletConfig?.email || ''
  const terms = outletConfig?.invoiceTerms || "Food once sold can't be returned."

  // 80mm standard long roll width in points (80mm ≈ 226.77 pt)
  // Height dynamically scales with item list and long receipt metadata
  const pageHeight = Math.max(430, 260 + order.items.length * 16 + (discountAmount > 0 ? 18 : 0))

  return (
    <Document title={`Bill-${order.orderNumber}`}>
      <Page size={[226.77, pageHeight]} style={styles.page}>
        {/* Header (Brand name, GSTIN & FSSAI, Outlet Address just below as per law, Phone & Email) */}
        <View style={styles.header}>
          <Text style={styles.brandName}>{order.brandName}</Text>
          <Text style={styles.complianceRow}>GSTIN: {gstin} • FSSAI: {fssai}</Text>
          <Text style={styles.outletAddress}>{outletAddress}</Text>
          <Text style={styles.contactRow}>Contact: {outletPhone} | Email: {outletEmail}</Text>
        </View>

        {/* Invoice Meta */}
        <View style={styles.metaSection}>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Invoice No:</Text>
            <Text style={styles.metaValue}>{order.orderNumber}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Date & Time:</Text>
            <Text>{formattedDate}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Customer:</Text>
            <Text style={styles.metaValue}>{order.customerName || 'Walk-in Guest'}</Text>
          </View>
          {order.customerPhone && (
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Phone:</Text>
              <Text>{order.customerPhone}</Text>
            </View>
          )}
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Channel:</Text>
            <Text style={styles.metaValue}>{order.channel}</Text>
          </View>
        </View>

        {/* Table Header */}
        <View style={styles.tableHeader}>
          <Text style={{ width: '58%' }}>Item</Text>
          <Text style={{ width: '14%', textAlign: 'center' }}>Qty</Text>
          <Text style={{ width: '28%', textAlign: 'right' }}>Amount</Text>
        </View>

        {/* Items List */}
        {order.items.map((it) => (
          <View key={it.id} style={styles.itemRow}>
            <Text style={styles.itemName}>{it.name}</Text>
            <Text style={styles.itemQty}>{it.quantity}</Text>
            <Text style={styles.itemAmount}>Rs. {it.price * it.quantity}</Text>
          </View>
        ))}

        {/* Totals & Discounts Section */}
        <View style={styles.totalsSection}>
          <View style={styles.totalRow}>
            <Text style={styles.metaLabel}>Item Subtotal</Text>
            <Text>Rs. {itemsTotal}</Text>
          </View>

          {discountAmount > 0 && (
            <View style={styles.discountRow}>
              <Text style={styles.discountLabel}>
                Coupon Discount {order.couponCode ? `[${order.couponCode}]` : ''}
              </Text>
              <Text style={styles.discountValue}>- Rs. {discountAmount}</Text>
            </View>
          )}

          <View style={styles.totalRow}>
            <Text style={styles.metaLabel}>CGST ({halfGstRate}%)</Text>
            <Text>Rs. {(gstAmount / 2).toFixed(1)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.metaLabel}>SGST ({halfGstRate}%)</Text>
            <Text>Rs. {(gstAmount / 2).toFixed(1)}</Text>
          </View>

          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>TOTAL AMOUNT</Text>
            <Text style={styles.grandTotalValue}>Rs. {netAmount}</Text>
          </View>
        </View>

        {/* Payment Mode */}
        <View style={styles.paymentSection}>
          <Text style={styles.metaLabel}>Payment Status:</Text>
          <Text style={styles.paymentBadge}>
            {order.paymentMethod || 'CASH'} • {order.paymentStatus || 'PAID'}
          </Text>
        </View>

        {/* Mandatory Terms & Conditions & Right Bottom QR Code */}
        <View style={styles.termsSection}>
          <Text style={styles.termsText}>* {terms} *</Text>
          {outletConfig?.qrCodeUrl ? (
            <Image src={outletConfig.qrCodeUrl} style={styles.qrCode} />
          ) : null}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text>*** THANK YOU! VISIT AGAIN ***</Text>
          <Text>Computer Generated Tax Invoice</Text>
        </View>
      </Page>
    </Document>
  )
}

