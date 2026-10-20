'use client'

import React from 'react'
import { OrdersQueueView } from '@/components/orders/OrdersQueueView'
import { MarginModal } from '@/components/margins/MarginModal'
import { useKitchen } from '@/context/KitchenContext'

export default function OrdersPage() {
  const {
    orders,
    userRole,
    setUserRole,
    handleUpdateStatus,
    inspectingOrder,
    setInspectingOrder,
    handleSimulateNewOrder,
  } = useKitchen()

  // Guard: Cooks focus exclusively on KDS and Dispatch
  if (userRole === 'LINE_COOK') {
    return (
      <div className="py-16 flex flex-col items-center justify-center text-center">
        <div className="max-w-md p-6 bg-card border-2 border-border rounded-2xl shadow-sm space-y-4">
          <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center mx-auto">
            <span className="text-xl">👨‍🍳</span>
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">Cook Station Mode Active</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Cooks work from the KDS Kitchen Display and Dispatch QA checklist. Order financials and multi-channel queues are reserved for store managers.
            </p>
          </div>
          <div className="pt-2 flex justify-center gap-2">
            <a href="/kds" className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold">
              Open KDS Cook Screen
            </a>
            <button
              onClick={() => setUserRole('OWNER')}
              className="px-3 py-2 rounded-lg border border-border text-xs font-semibold hover:bg-muted"
            >
              Switch to Owner View
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <OrdersQueueView
        orders={orders}
        onUpdateStatus={handleUpdateStatus}
        onInspectFinancials={(o) => setInspectingOrder(o)}
        onSimulateNewOrder={handleSimulateNewOrder}
      />
      <MarginModal
        order={inspectingOrder}
        onClose={() => setInspectingOrder(null)}
      />
    </>
  )
}
