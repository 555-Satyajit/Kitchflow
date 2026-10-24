import React from 'react'
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer'
import { Order } from '@/types'

const styles = StyleSheet.create({
  page: {
    padding: 12,
    fontFamily: 'Helvetica',
    fontSize: 8.5,
    color: '#111827',
    backgroundColor: '#ffffff',
  },
  header: {
    alignItems: 'center',
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#d1d5db',
    borderBottomStyle: 'dashed',
    paddingBottom: 6,
  },
  brandName: {
    fontSize: 13,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  subHeader: {
    fontSize: 7.5,
    color: '#6b7280',
    marginBottom: 1,
  },
  metaSection: {
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#d1d5db',
    borderBottomStyle: 'dashed',
    paddingBottom: 5,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  metaLabel: {
    color: '#6b7280',
  },
  metaValue: {
    fontWeight: 'bold',
  },
  tableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#9ca3af',
    paddingBottom: 3,
    marginBottom: 4,
    color: '#4b5563',
    fontWeight: 'bold',
    fontSize: 7.5,
    textTransform: 'uppercase',
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 3.5,
  },
  itemName: {
    width: '60%',
    color: '#1f2937',
  },
  itemQty: {
    width: '15%',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  itemAmount: {
    width: '25%',
    textAlign: 'right',
    fontWeight: 'bold',
  },
  totalsSection: {
    borderTopWidth: 1,
    borderTopColor: '#d1d5db',
    borderTopStyle: 'dashed',
    paddingTop: 5,
    marginTop: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#d1d5db',
    borderBottomStyle: 'dashed',
    paddingBottom: 5,
    marginBottom: 6,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 3,
    marginTop: 2,
  },
  grandTotalLabel: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  grandTotalValue: {
    fontSize: 10,
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
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 3,
  },
  footer: {
    textAlign: 'center',
    fontSize: 7,
    color: '#9ca3af',
    marginTop: 4,
  },
})

export function RealBillPdfDocument({ order }: { order: Order }) {
  const itemsTotal = order.items.reduce((s, it) => s + it.price * it.quantity, 0)
  const gstAmount = Math.round(itemsTotal * 0.05)
  const netAmount = itemsTotal + gstAmount

  const formattedDate = new Date(order.createdAt).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  // 80mm roll width in points (80mm ≈ 226.77 pt)
  // Height dynamically scales or fits standard thermal roll
  const pageHeight = Math.max(300, 160 + order.items.length * 16)

  return (
    <Document title={`Bill-${order.orderNumber}`}>
      <Page size={[226.77, pageHeight]} style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.brandName}>{order.brandName}</Text>
          <Text style={styles.subHeader}>Cloud Kitchen & Counter POS</Text>
          <Text style={styles.subHeader}>GSTIN: 27AABCU9603R1ZM • FSSAI: 11521018000452</Text>
        </View>

        {/* Metadata */}
        <View style={styles.metaSection}>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Invoice No:</Text>
            <Text style={styles.metaValue}>{order.orderNumber}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Date/Time:</Text>
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
            <Text style={styles.metaLabel}>Type:</Text>
            <Text style={styles.metaValue}>{order.channel}</Text>
          </View>
        </View>

        {/* Table Header */}
        <View style={styles.tableHeader}>
          <Text style={{ width: '60%' }}>Item</Text>
          <Text style={{ width: '15%', textAlign: 'center' }}>Qty</Text>
          <Text style={{ width: '25%', textAlign: 'right' }}>Amount</Text>
        </View>

        {/* Items */}
        {order.items.map((it) => (
          <View key={it.id} style={styles.itemRow}>
            <Text style={styles.itemName}>{it.name}</Text>
            <Text style={styles.itemQty}>{it.quantity}</Text>
            <Text style={styles.itemAmount}>Rs. {it.price * it.quantity}</Text>
          </View>
        ))}

        {/* Totals */}
        <View style={styles.totalsSection}>
          <View style={styles.totalRow}>
            <Text style={styles.metaLabel}>Subtotal</Text>
            <Text>Rs. {itemsTotal}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.metaLabel}>CGST (2.5%)</Text>
            <Text>Rs. {(gstAmount / 2).toFixed(1)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.metaLabel}>SGST (2.5%)</Text>
            <Text>Rs. {(gstAmount / 2).toFixed(1)}</Text>
          </View>
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>TOTAL AMOUNT</Text>
            <Text style={styles.grandTotalValue}>Rs. {netAmount}</Text>
          </View>
        </View>

        {/* Payment */}
        <View style={styles.paymentSection}>
          <Text style={styles.metaLabel}>Payment Status:</Text>
          <Text style={styles.paymentBadge}>
            {order.paymentMethod || 'CASH'} • {order.paymentStatus || 'PAID'}
          </Text>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text>*** THANK YOU! PLEASE VISIT AGAIN ***</Text>
          <Text>Powered by KitchFlow Kitchen OS</Text>
        </View>
      </Page>
    </Document>
  )
}
