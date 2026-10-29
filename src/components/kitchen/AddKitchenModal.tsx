'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createKitchenAction } from '@/actions/settings';
import { Store, MapPin, Phone, Mail, Receipt, Sparkles, Loader2, ArrowRight } from 'lucide-react';

interface AddKitchenModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onKitchenCreated?: (kitchenId: string, name: string) => void;
}

export function AddKitchenModal({ open, onOpenChange, onKitchenCreated }: AddKitchenModalProps) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [gstin, setGstin] = useState('');
  const [fssaiLic, setFssaiLic] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      setIsSubmitting(true);
      setErrorMsg(null);

      const res = await createKitchenAction({
        name: name.trim(),
        address: address.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        gstin: gstin.trim() || undefined,
        fssaiLic: fssaiLic.trim() || undefined,
      });

      if (!res.ok || !res.data) {
        setErrorMsg(res.error || 'Failed to create kitchen outlet');
        return;
      }

      // Save as active in local storage for instantaneous fast switch
      try {
        localStorage.setItem('kitchflow_active_kitchen_id', res.data.kitchenId);
        localStorage.setItem('kitchflow_active_kitchen_name', res.data.name);
      } catch (e) {}

      onKitchenCreated?.(res.data.kitchenId, res.data.name);
      onOpenChange(false);
      setName('');
      setAddress('');
      setPhone('');
      setEmail('');
      setGstin('');
      setFssaiLic('');

      // Refresh window so all server components immediately bind to new outlet
      window.location.reload();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unexpected network error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-lg max-h-[88vh] p-5 sm:p-6 rounded-3xl border border-border/80 bg-card/95 backdrop-blur-2xl shadow-2xl overflow-y-auto no-scrollbar space-y-4">
        {/* Apple HIG Header */}
        <DialogHeader className="pb-3 border-b border-border/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0 shadow-inner">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-extrabold tracking-tight text-foreground">
                Add New Kitchen Outlet
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Provision a new physical cloud kitchen or branch facility
              </p>
            </div>
          </div>
        </DialogHeader>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-semibold">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Outlet Name */}
          <div className="space-y-1.5">
            <Label className="font-semibold text-foreground text-xs flex items-center gap-1.5">
              <span>Outlet Name</span>
              <span className="text-destructive">*</span>
            </Label>
            <Input
              required
              placeholder="e.g. Patia Central Kitchen / Koramangala Hub"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-10 text-xs rounded-xl bg-background border-border/80"
            />
          </div>

          {/* Physical Address */}
          <div className="space-y-1.5">
            <Label className="font-semibold text-foreground text-xs flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
              <span>Full Physical Address (Appears on Bills)</span>
            </Label>
            <Input
              placeholder="e.g. Plot No. 42, Infocity Road, Patia, Bhubaneswar - 751024"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="h-10 text-xs rounded-xl bg-background border-border/80"
            />
          </div>

          {/* Contact Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="font-semibold text-foreground text-xs flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Outlet Phone</span>
              </Label>
              <Input
                placeholder="+91 98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="h-10 text-xs rounded-xl bg-background border-border/80"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="font-semibold text-foreground text-xs flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Support Email</span>
              </Label>
              <Input
                placeholder="orders@kitchflow.in"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-10 text-xs rounded-xl bg-background border-border/80"
              />
            </div>
          </div>

          {/* Legal Compliance */}
          <div className="p-3.5 rounded-2xl border border-border/70 bg-muted/20 space-y-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground font-mono flex items-center gap-1.5">
              <Receipt className="w-3.5 h-3.5 text-primary" />
              <span>Tax & FSSAI Compliance</span>
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground font-medium">GSTIN (Optional)</Label>
                <Input
                  placeholder="21AABCU9603R1ZM"
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value)}
                  className="h-9 text-xs rounded-lg bg-background border-border/80 font-mono uppercase"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground font-medium">FSSAI License (Optional)</Label>
                <Input
                  placeholder="12024018000452"
                  value={fssaiLic}
                  onChange={(e) => setFssaiLic(e.target.value)}
                  className="h-9 text-xs rounded-lg bg-background border-border/80 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Quick link to Comprehensive 5-Step Onboarding Wizard */}
          <div className="p-3 rounded-2xl bg-primary/5 border border-primary/20 flex items-center justify-between gap-3">
            <div className="space-y-0.5 min-w-0">
              <span className="text-[11px] font-bold text-foreground block">Need multi-brand, menu seed & staff setup?</span>
              <span className="text-[10px] text-muted-foreground block truncate">Launch the full 5-step kitchen deployment wizard</span>
            </div>
            <a
              href="/admin/onboard"
              onClick={() => onOpenChange(false)}
              className="text-[11px] font-bold text-primary hover:underline shrink-0 flex items-center gap-1 cursor-pointer"
            >
              <span>Full Setup</span>
              <ArrowRight className="w-3 h-3" />
            </a>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="h-10 rounded-xl font-semibold text-xs border-border/80 cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="h-10 rounded-xl font-bold text-xs bg-primary text-primary-foreground hover:bg-primary/90 shadow-2xs gap-2 cursor-pointer active:scale-95 transition-all"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Provisioning Outlet...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Create & Activate Kitchen</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
