'use client'

import React from 'react'
import { MarginsView } from '@/components/margins/MarginsView'
import { useKitchen } from '@/context/KitchenContext'
import { ShieldAlert } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default function MarginsPage() {
  const { orders, userRole, setUserRole } = useKitchen()

  // Guard: Cook role cannot view store P&L, commissions, and margin engine
  if (userRole === 'LINE_COOK') {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-center">
        <Card className="max-w-md p-8 border-border shadow-md space-y-4">
          <div className="w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">Access Restricted (Cook Role)</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Store P&L financials, platform take-rates, and profit ledgers are strictly restricted to Kitchen Owners and Store Managers.
            </p>
          </div>
          <div className="pt-2 flex justify-center gap-2">
            <Link href="/kds">
              <Button size="sm" variant="default" className="text-xs h-8">
                Go to KDS Screen
              </Button>
            </Link>
            <Button size="sm" variant="outline" onClick={() => setUserRole('OWNER')} className="text-xs h-8">
              Switch to Owner View
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  return <MarginsView orders={orders} />
}
