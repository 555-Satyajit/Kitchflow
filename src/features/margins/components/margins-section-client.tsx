'use client';

import React from 'react';
import { MarginsView } from '@/components/margins/MarginsView';
import { useKitchen } from '@/context/KitchenContext';
import { Lock, ArrowRight, ChefHat, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Order } from '@/types';

interface MarginsSectionClientProps {
  initialOrders: Order[];
}

export function MarginsSectionClient({ initialOrders }: MarginsSectionClientProps) {
  const { orders, setOrders, userRole, setUserRole } = useKitchen();

  // Hydrate global kitchen context with initial orders from Postgres if context orders are empty
  React.useEffect(() => {
    if (initialOrders && initialOrders.length > 0) {
      setOrders((prev) => (prev.length === 0 ? initialOrders : prev));
    }
  }, [initialOrders, setOrders]);

  // Guard: Cook role cannot view store P&L, commissions, and margin engine
  if (userRole === 'LINE_COOK') {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-md rounded-3xl border border-border/80 bg-card/90 backdrop-blur-xl shadow-xl p-7 text-center relative overflow-hidden">
          <div className="absolute -top-16 -left-16 w-36 h-36 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-16 -right-16 w-36 h-36 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

          <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-500 flex items-center justify-center mx-auto shadow-inner mb-4">
            <Lock className="w-7 h-7" />
          </div>

          <h2 className="text-lg font-bold text-foreground tracking-tight">
            Manager & Owner Access Only
          </h2>
          <p className="text-xs text-muted-foreground mt-2 leading-relaxed max-w-sm mx-auto">
            Live store P&L unit economics, aggregator commission formulas, and margin ledgers are restricted from the Cook station view.
          </p>

          <div className="mt-6 pt-5 border-t border-border/60 flex flex-col gap-2.5">
            <Link href="/kds" className="w-full">
              <Button 
                variant="default" 
                className="w-full h-11 rounded-xl text-xs font-semibold gap-2 shadow-sm active:scale-[0.98] transition-all"
              >
                <ChefHat className="w-4 h-4" />
                <span>Return to KDS Prep Station</span>
                <ArrowRight className="w-3.5 h-3.5 ml-auto opacity-70" />
              </Button>
            </Link>

            <Button 
              variant="outline" 
              onClick={() => setUserRole('OWNER')} 
              className="w-full h-11 rounded-xl text-xs font-semibold gap-2 border-border/80 active:scale-[0.98] transition-all hover:bg-muted/40"
            >
              <Sparkles className="w-4 h-4 text-primary" />
              <span>Switch to Owner View (Simulation)</span>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const effectiveOrders = orders.length > 0 ? orders : initialOrders;

  return <MarginsView orders={effectiveOrders} />;
}
