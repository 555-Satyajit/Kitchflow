'use client';

import React, { useState, useEffect } from 'react';
import { useKitchen } from '@/context/KitchenContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Store,
  Receipt,
  Users,
  Sparkles,
  MapPin,
  Phone,
  Mail,
  Shield,
  FileText,
  Percent,
  Plus,
  Loader2,
  Check,
  ChevronRight,
  Printer,
  KeyRound,
  Building2,
  ArrowRight,
  Edit2,
  Trash2,
  Flame,
  ClipboardList,
  PackageCheck,
  Boxes,
  TrendingUp,
  Settings as SettingsIcon,
  X,
  CreditCard,
  Crown,
  Lock,
  History
} from 'lucide-react';
import { AddKitchenModal } from '@/components/kitchen/AddKitchenModal';
import {
  getOrganizationKitchensAction,
  updateKitchenSettingsAction,
  saveBrandAction,
  getStaffMembersAction,
  createStaffMemberAction,
  updateStaffMemberAction,
  deleteStaffMemberAction,
  switchActiveKitchenAction,
} from '@/actions/settings';
import { Brand, StaffMember, StaffPermission } from '@/types';

type PaneType = 'outlets' | 'invoice' | 'brands' | 'staff';

export interface SettingsClientViewProps {
  initialKitchensData?: {
    kitchens: any[];
    activeKitchenId: string;
    brands?: any[];
  };
  initialStaffData?: any[];
}

