'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { 
  Store, 
  RefreshCw, 
  ShieldAlert, 
  ChefHat,
  HelpCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface RootErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function RootError({ error, reset }: RootErrorProps) {
  const router = useRouter();

  const isAuthError =
    error.name === 'AuthenticationRequiredError' ||
    error.message?.includes('Authentication required') ||
    error.message?.includes('Active session not found') ||
    error.message?.includes('token expired');

  const isKitchenNotFoundError =
    error.name === 'KitchenNotFoundError' ||
    error.message?.includes('No active kitchen') ||
    error.message?.includes('No active cloud kitchen') ||
    error.message?.includes('does not belong to your organization');

  // Case 1: Intercept Auth failures and seamlessly redirect to /login
  useEffect(() => {
    if (isAuthError) {
      const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/orders';
      router.replace(`/login?redirectTo=${encodeURIComponent(currentPath)}`);
    }
  }, [isAuthError, router]);

  // If redirecting to login, render minimal sleek authenticating splash
  if (isAuthError) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 selection:bg-primary/20">
        <div className="w-full max-w-sm flex flex-col items-center space-y-4 text-center">
          <div className="relative h-10 w-auto flex items-center justify-center">
            <Image
              src="/logo.png?v=2"
              alt="KitchFlow"
              width={160}
              height={40}
              className="h-8 w-auto object-contain"
              priority
              unoptimized
            />
          </div>
          <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary animate-pulse">
            <ChefHat className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-bold text-foreground">Session Expired</p>
            <p className="text-[11px] text-muted-foreground">Redirecting to secure login portal...</p>
          </div>
        </div>
      </div>
    );
  }

  // Case 2: Kitchen Not Found - Apple HIG Empty State
  if (isKitchenNotFoundError) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 selection:bg-primary/20">
        <div className="w-full max-w-md rounded-3xl border border-border/80 bg-card/95 backdrop-blur-2xl p-8 shadow-2xl text-center space-y-6">
          {/* Brand header */}
          <div className="relative h-10 w-auto flex items-center justify-center mx-auto">
            <Image
              src="/logo.png?v=2"
              alt="KitchFlow"
              width={160}
              height={40}
              className="h-8 w-auto object-contain"
              priority
              unoptimized
            />
          </div>

          {/* Icon Badge */}
          <div className="w-16 h-16 rounded-3xl bg-amber-500/10 border border-amber-500/25 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto shadow-inner">
            <Store className="w-8 h-8 stroke-[1.8]" />
          </div>

          {/* Messaging */}
          <div className="space-y-2">
            <Badge variant="outline" className="text-[10px] font-mono font-bold px-2.5 py-0.5 text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-500/10">
              No Active Kitchen Facility
            </Badge>
            <h1 className="text-xl font-extrabold tracking-tight text-foreground">
              Kitchen Store Not Configured
            </h1>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-xs mx-auto">
              Your account is authenticated, but no active cloud kitchen location is registered under your organization.
            </p>
          </div>

          {/* Action Guidance Card */}
          <div className="p-4 rounded-2xl bg-muted/30 border border-border/60 text-left space-y-2 text-xs">
            <div className="flex items-center gap-2 font-bold text-foreground text-[11px]">
              <HelpCircle className="w-3.5 h-3.5 text-primary" />
              <span>Next Steps:</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Please contact your kitchen organization owner or systems administrator to assign this account to an active outlet.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-2.5 pt-1">
            <Button
              onClick={() => reset()}
              className="w-full h-11 rounded-xl text-xs font-bold shadow-sm active:scale-[0.98] transition-all cursor-pointer gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Re-check Kitchen Status</span>
            </Button>

            <Button
              variant="outline"
              onClick={() => router.push('/login')}
              className="w-full h-11 rounded-xl text-xs font-semibold border-border/80 hover:bg-muted/50 active:scale-[0.98] transition-all cursor-pointer"
            >
              Sign In with Another Account
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Case 3: Transient / Database / Unexpected Errors
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 selection:bg-primary/20">
      <div className="w-full max-w-md rounded-3xl border border-destructive/20 bg-card/95 backdrop-blur-2xl p-8 shadow-2xl text-center space-y-6">
        <div className="w-16 h-16 rounded-3xl bg-destructive/10 border border-destructive/25 text-destructive flex items-center justify-center mx-auto shadow-inner">
          <ShieldAlert className="w-8 h-8 stroke-[1.8]" />
        </div>

        <div className="space-y-2">
          <Badge variant="outline" className="text-[10px] font-mono font-bold px-2.5 py-0.5 text-destructive border-destructive/30 bg-destructive/10">
            System Operational Notice
          </Badge>
          <h1 className="text-xl font-extrabold tracking-tight text-foreground">
            Connection Interruption
          </h1>
          <p className="text-xs text-muted-foreground leading-relaxed max-w-xs mx-auto">
            {error?.message || 'A momentary interruption occurred while verifying operational data.'}
          </p>
        </div>

        <div className="flex flex-col gap-2.5 pt-1">
          <Button
            onClick={() => reset()}
            className="w-full h-11 rounded-xl text-xs font-bold shadow-sm active:scale-[0.98] transition-all cursor-pointer gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Retry Connection</span>
          </Button>

          <Button
            variant="outline"
            onClick={() => router.push('/login')}
            className="w-full h-11 rounded-xl text-xs font-semibold border-border/80 hover:bg-muted/50 active:scale-[0.98] transition-all cursor-pointer"
          >
            Return to Sign In
          </Button>
        </div>
      </div>
    </div>
  );
}