export function SettingsClientView({
  initialKitchensData,
  initialStaffData,
}: SettingsClientViewProps = {}) {
  const { setBrands: setGlobalBrands } = useKitchen();
  const [outletBrands, setOutletBrands] = useState<Brand[]>(
    (initialKitchensData?.brands as unknown as Brand[]) || []
  );
  const [allBrands, setAllBrands] = useState<Brand[]>(
    ((initialKitchensData as any)?.allBrands as unknown as Brand[]) || 
    (initialKitchensData?.brands as unknown as Brand[]) || []
  );
  const [kitchens, setKitchens] = useState<any[]>(
    initialKitchensData?.kitchens || []
  );
  const [activeKitchenId, setActiveKitchenId] = useState<string>(
    initialKitchensData?.activeKitchenId || ''
  );
  const [staffMembers, setStaffMembers] = useState<any[]>(
    initialStaffData || []
  );
  const [isAddKitchenOpen, setIsAddKitchenOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isBrandsLoading, setIsBrandsLoading] = useState(false);
  // activePane can be null (Root Settings overview) or a specific section ('outlets' | 'invoice' | 'brands' | 'staff')
  const [activePane, setActivePane] = useState<PaneType | null>(null);

  // Derive initial matched kitchen
  const initialMatched =
    initialKitchensData?.kitchens?.find(
      (k: any) => k.id === initialKitchensData.activeKitchenId
    ) || initialKitchensData?.kitchens?.[0];

  const initialBrand = (initialKitchensData?.brands?.[0] as unknown as Brand) || null;

  // Form states for Kitchen Outlet Details & Invoice
  const [currentKitchen, setCurrentKitchen] = useState({
    name: initialMatched?.name || '',
    address: initialMatched?.address || '',
    phone: initialMatched?.phone || '',
    email: initialMatched?.email || '',
    gstin: initialMatched?.gstin || '',
    fssaiLic: initialMatched?.fssaiLic || '',
    gstRate: initialMatched?.gstRate ?? 5.0,
    thermalRollSize: initialMatched?.thermalRollSize || '80mm',
    invoiceTerms: initialMatched?.invoiceTerms || "Food once sold can't be returned.",
  });
  const [isSavingKitchen, setIsSavingKitchen] = useState(false);
  const [kitchenSaveSuccess, setKitchenSaveSuccess] = useState(false);

  // Selected Brand for brand edit form
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(initialBrand);
  const [brandName, setBrandName] = useState(initialBrand?.name || '');
  const [brandTagline, setBrandTagline] = useState(initialBrand?.tagline || '');
  const [brandAddress, setBrandAddress] = useState(initialBrand?.address || initialMatched?.address || '');
  const [brandPhone, setBrandPhone] = useState(initialBrand?.phone || initialMatched?.phone || '');
  const [brandEmail, setBrandEmail] = useState(initialBrand?.email || initialMatched?.email || '');
  const [brandFssai, setBrandFssai] = useState(initialBrand?.fssaiLic || initialMatched?.fssaiLic || '');
  const [brandTerms, setBrandTerms] = useState(initialBrand?.invoiceTerms || initialMatched?.invoiceTerms || '');
  const [isSavingBrand, setIsSavingBrand] = useState(false);
  const [brandSaveSuccess, setBrandSaveSuccess] = useState(false);

  // New Staff Member Form
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffPassword, setNewStaffPassword] = useState('');
  const [newStaffPin, setNewStaffPin] = useState('');
  const [newStaffRole, setNewStaffRole] = useState<'admin' | 'manager' | 'kitchen_staff'>('kitchen_staff');
  const [newStaffCustomRole, setNewStaffCustomRole] = useState('');
  const [newStaffPermissions, setNewStaffPermissions] = useState<string[]>(['orders', 'kds', 'packing']);
  const [newStaffKitchenId, setNewStaffKitchenId] = useState<string>('');
  const [newStaffBrands, setNewStaffBrands] = useState<string[]>([]);
  const [isCreatingStaff, setIsCreatingStaff] = useState(false);
  const [staffSuccessMsg, setStaffSuccessMsg] = useState(false);
  const [staffErrorMsg, setStaffErrorMsg] = useState<string | null>(null);

  // Edit Staff Member State
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [editStaffName, setEditStaffName] = useState('');
  const [editStaffCustomRole, setEditStaffCustomRole] = useState('');
  const [editStaffRole, setEditStaffRole] = useState<'admin' | 'manager' | 'kitchen_staff'>('kitchen_staff');
  const [editStaffPermissions, setEditStaffPermissions] = useState<string[]>([]);
  const [editStaffKitchenId, setEditStaffKitchenId] = useState<string>('');
  const [editStaffPin, setEditStaffPin] = useState('');
  const [editStaffBrands, setEditStaffBrands] = useState<string[]>([]);
  const [isUpdatingStaff, setIsUpdatingStaff] = useState(false);
  const [isDeletingStaff, setIsDeletingStaff] = useState(false);
  const [editStaffErrorMsg, setEditStaffErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    // If server already provided initialKitchensData, do NOT block the screen with a full-page loading spinner.
    // Instead, silently refresh in the background if active kitchen changed.
    if (!initialKitchensData) {
      loadData();
    }
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      let storedKitchenId: string | undefined = undefined;
      try {
        const savedId = localStorage.getItem('kitchflow_active_kitchen_id');
        if (savedId) storedKitchenId = savedId;
      } catch (e) {}

      const [kRes, sRes] = await Promise.all([
        getOrganizationKitchensAction(storedKitchenId),
        getStaffMembersAction(),
      ]);

      if (kRes.ok && kRes.data) {
        setKitchens(kRes.data.kitchens);
        const activeId = kRes.data.activeKitchenId || (kRes.data.kitchens[0]?.id ?? '');
        setActiveKitchenId(activeId);

        const matched = kRes.data.kitchens.find((k) => k.id === activeId) || kRes.data.kitchens[0];
        if (matched) {
          // Check if onboarding saved extra details in localStorage as fallback
          let localConfig: any = null;
          try {
            const raw = localStorage.getItem('kitchflow_outlet_config');
            if (raw) localConfig = JSON.parse(raw);
          } catch (e) {
            console.error(e);
          }

          setCurrentKitchen({
            name: matched.name || localConfig?.name || '',
            address: matched.address || localConfig?.address || '',
            phone: matched.phone || localConfig?.phone || '',
            email: matched.email || localConfig?.ownerCredentials?.email || localConfig?.email || '',
            gstin: matched.gstin || localConfig?.gstin || '',
            fssaiLic: matched.fssaiLic || localConfig?.fssaiLic || '',
            gstRate: matched.gstRate ?? localConfig?.gstRate ?? 5.0,
            thermalRollSize: matched.thermalRollSize || localConfig?.thermalRollSize || '80mm',
            invoiceTerms: matched.invoiceTerms || localConfig?.invoiceTerms || 'Food once sold cannot be returned or exchanged.',
          });
        }

        if (kRes.data.brands && kRes.data.brands.length > 0) {
          const loadedBrands = kRes.data.brands as Brand[];
          setOutletBrands(loadedBrands);
          setGlobalBrands(loadedBrands);
          const first = loadedBrands[0];
          setSelectedBrand(first);
          setBrandName(first.name || '');
          setBrandTagline(first.tagline || '');
          setBrandAddress(first.address || matched?.address || '');
          setBrandPhone(first.phone || matched?.phone || '');
          setBrandEmail(first.email || matched?.email || '');
          setBrandFssai(first.fssaiLic || matched?.fssaiLic || '');
          setBrandTerms(first.invoiceTerms || matched?.invoiceTerms || '');
        }

        if ((kRes.data as any).allBrands && (kRes.data as any).allBrands.length > 0) {
          setAllBrands((kRes.data as any).allBrands as Brand[]);
        }
      }

      if (sRes.ok && sRes.data) {
        setStaffMembers(sRes.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKitchenSelect = async (kId: string) => {
    setActiveKitchenId(kId);
    const matched = kitchens.find((k) => k.id === kId);
    if (matched) {
      setCurrentKitchen({
        name: matched.name || '',
        address: matched.address || '',
        phone: matched.phone || '',
        email: matched.email || '',
        gstin: matched.gstin || '',
        fssaiLic: matched.fssaiLic || '',
        gstRate: matched.gstRate ?? 5.0,
        thermalRollSize: matched.thermalRollSize || '80mm',
        invoiceTerms: matched.invoiceTerms || 'Food once sold cannot be returned or exchanged.',
      });
      try {
        localStorage.setItem('kitchflow_active_kitchen_id', matched.id);
        localStorage.setItem('kitchflow_active_kitchen_name', matched.name);
      } catch (e) {}

      // Persist to server cookie so /orders and /inventory reflect this outlet
      switchActiveKitchenAction(matched.id).catch(console.error);

      // Fetch brands specific to this selected outlet
      setIsBrandsLoading(true);
      try {
        const res = await getOrganizationKitchensAction(kId);
        if (res.ok && res.data?.brands) {
          const loadedBrands = res.data.brands as Brand[];
          setOutletBrands(loadedBrands);
          setGlobalBrands(loadedBrands);
          if (loadedBrands.length > 0) {
            const first = loadedBrands[0];
            setSelectedBrand(first);
            setBrandName(first.name || '');
            setBrandTagline(first.tagline || '');
            setBrandAddress(first.address || matched.address || '');
            setBrandPhone(first.phone || matched.phone || '');
            setBrandEmail(first.email || matched.email || '');
            setBrandFssai(first.fssaiLic || matched.fssaiLic || '');
            setBrandTerms(first.invoiceTerms || matched.invoiceTerms || '');
          }
          if ((res.data as any).allBrands && (res.data as any).allBrands.length > 0) {
            setAllBrands((res.data as any).allBrands as Brand[]);
          }
        }
      } catch (err) {
        console.error('Failed reloading outlet brands:', err);
      } finally {
        setIsBrandsLoading(false);
      }
    }
  };

  const handleSaveKitchen = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeKitchenId) return;
    setIsSavingKitchen(true);
    setKitchenSaveSuccess(false);

    try {
      const res = await updateKitchenSettingsAction({
        kitchenId: activeKitchenId,
        ...currentKitchen,
      });

      if (res.ok) {
        setKitchenSaveSuccess(true);
        setTimeout(() => setKitchenSaveSuccess(false), 3000);
        setKitchens((prev) =>
          prev.map((k) => (k.id === activeKitchenId ? { ...k, ...currentKitchen } : k))
        );
      }
    } finally {
      setIsSavingKitchen(false);
    }
  };

  const handleBrandPick = (b: Brand) => {
    setSelectedBrand(b);
    setBrandName(b.name || '');
    setBrandTagline(b.tagline || '');
    setBrandAddress(b.address || currentKitchen.address || '');
    setBrandPhone(b.phone || currentKitchen.phone || '');
    setBrandEmail(b.email || currentKitchen.email || '');
    setBrandFssai(b.fssaiLic || currentKitchen.fssaiLic || '');
    setBrandTerms(b.invoiceTerms || currentKitchen.invoiceTerms || '');
  };

  const handleSaveBrandInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBrand || !activeKitchenId) return;
    setIsSavingBrand(true);
    setBrandSaveSuccess(false);

    try {
      const res = await saveBrandAction({
        id: selectedBrand.id,
        kitchenId: activeKitchenId,
        name: brandName || selectedBrand.name,
        tagline: brandTagline,
        color: selectedBrand.color,
        address: brandAddress,
        phone: brandPhone,
        email: brandEmail,
        fssaiLic: brandFssai,
        invoiceTerms: brandTerms,
      });

      if (res.ok) {
        setBrandSaveSuccess(true);
        setTimeout(() => setBrandSaveSuccess(false), 3000);
        const updateBrand = (b: Brand) =>
          b.id === selectedBrand.id
            ? {
                ...b,
                name: brandName || b.name,
                tagline: brandTagline,
                address: brandAddress,
                phone: brandPhone,
                email: brandEmail,
                fssaiLic: brandFssai,
                invoiceTerms: brandTerms,
              }
            : b;
        setOutletBrands((prev) => prev.map(updateBrand));
        setGlobalBrands((prev) => prev.map(updateBrand));
      }
    } finally {
      setIsSavingBrand(false);
    }
  };

  const AVAILABLE_PERMISSIONS: { id: StaffPermission; label: string; desc: string; icon: any }[] = [
    { id: 'orders', label: 'Live Orders Queue', desc: 'Accept & manage incoming orders', icon: ClipboardList },
    { id: 'pos', label: 'Counter POS Register', desc: 'Punch manual counter walk-in tickets', icon: CreditCard },
    { id: 'kds', label: 'KDS Cook Stations', desc: 'Kitchen line screens & bump items', icon: Flame },
    { id: 'packing', label: 'Packing & Dispatch', desc: 'QA inspection & rider handover', icon: PackageCheck },
    { id: 'inventory', label: 'Ingredient Stock', desc: 'Real-time stock ledger & alerts', icon: Boxes },
    { id: 'procurement', label: 'Wastage & Purchase Orders', desc: 'Log spoilage & supplier orders', icon: FileText },
    { id: 'margins', label: 'Financials & Margins', desc: 'Gross margin, food cost & P&L', icon: TrendingUp },
    { id: 'settings', label: 'Outlet & Team Settings', desc: 'Manage facility, brands & staff', icon: SettingsIcon },
    { id: 'history', label: 'Order History & Invoices', desc: 'Past orders, invoices & receipt reprint', icon: History },
    { id: 'customers', label: 'Customer Directory & CRM', desc: 'Guest profiles, loyalty tiers & CRM', icon: Users },
  ];

  const ROLE_SUGGESTIONS = [
    'Head Chef',
    'Line Cook',
    'Counter Cashier',
    'Expeditor / QA',
    'Packaging Associate',
    'Delivery Coordinator',
    'Kitchen Manager',
  ];

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffEmail || !newStaffName) return;

    setIsCreatingStaff(true);
    setStaffErrorMsg(null);
    try {
      const res = await createStaffMemberAction({
        name: newStaffName,
        email: newStaffEmail,
        password: newStaffPassword || undefined,
        pin: newStaffPin || '1234',
        role: newStaffRole,
        customRole: newStaffCustomRole || undefined,
        permissions: newStaffPermissions,
        kitchenId: newStaffKitchenId || undefined,
        allowedBrands: newStaffBrands,
      });

      if (res.ok) {
        setStaffSuccessMsg(true);
        setTimeout(() => setStaffSuccessMsg(false), 3000);
        setNewStaffName('');
        setNewStaffEmail('');
        setNewStaffPassword('');
        setNewStaffPin('');
        setNewStaffCustomRole('');
        setNewStaffPermissions(['orders', 'kds', 'packing']);
        setNewStaffKitchenId('');
        setNewStaffBrands([]);
        const sRes = await getStaffMembersAction();
        if (sRes.ok && sRes.data) setStaffMembers(sRes.data);
      } else {
        setStaffErrorMsg(res.error || 'Failed to provision staff account');
      }
    } catch (err: any) {
      setStaffErrorMsg(err?.message || 'An unexpected error occurred while provisioning account');
    } finally {
      setIsCreatingStaff(false);
    }
  };

  const togglePermissionForNewStaff = (permId: string) => {
    setNewStaffPermissions((prev) =>
      prev.includes(permId) ? prev.filter((p) => p !== permId) : [...prev, permId]
    );
  };

  const toggleBrandForStaff = (brandId: string) => {
    setNewStaffBrands((prev) =>
      prev.includes(brandId) ? prev.filter((id) => id !== brandId) : [...prev, brandId]
    );
  };

  const handleOpenEditStaff = (member: StaffMember) => {
    setEditingStaff(member);
    setEditStaffErrorMsg(null);
    setEditStaffName(member.name || '');
    setEditStaffCustomRole(member.customRole || '');
    setEditStaffRole((member.role as any) || 'kitchen_staff');
    setEditStaffPermissions(member.permissions || ['orders', 'kds', 'packing']);
    setEditStaffKitchenId(member.kitchenId || '');
    setEditStaffPin(member.pin || '');
    setEditStaffBrands(member.allowedBrands || []);
  };

  const togglePermissionForEditStaff = (permId: string) => {
    setEditStaffPermissions((prev) =>
      prev.includes(permId) ? prev.filter((p) => p !== permId) : [...prev, permId]
    );
  };

  const toggleBrandForEditStaff = (brandId: string) => {
    setEditStaffBrands((prev) =>
      prev.includes(brandId) ? prev.filter((id) => id !== brandId) : [...prev, brandId]
    );
  };

  const handleSaveEditStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff) return;

    setIsUpdatingStaff(true);
    setEditStaffErrorMsg(null);
    try {
      const res = await updateStaffMemberAction({
        memberId: editingStaff.id,
        name: editStaffName,
        customRole: editStaffCustomRole || undefined,
        role: editStaffRole,
        permissions: editStaffPermissions,
        kitchenId: editStaffKitchenId || null,
        pin: editStaffPin || undefined,
        allowedBrands: editStaffBrands,
      });

      if (res.ok) {
        setEditingStaff(null);
        const sRes = await getStaffMembersAction();
        if (sRes.ok && sRes.data) setStaffMembers(sRes.data);
      } else {
        setEditStaffErrorMsg(res.error || 'Failed to update staff member');
      }
    } catch (err: any) {
      setEditStaffErrorMsg(err?.message || 'An unexpected error occurred while updating member');
    } finally {
      setIsUpdatingStaff(false);
    }
  };

  const handleDeleteStaff = async (memberId: string) => {
    if (!confirm('Are you sure you want to remove this staff member?')) return;
    setIsDeletingStaff(true);
    try {
      const res = await deleteStaffMemberAction(memberId);
      if (res.ok) {
        if (editingStaff?.id === memberId) setEditingStaff(null);
        const sRes = await getStaffMembersAction();
        if (sRes.ok && sRes.data) setStaffMembers(sRes.data);
      }
    } finally {
      setIsDeletingStaff(false);
    }
  };

  if (isLoading) {
    return <SettingsSkeleton />;
  }

  const activeKitchenObj = kitchens.find((k) => k.id === activeKitchenId) || kitchens[0];

  const navigationSections = [
    {
      id: 'outlets' as PaneType,
      title: 'Kitchen Outlets',
      subtitle: activeKitchenObj?.name || 'Provision & manage outlets',
      count: kitchens.length,
      icon: Store,
      color: 'bg-blue-500 text-white',
    },
    {
      id: 'brands' as PaneType,
      title: 'Brand Invoices & Profiles',
      subtitle: `Configure bill & details for ${outletBrands.length} brand${outletBrands.length === 1 ? '' : 's'}`,
      count: outletBrands.length,
      icon: Sparkles,
      color: 'bg-purple-500 text-white',
    },
    {
      id: 'invoice' as PaneType,
      title: 'Tax Rates & Thermal Roll',
      subtitle: currentKitchen.gstin ? `GST ${currentKitchen.gstRate}% • Roll: ${currentKitchen.thermalRollSize}` : 'Default tax rate & printer roll size',
      icon: Receipt,
      color: 'bg-emerald-500 text-white',
    },
    {
      id: 'staff' as PaneType,
      title: 'Staff & Security',
      subtitle: `${staffMembers.length} Active team accounts & PINs`,
      count: staffMembers.length,
      icon: Users,
      color: 'bg-amber-500 text-white',
    },
  ];

  const currentSection = navigationSections.find((s) => s.id === activePane);

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* ========================================================================= */}
      {/* ROOT LEVEL VIEW: Standard Apple Settings Main Screen */}
      {/* ========================================================================= */}
      {!activePane ? (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* iOS Settings Large Title Header */}
          <div className="pt-2 pb-1">
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Settings</h1>
          </div>

          {/* Apple ID Style Profile / Active Kitchen Card */}
          <div
            onClick={() => setActivePane('outlets')}
            className="p-4 rounded-2xl bg-card border border-border/80 shadow-xs flex items-center justify-between cursor-pointer hover:bg-muted/30 active:scale-[0.99] transition-all"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-primary/80 to-primary flex items-center justify-center text-primary-foreground font-bold shadow-xs shrink-0">
                <Building2 className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-foreground truncate">
                    {activeKitchenObj?.name || 'Provision Kitchen'}
                  </h2>
                  <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-semibold h-4 px-1.5 rounded-full">
                    Current
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {activeKitchenObj?.address || 'Tap to switch or add kitchen outlet'}
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground/60 shrink-0 ml-2" />
          </div>

          {/* Grouped Inset List: Core Settings Sections */}
          <div className="space-y-1.5">
            <div className="text-[11px] font-semibold text-muted-foreground uppercase px-3 tracking-wider">
              General
            </div>
            <div className="rounded-2xl bg-card border border-border/80 shadow-xs overflow-hidden divide-y divide-border/60">
              {navigationSections.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActivePane(item.id)}
                    className="w-full p-3.5 flex items-center justify-between text-left hover:bg-muted/40 active:bg-muted/60 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-xs ${item.color}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-[14px] font-medium text-foreground block truncate group-hover:text-primary transition-colors">
                          {item.title}
                        </span>
                        <span className="text-[12px] text-muted-foreground block truncate">
                          {item.subtitle}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      {item.count !== undefined && (
                        <Badge variant="secondary" className="text-[11px] h-5 px-2 font-medium rounded-full bg-muted text-muted-foreground">
                          {item.count}
                        </Badge>
                      )}
                      <ChevronRight className="w-4 h-4 text-muted-foreground/60 group-hover:text-foreground transition-colors" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Action Inset Group */}
          <div className="space-y-1.5 pt-1">
            <div className="text-[11px] font-semibold text-muted-foreground uppercase px-3 tracking-wider">
              Quick Actions
            </div>
            <div className="rounded-2xl bg-card border border-border/80 shadow-xs overflow-hidden divide-y divide-border/60">
              <button
                type="button"
                onClick={() => setIsAddKitchenOpen(true)}
                className="w-full p-3.5 flex items-center justify-between text-left hover:bg-muted/40 active:bg-muted/60 transition-colors cursor-pointer text-primary"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Plus className="w-4 h-4" />
                  </div>
                  <span className="text-[14px] font-semibold">Add New Kitchen Outlet</span>
                </div>
                <ChevronRight className="w-4 h-4 text-primary/60" />
              </button>
            </div>
            <p className="px-3 text-[11px] text-muted-foreground leading-relaxed pt-1">
              Changes made in settings sync automatically across your active POS registers, KDS screens, and kitchen thermal printers.
            </p>
          </div>
        </div>
      ) : (
        /* DETAIL VIEW: Apple Drill-Down View with Top Navigation Bar (< Settings) */
        <div className="space-y-6 animate-in slide-in-from-right-4 duration-200">
          {/* iOS Standard Top Navigation Bar */}
          <div className="flex items-center justify-between pb-1 border-b border-border/50 pt-1">
            <button
              type="button"
              onClick={() => setActivePane(null)}
              className="inline-flex items-center gap-1 text-primary hover:opacity-80 transition-opacity font-semibold text-sm cursor-pointer -ml-1 py-1 px-2 rounded-lg"
            >
              <ChevronRight className="w-4 h-4 rotate-180" />
              <span>Settings</span>
            </button>

            <h2 className="text-sm font-bold text-foreground">
              {currentSection?.title}
            </h2>

            {/* Trailing action space */}
            <div className="w-16 flex justify-end">
              {activePane === 'outlets' && (
                <button
                  type="button"
                  onClick={() => setIsAddKitchenOpen(true)}
                  className="text-xs font-semibold text-primary hover:underline cursor-pointer"
                >
                  + Add
                </button>
              )}
            </div>
          </div>

          {/* ========================================================================= */}
          {/* SECTION 1: KITCHEN OUTLETS DETAIL */}
          {/* ========================================================================= */}
          {activePane === 'outlets' && (
            <div className="space-y-6">
              <div className="space-y-1.5">
                <div className="text-[11px] font-semibold text-muted-foreground uppercase px-3 tracking-wider">
                  Select Active Facility ({kitchens.length})
                </div>
                <div className="rounded-2xl bg-card border border-border/80 shadow-xs overflow-hidden divide-y divide-border/60">
                  {kitchens.length === 0 ? (
                    <div className="p-8 text-center space-y-3">
                      <Store className="w-8 h-8 text-muted-foreground mx-auto" />
                      <p className="text-xs font-semibold text-foreground">No Kitchen Facilities Configured</p>
                      <Button
                        size="sm"
                        onClick={() => setIsAddKitchenOpen(true)}
                        className="h-8 text-xs font-semibold rounded-full"
                      >
                        + Provision First Kitchen
                      </Button>
                    </div>
                  ) : (
                    kitchens.map((k) => {
                      const isActive = k.id === activeKitchenId;
                      return (
                        <div
                          key={k.id}
                          onClick={() => handleKitchenSelect(k.id)}
                          className={`p-3.5 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                            isActive ? 'bg-primary/5' : 'hover:bg-muted/30'
                          }`}
                        >
                          <div className="flex items-center gap-3.5 min-w-0">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                              isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                            }`}>
                              <Store className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <h4 className="font-bold text-[13px] text-foreground truncate">{k.name}</h4>
                                {isActive && (
                                  <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-semibold h-4 px-1.5 rounded-full">
                                    Active
                                  </Badge>
                                )}
                              </div>
                              <p className="text-[11px] text-muted-foreground truncate">{k.address || 'Address not configured'}</p>
                              <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono mt-0.5">
                                {k.phone && <span>{k.phone}</span>}
                                {k.phone && k.gstin && <span>•</span>}
                                {k.gstin && <span>GST: {k.gstin}</span>}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {isActive ? (
                              <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center">
                                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                              </div>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleKitchenSelect(k.id);
                                }}
                                className="h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground rounded-lg"
                              >
                                Select
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
                <p className="px-3 text-[11px] text-muted-foreground">
                  The active kitchen determines which inventory levels, live orders, and dispatch slips are displayed on your stations.
                </p>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* SECTION 2: INVOICE & TAX SETTINGS DETAIL */}
          {/* ========================================================================= */}
          {activePane === 'invoice' && (
            <form onSubmit={handleSaveKitchen} className="space-y-6">
              {kitchenSaveSuccess && (
                <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center gap-2">
                  <Check className="w-4 h-4 stroke-[2.5]" />
                  <span>Invoice preferences saved successfully!</span>
                </div>
              )}

              {/* Grouped Section: Legal & Tax */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-semibold text-muted-foreground uppercase px-3 tracking-wider">
                  Compliance & Tax Rates
                </div>
                <div className="rounded-2xl bg-card border border-border/80 shadow-xs divide-y divide-border/60 overflow-hidden">
                  <div className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="space-y-0.5">
                      <span className="text-[13px] font-medium text-foreground block">GSTIN Registration</span>
                      <span className="text-[11px] text-muted-foreground block">Official GST Identification Number</span>
                    </div>
                    <Input
                      placeholder="e.g. 21AABCU9603R1ZM"
                      value={currentKitchen.gstin}
                      onChange={(e) => setCurrentKitchen({ ...currentKitchen, gstin: e.target.value })}
                      className="h-8 w-full sm:w-56 text-xs rounded-lg uppercase font-mono"
                    />
                  </div>

                  <div className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="space-y-0.5">
                      <span className="text-[13px] font-medium text-foreground block">FSSAI License</span>
                      <span className="text-[11px] text-muted-foreground block">Food Safety and Standards Authority of India</span>
                    </div>
                    <Input
                      placeholder="e.g. 12024018000452"
                      value={currentKitchen.fssaiLic}
                      onChange={(e) => setCurrentKitchen({ ...currentKitchen, fssaiLic: e.target.value })}
                      className="h-8 w-full sm:w-56 text-xs rounded-lg font-mono"
                    />
                  </div>

                  <div className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="space-y-0.5">
                      <span className="text-[13px] font-medium text-foreground block">GST Tax Rate</span>
                      <span className="text-[11px] text-muted-foreground block">Standard restaurant GST (typically 5.0%)</span>
                    </div>
                    <div className="flex items-center gap-1.5 w-full sm:w-32">
                      <Input
                        type="number"
                        step="0.5"
                        placeholder="5.0"
                        value={currentKitchen.gstRate}
                        onChange={(e) => setCurrentKitchen({ ...currentKitchen, gstRate: parseFloat(e.target.value) || 0 })}
                        className="h-8 text-xs rounded-lg font-mono text-right"
                      />
                      <span className="text-xs font-bold text-muted-foreground">%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Grouped Section: Address & Contact */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-semibold text-muted-foreground uppercase px-3 tracking-wider">
                  Outlet Location & Contact
                </div>
                <div className="rounded-2xl bg-card border border-border/80 shadow-xs divide-y divide-border/60 overflow-hidden">
                  <div className="px-4 py-3 space-y-1.5">
                    <span className="text-[13px] font-medium text-foreground block">Physical Facility Address</span>
                    <Input
                      placeholder="e.g. Plot No. 42, Food Street, Infocity Square, Patia, Bhubaneswar - 751024"
                      value={currentKitchen.address}
                      onChange={(e) => setCurrentKitchen({ ...currentKitchen, address: e.target.value })}
                      className="h-8 text-xs rounded-lg"
                    />
                  </div>

                  <div className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="text-[13px] font-medium text-foreground block">Official Contact Phone</span>
                    <Input
                      placeholder="+91 98765 43210"
                      value={currentKitchen.phone}
                      onChange={(e) => setCurrentKitchen({ ...currentKitchen, phone: e.target.value })}
                      className="h-8 w-full sm:w-56 text-xs rounded-lg"
                    />
                  </div>

                  <div className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="text-[13px] font-medium text-foreground block">Customer Support Email</span>
                    <Input
                      type="email"
                      placeholder="orders@kitchflow.in"
                      value={currentKitchen.email}
                      onChange={(e) => setCurrentKitchen({ ...currentKitchen, email: e.target.value })}
                      className="h-8 w-full sm:w-56 text-xs rounded-lg"
                    />
                  </div>
                </div>
              </div>

              {/* Grouped Section: Thermal Printing */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-semibold text-muted-foreground uppercase px-3 tracking-wider">
                  Thermal Receipt Layout
                </div>
                <div className="rounded-2xl bg-card border border-border/80 shadow-xs divide-y divide-border/60 overflow-hidden">
                  <div className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="space-y-0.5">
                      <span className="text-[13px] font-medium text-foreground block">Paper Roll Dimension</span>
                      <span className="text-[11px] text-muted-foreground block">Standard POS thermal roll width</span>
                    </div>
                    <select
                      value={currentKitchen.thermalRollSize}
                      onChange={(e) => setCurrentKitchen({ ...currentKitchen, thermalRollSize: e.target.value })}
                      className="h-8 px-2 text-xs font-medium rounded-lg border border-border/80 bg-background text-foreground"
                    >
                      <option value="80mm">80mm (Standard Kitchen Receipt)</option>
                      <option value="58mm">58mm (Compact Mobile Printer)</option>
                    </select>
                  </div>

                  <div className="px-4 py-3 space-y-1.5">
                    <span className="text-[13px] font-medium text-foreground block">Receipt Footer Terms & Policy</span>
                    <Input
                      placeholder="Food once sold cannot be returned or exchanged."
                      value={currentKitchen.invoiceTerms}
                      onChange={(e) => setCurrentKitchen({ ...currentKitchen, invoiceTerms: e.target.value })}
                      className="h-8 text-xs rounded-lg"
                    />
                    <p className="text-[10px] text-muted-foreground">Prints at the base of thermal slips above barcode and greetings.</p>
                  </div>
                </div>
              </div>

              {/* Apple Save Bar */}
              <div className="flex justify-end pt-2">
                <Button
                  type="submit"
                  disabled={isSavingKitchen}
                  className="h-9 px-5 rounded-full font-semibold text-xs shadow-xs transition-transform active:scale-95"
                >
                  {isSavingKitchen ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5 mr-1.5" />
                      <span>Apply Changes</span>
                    </>
                  )}
                </Button>
              </div>
            </form>
          )}

          {/* ========================================================================= */}
          {/* SECTION 3: BRAND CUSTOMIZATION DETAIL */}
          {/* ========================================================================= */}
          {activePane === 'brands' && (
            <div className="space-y-6">
              {isBrandsLoading ? (
                <div className="space-y-6 animate-pulse">
                  {/* Brand List Skeleton */}
                  <div className="space-y-1.5">
                    <Skeleton className="h-3 w-28 rounded-md ml-3" />
                    <div className="rounded-2xl border border-border/80 bg-card overflow-hidden divide-y divide-border/60">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="p-3.5 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Skeleton className="w-4 h-4 rounded-full" />
                            <div className="space-y-1.5">
                              <Skeleton className="h-3.5 w-32 rounded-md" />
                              <Skeleton className="h-2.5 w-48 rounded-md" />
                            </div>
                          </div>
                          <Skeleton className="w-4 h-4 rounded-md" />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Brand Form Skeleton */}
                  <div className="space-y-3 pt-2">
                    <Skeleton className="h-4 w-40 rounded-md ml-1" />
                    <div className="rounded-2xl border border-border/80 bg-card divide-y divide-border/60 overflow-hidden">
                      {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div key={i} className="p-4 flex items-center justify-between">
                          <div className="space-y-1">
                            <Skeleton className="h-3 w-32 rounded-md" />
                            <Skeleton className="h-2.5 w-44 rounded-md" />
                          </div>
                          <Skeleton className="h-8 w-48 rounded-lg" />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* Grouped Inset List of Brands */}
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-semibold text-muted-foreground uppercase px-3 tracking-wider">
                      Virtual Brands ({outletBrands.length})
                    </div>
                    <div className="rounded-2xl bg-card border border-border/80 shadow-xs divide-y divide-border/60 overflow-hidden">
                      {outletBrands.map((b) => {
                        const isSelected = selectedBrand?.id === b.id;
                        return (
                          <div
                            key={b.id}
                            onClick={() => handleBrandPick(b)}
                            className={`p-3.5 flex items-center justify-between cursor-pointer transition-colors ${
                              isSelected ? 'bg-primary/5' : 'hover:bg-muted/30'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <span
                                className="w-4 h-4 rounded-full shrink-0 shadow-2xs border border-white/20"
                                style={{ backgroundColor: b.color }}
                              />
                              <div>
                                <span className="text-[13px] font-bold text-foreground block">{b.name}</span>
                                <span className="text-[11px] text-muted-foreground block">
                                  {b.tagline || (b.fssaiLic ? `FSSAI: ${b.fssaiLic}` : (b.phone ? `Ph: ${b.phone}` : 'Storefront'))}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              {isSelected && <Badge variant="secondary" className="text-[10px] h-4 px-1.5 rounded-full">Editing</Badge>}
                              <ChevronRight className="w-4 h-4 text-muted-foreground/60" />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Brand Editing Form */}
                  {selectedBrand && (
                    <form onSubmit={handleSaveBrandInvoice} className="space-y-4 pt-2">
                      <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: selectedBrand.color }} />
                          <h3 className="text-sm font-bold text-foreground">Edit Brand: {selectedBrand.name}</h3>
                        </div>
                        {brandSaveSuccess && (
                          <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" /> Saved successfully
                          </span>
                        )}
                      </div>

                      <div className="rounded-2xl bg-card border border-border/80 shadow-xs divide-y divide-border/60 overflow-hidden">
                        {/* Brand Name */}
                        <div className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="space-y-0.5">
                            <span className="text-[13px] font-medium text-foreground block">Brand Storefront Name</span>
                            <span className="text-[11px] text-muted-foreground block">Appears as title on receipts and orders</span>
                          </div>
                          <Input
                            placeholder="e.g. Beheroz Biriyani"
                            value={brandName}
                            onChange={(e) => setBrandName(e.target.value)}
                            className="h-8 w-full sm:w-64 text-xs rounded-lg font-medium"
                          />
                        </div>

                        {/* Brand Cuisine / Tagline */}
                        <div className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="space-y-0.5">
                            <span className="text-[13px] font-medium text-foreground block">Cuisine &amp; Concept</span>
                            <span className="text-[11px] text-muted-foreground block">Subtitle or category (e.g. Royal Dum Biryani)</span>
                          </div>
                          <Input
                            placeholder="e.g. Biryani &amp; Kebabs"
                            value={brandTagline}
                            onChange={(e) => setBrandTagline(e.target.value)}
                            className="h-8 w-full sm:w-64 text-xs rounded-lg"
                          />
                        </div>

                        {/* Brand Address */}
                        <div className="px-4 py-3 space-y-1">
                          <span className="text-[13px] font-medium text-foreground block">Billing Address</span>
                          <Input
                            placeholder="Enter brand address (optional)"
                            value={brandAddress}
                            onChange={(e) => setBrandAddress(e.target.value)}
                            className="h-8 text-xs rounded-lg"
                          />
                        </div>

                        {/* Brand Phone */}
                        <div className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <span className="text-[13px] font-medium text-foreground block">Customer Support Phone</span>
                          <Input
                            placeholder="+91 XXXXX XXXXX"
                            value={brandPhone}
                            onChange={(e) => setBrandPhone(e.target.value)}
                            className="h-8 w-full sm:w-64 text-xs rounded-lg font-mono"
                          />
                        </div>

                        {/* Brand Email */}
                        <div className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <span className="text-[13px] font-medium text-foreground block">Customer Support Email</span>
                          <Input
                            type="email"
                            placeholder="support@yourbrand.com"
                            value={brandEmail}
                            onChange={(e) => setBrandEmail(e.target.value)}
                            className="h-8 w-full sm:w-64 text-xs rounded-lg"
                          />
                        </div>

                        {/* Brand FSSAI */}
                        <div className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <span className="text-[13px] font-medium text-foreground block">FSSAI License Number</span>
                          <Input
                            placeholder="14-digit license number"
                            value={brandFssai}
                            onChange={(e) => setBrandFssai(e.target.value)}
                            className="h-8 w-full sm:w-64 text-xs rounded-lg font-mono"
                          />
                        </div>

                        {/* Brand Terms */}
                        <div className="px-4 py-3 space-y-1">
                          <span className="text-[13px] font-medium text-foreground block">Receipt Footer Terms &amp; Policy</span>
                          <Input
                            placeholder="e.g. Food once sold cannot be returned or exchanged."
                            value={brandTerms}
                            onChange={(e) => setBrandTerms(e.target.value)}
                            className="h-8 text-xs rounded-lg"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end pt-1">
                        <Button
                          type="submit"
                          disabled={isSavingBrand}
                          className="h-9 px-5 rounded-full font-semibold text-xs shadow-xs"
                        >
                          {isSavingBrand ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Check className="w-3.5 h-3.5 mr-1.5" />}
                          <span>Save Brand Details</span>
                        </Button>
                      </div>
                    </form>
                  )}
                </>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* SECTION 4: STAFF & SECURITY DETAIL */}
          {/* ========================================================================= */}
          {activePane === 'staff' && (
            <div className="space-y-6">
              {staffSuccessMsg && (
                <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center gap-2">
                  <Check className="w-4 h-4 stroke-[2.5]" />
                  <span>Crew member account provisioned successfully!</span>
                </div>
              )}

              {staffErrorMsg && (
                <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center gap-2">
                  <Shield className="w-4 h-4 stroke-[2.5]" />
                  <span>{staffErrorMsg}</span>
                </div>
              )}

              {/* Grouped Section: Provision New Member */}
              <form onSubmit={handleCreateStaff} className="space-y-4">
                <div className="text-[11px] font-semibold text-muted-foreground uppercase px-3 tracking-wider flex items-center justify-between">
                  <span>Add New Crew Member</span>
                  <span className="text-[10px] lowercase font-normal text-muted-foreground">Custom Role &amp; Granular Permissions</span>
                </div>
                <div className="rounded-2xl bg-card border border-border/80 shadow-xs divide-y divide-border/60 overflow-hidden">
                  {/* Full Name */}
                  <div className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="text-[13px] font-medium text-foreground block">Full Name</span>
                    <Input
                      required
                      placeholder="e.g. Ramesh Kumar"
                      value={newStaffName}
                      onChange={(e) => setNewStaffName(e.target.value)}
                      className="h-8 w-full sm:w-64 text-xs rounded-lg"
                    />
                  </div>

                  {/* Email ID */}
                  <div className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="text-[13px] font-medium text-foreground block">Email ID</span>
                    <Input
                      required
                      type="email"
                      placeholder="staff@outlet.com"
                      value={newStaffEmail}
                      onChange={(e) => setNewStaffEmail(e.target.value)}
                      className="h-8 w-full sm:w-64 text-xs rounded-lg"
                    />
                  </div>

                  {/* Password */}
                  <div className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="text-[13px] font-medium text-foreground block">Password</span>
                    <Input
                      type="password"
                      placeholder="••••••••"
                      value={newStaffPassword}
                      onChange={(e) => setNewStaffPassword(e.target.value)}
                      className="h-8 w-full sm:w-64 text-xs rounded-lg"
                    />
                  </div>

                  {/* Station Fast PIN */}
                  <div className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="space-y-0.5">
                      <span className="text-[13px] font-medium text-foreground block">Station Fast PIN</span>
                      <span className="text-[11px] text-muted-foreground block">4-digit PIN for quick touchscreen login</span>
                    </div>
                    <Input
                      maxLength={4}
                      placeholder="1234"
                      value={newStaffPin}
                      onChange={(e) => setNewStaffPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      className="h-8 w-28 text-xs rounded-lg font-mono text-center tracking-widest"
                    />
                  </div>

                  {/* CUSTOM ROLE NAME INPUT */}
                  <div className="px-4 py-3 space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <div>
                        <span className="text-[13px] font-medium text-foreground block">Role Name</span>
                        <span className="text-[11px] text-muted-foreground block">Type any role title you want (e.g. Head Chef, Cashier, Expeditor, Dishwasher)</span>
                      </div>
                      <Input
                        required
                        placeholder="e.g. Head Chef"
                        value={newStaffCustomRole}
                        onChange={(e) => setNewStaffCustomRole(e.target.value)}
                        className="h-8 w-full sm:w-64 text-xs font-semibold rounded-lg text-primary border-primary/40 focus-visible:ring-primary/20"
                      />
                    </div>
                    {/* Quick suggestion chips */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[10px] text-muted-foreground mr-1">Quick Suggestions:</span>
                      {ROLE_SUGGESTIONS.map((sug) => (
                        <button
                          key={sug}
                          type="button"
                          onClick={() => setNewStaffCustomRole(sug)}
                          className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition-all ${
                            newStaffCustomRole === sug
                              ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                              : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                          }`}
                        >
                          {sug}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Assigned Kitchen Facility */}
                  <div className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="space-y-0.5">
                      <span className="text-[13px] font-medium text-foreground block">Assigned Kitchen Facility</span>
                      <span className="text-[11px] text-muted-foreground block">Restrict crew to a specific kitchen outlet</span>
                    </div>
                    <select
                      value={newStaffKitchenId}
                      onChange={(e) => setNewStaffKitchenId(e.target.value)}
                      className="h-8 px-2.5 text-xs font-medium rounded-lg border border-border/80 bg-background text-foreground w-full sm:w-64"
                    >
                      <option value="">All Kitchen Outlets (Global)</option>
                      {kitchens.map((k) => (
                        <option key={k.id} value={k.id}>
                          {k.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* GRANULAR FEATURE PERMISSIONS MATRIX */}
                  <div className="px-4 py-3 space-y-2.5 bg-muted/15">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <span className="text-[13px] font-semibold text-foreground block">Granted Features &amp; Modules</span>
                        <span className="text-[11px] text-muted-foreground block">Toggle exactly what this team member can access</span>
                      </div>
                      <Badge variant="outline" className="text-[10px] font-mono px-2 py-0.5 bg-background">
                        {newStaffPermissions.length} of {AVAILABLE_PERMISSIONS.length} active
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      {AVAILABLE_PERMISSIONS.map((perm) => {
                        const Icon = perm.icon;
                        const isChecked = newStaffPermissions.includes(perm.id);
                        return (
                          <div
                            key={perm.id}
                            onClick={() => togglePermissionForNewStaff(perm.id)}
                            className={`p-2.5 rounded-xl border cursor-pointer transition-all flex items-start gap-2.5 select-none ${
                              isChecked
                                ? 'bg-primary/5 border-primary/40 shadow-xs'
                                : 'bg-card border-border/60 hover:border-border text-muted-foreground opacity-75'
                            }`}
                          >
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                              isChecked ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                            }`}>
                              <Icon className="w-3.5 h-3.5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-1">
                                <span className={`text-xs font-semibold ${isChecked ? 'text-foreground' : 'text-muted-foreground'}`}>
                                  {perm.label}
                                </span>
                                {isChecked && <Check className="w-3.5 h-3.5 text-primary stroke-[2.5]" />}
                              </div>
                              <p className="text-[10px] text-muted-foreground line-clamp-1">{perm.desc}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Brand permission picker */}
                  <div className="px-4 py-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] font-medium text-foreground block">Allowed Virtual Brands</span>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {newStaffBrands.length === 0 ? 'All Brands Accessible' : `${newStaffBrands.length} Brands Assigned`}
                      </span>
                    </div>
                    {/* Notice if kitchen is selected */}
                    {newStaffKitchenId ? (
                      <p className="text-[10px] text-muted-foreground">
                        Showing brands belonging to selected kitchen outlet:
                      </p>
                    ) : (
                      <p className="text-[10px] text-muted-foreground">
                        Showing all organization brands across outlets:
                      </p>
                    )}
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {(() => {
                        const targetBrands = newStaffKitchenId 
                          ? allBrands.filter((b: any) => b.kitchenId === newStaffKitchenId)
                          : allBrands.length > 0 ? allBrands : outletBrands;

                        if (targetBrands.length === 0) {
                          return (
                            <span className="text-xs text-muted-foreground italic">
                              No virtual brands configured for this kitchen yet.
                            </span>
                          );
                        }

                        return targetBrands.map((b) => {
                          const isAllowed = newStaffBrands.includes(b.id);
                          return (
                            <button
                              key={b.id}
                              type="button"
                              onClick={() => toggleBrandForStaff(b.id)}
                              className={`px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer border transition-all flex items-center gap-1.5 ${
                                isAllowed
                                  ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                                  : 'bg-muted/40 text-muted-foreground border-border/70 hover:border-foreground/30'
                              }`}
                            >
                              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: b.color }} />
                              <span>{b.name}</span>
                              {isAllowed && <Check className="w-3 h-3 ml-0.5" />}
                            </button>
                          );
                        });
                      })()}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <Button
                    type="submit"
                    disabled={isCreatingStaff || !newStaffName || !newStaffEmail || !newStaffCustomRole.trim()}
                    className="h-9 px-4 rounded-full font-semibold text-xs shadow-xs"
                  >
                    {isCreatingStaff ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                    ) : (
                      <Users className="w-3.5 h-3.5 mr-1.5" />
                    )}
                    <span>Provision Account</span>
                  </Button>
                </div>
              </form>

              {/* Grouped Section: Active Team Roster */}
              <div className="space-y-1.5 pt-2">
                <div className="text-[11px] font-semibold text-muted-foreground uppercase px-3 tracking-wider flex items-center justify-between">
                  <span>Active Team Members ({staffMembers.length})</span>
                  <span className="text-[10px] lowercase font-normal text-muted-foreground">Click member to edit permissions</span>
                </div>
                <div className="rounded-2xl bg-card border border-border/80 shadow-xs divide-y divide-border/60 overflow-hidden">
                  {staffMembers.length === 0 ? (
                    <div className="p-4 text-xs text-muted-foreground italic">No extra staff members added yet.</div>
                  ) : (
                    staffMembers.map((m: StaffMember) => (
                      <div
                        key={m.id}
                        className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-muted/20 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs uppercase shrink-0 border ${
                            m.role === 'owner'
                              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 shadow-xs'
                              : 'bg-primary/10 text-primary border-primary/20'
                          }`}>
                            {m.role === 'owner' ? <Crown className="w-4 h-4" /> : m.name ? m.name.charAt(0) : 'U'}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-[13px] text-foreground truncate">{m.name || 'Staff Member'}</span>
                              {m.role === 'owner' ? (
                                <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-[10px] font-semibold px-2 py-0 rounded-full flex items-center gap-1">
                                  <Crown className="w-3 h-3" />
                                  <span>Owner &amp; Root Admin</span>
                                </Badge>
                              ) : m.customRole ? (
                                <Badge className="bg-primary/15 text-primary border border-primary/25 text-[10px] font-semibold px-2 py-0 rounded-full">
                                  {m.customRole}
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[9px] uppercase font-mono px-1.5 py-0 rounded">
                                  {m.role}
                                </Badge>
                              )}
                              {m.kitchenName && (
                                <Badge variant="secondary" className="text-[9px] font-medium px-1.5 py-0 rounded flex items-center gap-1">
                                  <Store className="w-2.5 h-2.5" />
                                  <span>{m.kitchenName}</span>
                                </Badge>
                              )}
                            </div>
                            <div className="text-[11px] text-muted-foreground font-mono truncate mt-0.5">
                              ID: {m.userId?.slice(0, 10)}... {m.pin ? `• PIN: ${m.pin}` : ''}
                            </div>
                            {/* Granted permission tags */}
                            <div className="flex flex-wrap gap-1 mt-1">
                              {m.role === 'owner' ? (
                                <span className="text-[9px] font-medium px-2 py-0.5 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 rounded-md border border-emerald-500/20 flex items-center gap-1 font-mono">
                                  <Check className="w-2.5 h-2.5 stroke-[3]" />
                                  <span>Full Access (All 8 Features)</span>
                                </span>
                              ) : (
                                (m.permissions || ['orders', 'kds', 'packing']).map((p) => (
                                  <span
                                    key={p}
                                    className="text-[9px] font-medium px-1.5 py-0.2 bg-muted text-muted-foreground rounded"
                                  >
                                    {p}
                                  </span>
                                ))
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {m.role === 'owner' ? (
                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted/40 border border-border/60 text-muted-foreground text-[11px] font-medium">
                              <Lock className="w-3 h-3 text-amber-500" />
                              <span>Protected</span>
                            </div>
                          ) : (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenEditStaff(m)}
                                className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground rounded-lg"
                              >
                                <Edit2 className="w-3.5 h-3.5 mr-1" />
                                <span>Edit</span>
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteStaff(m.id)}
                                className="h-8 px-2 text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 rounded-lg"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* EDIT STAFF MODAL DIALOG */}
              {editingStaff && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
                  <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                    <div className="p-4 border-b border-border flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-primary" />
                        <h3 className="font-bold text-sm text-foreground">Edit Staff Permissions &amp; Roles</h3>
                      </div>
                      <button
                        onClick={() => setEditingStaff(null)}
                        className="text-muted-foreground hover:text-foreground p-1 rounded-lg"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <form onSubmit={handleSaveEditStaff} className="p-4 space-y-4 max-h-[80vh] overflow-y-auto">
                      {/* Error Alert */}
                      {editStaffErrorMsg && (
                        <div className="p-3 text-xs bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-400 rounded-xl flex items-center justify-between">
                          <span>{editStaffErrorMsg}</span>
                          <button
                            type="button"
                            onClick={() => setEditStaffErrorMsg(null)}
                            className="text-rose-600 hover:text-rose-700 ml-2"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}

                      {/* Name */}
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-foreground">Full Name</label>
                        <Input
                          value={editStaffName}
                          onChange={(e) => setEditStaffName(e.target.value)}
                          className="h-8 text-xs rounded-lg"
                        />
                      </div>

                      {/* Custom Role Name */}
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-foreground">Custom Role Name</label>
                        <Input
                          placeholder="e.g. Head Chef / Expeditor"
                          value={editStaffCustomRole}
                          onChange={(e) => setEditStaffCustomRole(e.target.value)}
                          className="h-8 text-xs rounded-lg font-semibold text-primary"
                        />
                        <div className="flex flex-wrap gap-1 pt-1">
                          {ROLE_SUGGESTIONS.map((sug) => (
                            <button
                              key={sug}
                              type="button"
                              onClick={() => setEditStaffCustomRole(sug)}
                              className="px-2 py-0.5 rounded text-[10px] bg-muted/60 hover:bg-muted text-muted-foreground"
                            >
                              {sug}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Touch PIN */}
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-foreground">Touch Fast PIN (4-Digits)</label>
                        <Input
                          maxLength={4}
                          placeholder="1234"
                          value={editStaffPin}
                          onChange={(e) => setEditStaffPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                          className="h-8 w-32 text-xs font-mono text-center tracking-widest rounded-lg"
                        />
                      </div>

                      {/* Kitchen Assignment */}
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-foreground">Assigned Kitchen Facility</label>
                        <select
                          value={editStaffKitchenId}
                          onChange={(e) => setEditStaffKitchenId(e.target.value)}
                          className="h-8 px-2 text-xs font-medium rounded-lg border border-border/80 bg-background text-foreground w-full"
                        >
                          <option value="">All Outlets (Global)</option>
                          {kitchens.map((k) => (
                            <option key={k.id} value={k.id}>
                              {k.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Feature Permissions Matrix */}
                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-semibold text-foreground">Feature Permissions</label>
                          {editingStaff.role === 'owner' ? (
                            <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-mono px-2 py-0.5 rounded-full">
                              Owner: All 8 Features Unrestricted
                            </Badge>
                          ) : (
                            <span className="text-[10px] text-muted-foreground font-mono">
                              {editStaffPermissions.length} enabled
                            </span>
                          )}
                        </div>
                        {editingStaff.role === 'owner' ? (
                          <div className="p-3 rounded-xl bg-muted/40 border border-border/70 space-y-1.5">
                            <p className="text-[11px] text-muted-foreground">
                              The Organization Owner holds immutable root administrative access across all 8 features. Permissions cannot be removed or revoked.
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {AVAILABLE_PERMISSIONS.map((perm) => (
                                <span
                                  key={perm.id}
                                  className="text-[10px] font-medium px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-md border border-emerald-500/20 flex items-center gap-1"
                                >
                                  <Check className="w-3 h-3" />
                                  <span>{perm.label}</span>
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-2">
                            {AVAILABLE_PERMISSIONS.map((perm) => {
                              const isChecked = editStaffPermissions.includes(perm.id);
                              return (
                                <button
                                  key={perm.id}
                                  type="button"
                                  onClick={() => togglePermissionForEditStaff(perm.id)}
                                  className={`p-2 rounded-lg border text-left flex items-center justify-between text-xs transition-colors ${
                                    isChecked
                                      ? 'bg-primary/10 border-primary/40 font-semibold text-foreground'
                                      : 'bg-muted/30 border-border/60 text-muted-foreground'
                                  }`}
                                >
                                  <span>{perm.label}</span>
                                  {isChecked && <Check className="w-3.5 h-3.5 text-primary stroke-[2.5]" />}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Allowed Brands */}
                      <div className="space-y-1.5 pt-1">
                        <label className="text-xs font-semibold text-foreground">Allowed Brands</label>
                        <div className="flex flex-wrap gap-1.5">
                          {(() => {
                            const targetBrands = editStaffKitchenId 
                              ? allBrands.filter((b: any) => b.kitchenId === editStaffKitchenId)
                              : allBrands.length > 0 ? allBrands : outletBrands;

                            if (targetBrands.length === 0) {
                              return (
                                <span className="text-xs text-muted-foreground italic">
                                  No virtual brands configured for this kitchen yet.
                                </span>
                              );
                            }

                            return targetBrands.map((b) => {
                              const isAllowed = editStaffBrands.includes(b.id);
                              return (
                                <button
                                  key={b.id}
                                  type="button"
                                  onClick={() => toggleBrandForEditStaff(b.id)}
                                  className={`px-2 py-1 rounded-full text-xs font-medium border flex items-center gap-1.5 ${
                                    isAllowed
                                      ? 'bg-primary text-primary-foreground border-primary'
                                      : 'bg-muted/40 text-muted-foreground border-border/60'
                                  }`}
                                >
                                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: b.color }} />
                                  <span>{b.name}</span>
                                  {isAllowed && <Check className="w-3 h-3 ml-0.5" />}
                                </button>
                              );
                            });
                          })()}
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingStaff(null)}
                          className="h-8 text-xs rounded-lg"
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          size="sm"
                          disabled={isUpdatingStaff}
                          className="h-8 px-4 text-xs font-semibold rounded-lg shadow-xs"
                        >
                          {isUpdatingStaff ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Check className="w-3.5 h-3.5 mr-1.5" />}
                          <span>Save Changes</span>
                        </Button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Add Kitchen Modal Dialog */}
      <AddKitchenModal
        open={isAddKitchenOpen}
        onOpenChange={setIsAddKitchenOpen}
        onKitchenCreated={(kId, kName) => {
          loadData();
        }}
      />
    </div>
  );
}

export function SettingsSkeleton() {
  return (
    <div className="space-y-6 max-w-2xl mx-auto animate-pulse">
      {/* Header Skeleton */}
      <div className="pt-2 pb-1 space-y-2">
        <Skeleton className="h-7 w-32 rounded-lg" />
        <Skeleton className="h-4 w-64 rounded-md" />
      </div>

      {/* Active Kitchen Facility Card Skeleton */}
      <div className="p-4 rounded-2xl bg-card border border-border/70 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <Skeleton className="w-12 h-12 rounded-full" />
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-44 rounded-md" />
              <Skeleton className="h-4 w-14 rounded-full" />
            </div>
            <Skeleton className="h-3 w-60 rounded-md" />
          </div>
        </div>
        <Skeleton className="w-5 h-5 rounded-md" />
      </div>

      {/* Grouped Inset Sections Skeleton */}
      <div className="space-y-1.5">
        <Skeleton className="h-3 w-20 rounded-md ml-3" />
        <div className="rounded-2xl border border-border/80 bg-card overflow-hidden divide-y divide-border/60">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="p-3.5 flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <Skeleton className="w-8 h-8 rounded-lg" />
                <div className="space-y-1.5">
                  <Skeleton className="h-3.5 w-36 rounded-md" />
                  <Skeleton className="h-2.5 w-52 rounded-md" />
                </div>
              </div>
              <Skeleton className="w-4 h-4 rounded-md" />
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions Skeleton */}
      <div className="space-y-1.5 pt-1">
        <Skeleton className="h-3 w-24 rounded-md ml-3" />
        <div className="rounded-2xl border border-border/80 bg-card p-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <Skeleton className="w-8 h-8 rounded-lg" />
            <div className="space-y-1.5">
              <Skeleton className="h-3.5 w-32 rounded-md" />
              <Skeleton className="h-2.5 w-44 rounded-md" />
            </div>
          </div>
          <Skeleton className="w-4 h-4 rounded-md" />
        </div>
      </div>
    </div>
  );
}


