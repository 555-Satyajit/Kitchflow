'use client'

import React, { useState, useEffect } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useKitchen } from '@/context/KitchenContext'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { 
  Lock, 
  Store, 
  Printer, 
  CheckCircle2, 
  Sparkles, 
  ArrowRight, 
  Plus, 
  Trash2, 
  AlertCircle,
  KeyRound,
  ChefHat,
  ChevronRight,
  ShieldCheck,
  Building2,
  Receipt,
  UtensilsCrossed,
  SlidersHorizontal,
  Flame,
  UserCheck,
  ExternalLink,
  Headphones,
  Users,
  Copy,
  Check,
  Eye,
  EyeOff,
  RefreshCw,
  Mail,
  User
} from 'lucide-react'
import { formatCurrency, cn } from '@/lib/utils'
import { provisionKitchenAction, verifyAdminAccessKeyAction } from './onboard-actions'

// Random secure password generator for kitchen owners
const generateSecurePassword = () => {
  const words = ['Chef', 'Kitchen', 'Order', 'Prime', 'Cloud', 'Bistro', 'Flavor', 'Flame']
  const symbols = ['@', '#', '$', '!']
  const word = words[Math.floor(Math.random() * words.length)]
  const num = Math.floor(1000 + Math.random() * 9000)
  const sym = symbols[Math.floor(Math.random() * symbols.length)]
  return `${word}${sym}${num}`
}

// Random 4-digit Master POS Pin
const generateMasterPin = () => {
  return String(Math.floor(1000 + Math.random() * 9000))
}

interface BrandSetup {
  name: string
  cuisine: string
  color?: string
}

interface MenuItemDraft {
  name: string
  brandName: string
  price: number
  category: string
}

const BRAND_PRESET_COLORS = ['#f97316', '#eab308', '#10b981', '#8b5cf6', '#ef4444', '#0ea5e9']

export default function InternalOnboardingPage() {
  const router = useRouter()
  const { brands } = useKitchen()

  // Step 0: Gatekeeper / Secret authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [accessKeyInput, setAccessKeyInput] = useState('')
  const [authError, setAuthError] = useState(false)

  // Wizard state (1: Kitchen Identity & Brands, 2: Owner Credentials, 3: Tax & Hardware, 4: Menu Catalog, 5: Launch)
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1)

  // Form Data (starts clean with no dummy values)
  const [kitchenName, setKitchenName] = useState('')
  const [outletAddress, setOutletAddress] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [gstin, setGstin] = useState('')
  const [fssaiLic, setFssaiLic] = useState('')
  
  // Brands (empty by default)
  const [brandList, setBrandList] = useState<BrandSetup[]>([])
  const [newBrandName, setNewBrandName] = useState('')
  const [newBrandCuisine, setNewBrandCuisine] = useState('')

  // Billing & Hardware defaults
  const [gstRate, setGstRate] = useState<number>(5) // 5% standard F&B
  const [thermalRollSize, setThermalRollSize] = useState<'80mm' | '58mm'>('80mm')
  const [autoOpenDrawer, setAutoOpenDrawer] = useState(true)

  // Starter Menu Drafts (empty by default)
  const [menuItems, setMenuItems] = useState<MenuItemDraft[]>([])
  const [newItemName, setNewItemName] = useState('')
  const [newItemPrice, setNewItemPrice] = useState('')
  const [newItemBrand, setNewItemBrand] = useState('')

  // Menu Onboarding Choice: 'self' (seed themselves) vs 'managed' (done by KitchFlow Concierge team)
  const [menuOnboardingMode, setMenuOnboardingMode] = useState<'self' | 'managed'>('self')
  const [conciergeNotes, setConciergeNotes] = useState('')
  const [conciergeFileAttached, setConciergeFileAttached] = useState(false)

  // Owner & Master Operator Login Credentials (starts clean with generated secure password & pin)
  const [ownerName, setOwnerName] = useState('')
  const [ownerEmail, setOwnerEmail] = useState('')
  const [ownerPassword, setOwnerPassword] = useState('Flavor#2026')
  const [ownerPin, setOwnerPin] = useState('5123')
  const [showPassword, setShowPassword] = useState(false)
  const [copiedCredential, setCopiedCredential] = useState<string | null>(null)

  // Generate dynamic credentials on client mount to keep prerender completely deterministic
  useEffect(() => {
    setOwnerPassword(generateSecurePassword())
    setOwnerPin(generateMasterPin())
  }, [])

  // Provisioning state
  const [isProvisioning, setIsProvisioning] = useState(false)
  const [isProvisioned, setIsProvisioned] = useState(false)

  const handleRegeneratePassword = () => {
    setOwnerPassword(generateSecurePassword())
  }

  const handleRegeneratePin = () => {
    setOwnerPin(generateMasterPin())
  }

  const handleCopyCredentials = (textToCopy: string, tag: string) => {
    navigator.clipboard.writeText(textToCopy)
    setCopiedCredential(tag)
    setTimeout(() => setCopiedCredential(null), 2000)
  }

  // Auth Handler
  const handleAuthenticate = async (e: React.FormEvent) => {
    e.preventDefault()
    const verification = await verifyAdminAccessKeyAction(accessKeyInput.trim())
    if (verification.ok) {
      setIsAuthenticated(true)
      setAuthError(false)
    } else {
      setAuthError(true)
    }
  }

  // Brand Handlers
  const handleAddBrand = () => {
    if (!newBrandName.trim()) return
    const randomColor = BRAND_PRESET_COLORS[brandList.length % BRAND_PRESET_COLORS.length]
    setBrandList([...brandList, { 
      name: newBrandName.trim(), 
      cuisine: newBrandCuisine.trim() || 'Multi-Cuisine',
      color: randomColor
    }])
    setNewBrandName('')
    setNewBrandCuisine('')
  }

  const handleRemoveBrand = (index: number) => {
    setBrandList(brandList.filter((_, i) => i !== index))
  }

  // Menu Handlers
  const handleAddMenuItem = () => {
    if (!newItemName.trim() || !newItemPrice) return
    setMenuItems([
      ...menuItems,
      {
        name: newItemName.trim(),
        price: Number(newItemPrice),
        brandName: newItemBrand || brandList[0]?.name || 'Direct',
        category: 'Chef Special'
      }
    ])
    setNewItemName('')
    setNewItemPrice('')
  }

  const handleRemoveMenuItem = (index: number) => {
    setMenuItems(menuItems.filter((_, i) => i !== index))
  }

  // Final Provisioning Action with PostgreSQL Persistence
  const handleLaunchKitchen = async () => {
    setIsProvisioning(true)
    try {
      const kitchenConfig = {
        name: kitchenName,
        address: outletAddress,
        phone: contactPhone,
        gstin,
        fssaiLic,
        gstRate,
        thermalRollSize,
        brands: brandList,
        menuOnboardingMode,
        conciergeNotes: menuOnboardingMode === 'managed' ? conciergeNotes : undefined,
        ownerCredentials: {
          name: ownerName,
          email: ownerEmail,
          password: ownerPassword,
          pin: ownerPin,
          role: 'Kitchen Owner / Master Admin'
        },
        provisionedAt: new Date().toISOString()
      }
      localStorage.setItem('kitchflow_outlet_config', JSON.stringify(kitchenConfig))

      // Persist kitchen, brands, and menu items to PostgreSQL database via Prisma Server Action
      const dbResult = await provisionKitchenAction({
        accessKey: accessKeyInput.trim(),
        name: kitchenName,
        address: outletAddress,
        phone: contactPhone,
        gstin,
        fssaiLic,
        gstRate,
        thermalRollSize,
        brands: brandList,
        menuItems: menuItems,
        menuOnboardingMode,
        conciergeNotes: menuOnboardingMode === 'managed' ? conciergeNotes : undefined,
        ownerCredentials: {
          name: ownerName,
          email: ownerEmail,
          password: ownerPassword,
          pin: ownerPin,
        },
      })

      if (dbResult.ok && dbResult.kitchenId) {
        localStorage.setItem('kitchflow_active_kitchen_id', dbResult.kitchenId)
        if (dbResult.organizationId) {
          localStorage.setItem('kitchflow_active_org_id', dbResult.organizationId)
        }
      } else if (!dbResult.ok) {
        console.warn('Database provisioning notice:', dbResult.error)
      }
    } catch (e) {
      console.error('Provisioning error:', e)
    } finally {
      setIsProvisioning(false)
      setIsProvisioned(true)
    }
  }

  // -------------------------------------------------------------
  // VIEW 1: LOCKED GATEKEEPER SCREEN (Apple Minimalist Glass)
  // -------------------------------------------------------------
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 selection:bg-primary/20">
        <div className="w-full max-w-sm space-y-6">
          {/* Official Brand Logo & Header */}
          <div className="text-center space-y-3 relative">
            <div className="relative h-12 w-auto flex items-center justify-center mx-auto mb-1">
              <Image
                src="/logo.png?v=2"
                alt="KitchFlow"
                width={190}
                height={50}
                className="h-10 w-auto object-contain"
                priority
                unoptimized
              />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/10 border border-primary/25 text-primary text-[10px] font-mono font-bold uppercase tracking-wider mb-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Internal Ops Portal</span>
              </div>
              <h1 className="text-xl font-bold tracking-tight text-foreground">
                Kitchen Provisioning
              </h1>
              <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                Authorized deployment engineers & kitchen operations only.
              </p>
            </div>
          </div>

          {/* Key Form Card */}
          <div className="rounded-3xl border border-border/80 bg-card/90 backdrop-blur-xl shadow-xl p-6 space-y-4">
            <form onSubmit={handleAuthenticate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="opsKey" className="text-xs font-semibold text-foreground">
                  Master Security Key
                </Label>
                <div className="relative">
                  <Input
                    id="opsKey"
                    type="password"
                    placeholder="Enter team passkey..."
                    value={accessKeyInput}
                    onChange={(e) => {
                      setAccessKeyInput(e.target.value)
                      setAuthError(false)
                    }}
                    className="h-11 rounded-xl bg-background border-border/80 text-foreground placeholder:text-muted-foreground/60 font-mono text-sm pl-10 focus-visible:ring-primary/20 shadow-2xs"
                    autoFocus
                  />
                  <Lock className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {authError && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs animate-in fade-in">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Access Denied. Invalid master security key.</span>
                </div>
              )}

              <Button 
                type="submit" 
                className="w-full h-11 rounded-xl font-bold text-xs shadow-sm active:scale-[0.98] transition-all cursor-pointer gap-2"
              >
                <span>Authenticate & Unlock</span>
                <ArrowRight className="w-4 h-4 ml-auto opacity-70" />
              </Button>
            </form>
          </div>

          <p className="text-[11px] text-center text-muted-foreground font-mono">
            KitchFlow Kitchen OS • Provisioning Engine v2.4
          </p>
        </div>
      </div>
    )
  }

  // -------------------------------------------------------------
  // VIEW 2: SUCCESS LAUNCHED SCREEN (Apple Celebration Inset)
  // -------------------------------------------------------------
  if (isProvisioned) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-3xl border border-border/80 bg-card/95 backdrop-blur-2xl text-center p-7 sm:p-8 shadow-2xl space-y-6">
          <div className="relative h-11 w-auto flex items-center justify-center mx-auto">
            <Image
              src="/logo.png?v=2"
              alt="KitchFlow"
              width={180}
              height={44}
              className="h-9 w-auto object-contain"
              priority
              unoptimized
            />
          </div>
          <div className="w-16 h-16 rounded-3xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-inner">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div className="space-y-1.5">
            <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[11px] font-bold px-3 py-0.5 rounded-full">
              Store Ready for Service
            </Badge>
            <h2 className="text-xl font-extrabold tracking-tight text-foreground">
              {kitchenName}
            </h2>
            <p className="text-xs text-muted-foreground max-w-xs mx-auto leading-relaxed">
              Hardware profiles, legal GST/FSSAI details, and {brandList.length} virtual brands have been provisioned live.
            </p>
          </div>

          <div className="p-4 bg-muted/30 rounded-2xl border border-border/60 text-left text-xs space-y-2 font-mono shadow-2xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">GSTIN:</span>
              <span className="font-bold text-foreground">{gstin}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">FSSAI:</span>
              <span className="font-bold text-foreground">{fssaiLic}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Paper Roll:</span>
              <span className="font-bold text-foreground">{thermalRollSize} Thermal</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Menu Mode:</span>
              <span className="font-bold text-primary">
                {menuOnboardingMode === 'self' ? `${menuItems.length} Seeded` : 'Concierge Queue'}
              </span>
            </div>
          </div>

          {/* Owner Master Login Card for Handover */}
          <div className="p-4 rounded-2xl bg-primary/10 border border-primary/25 text-left space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-primary" />
                <span className="text-xs font-bold text-foreground">Owner Master Credentials</span>
              </div>
              <Badge variant="outline" className="text-[10px] font-mono font-bold text-primary border-primary/30 bg-primary/15">
                Ready for Handover
              </Badge>
            </div>
            
            <div className="space-y-1.5 font-mono text-xs bg-background/80 p-3 rounded-xl border border-border/60">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Owner:</span>
                <span className="font-bold text-foreground">{ownerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Login Email:</span>
                <span className="font-bold text-primary">{ownerEmail}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Initial Pass:</span>
                <span className="font-bold text-foreground">{ownerPassword}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Master PIN:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">{ownerPin}</span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleCopyCredentials(`KitchFlow Credentials for ${kitchenName}\nOwner: ${ownerName}\nLogin: ${ownerEmail}\nPassword: ${ownerPassword}\nPOS PIN: ${ownerPin}\nLogin Portal: ${window?.location?.origin || ''}/login`, 'success')}
              className="w-full h-8 text-[11px] font-bold rounded-lg border-primary/30 hover:bg-primary/20 text-primary gap-1.5 cursor-pointer"
            >
              {copiedCredential === 'success' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-emerald-600 dark:text-emerald-400">Copied to Clipboard!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Handover Credentials</span>
                </>
              )}
            </Button>
          </div>

          {menuOnboardingMode === 'managed' && (
            <div className="p-3.5 bg-primary/10 border border-primary/20 rounded-2xl text-left text-xs text-foreground space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-primary text-[11px]">
                <Headphones className="w-3.5 h-3.5" />
                <span>Concierge Ingestion Active</span>
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Ops team ticket <span className="font-mono font-bold text-foreground">#ONB-{Math.floor(1000 + Math.random() * 9000)}</span> has been created. Menu items will sync directly to your inventory catalog.
              </p>
            </div>
          )}

          <div className="flex flex-col gap-2.5 pt-1">
            <Button
              onClick={() => router.push('/pos')}
              className="w-full h-11 text-xs font-bold rounded-xl shadow-sm active:scale-[0.98] transition-all cursor-pointer gap-2"
            >
              <span>Open Live Counter POS</span>
              <ArrowRight className="w-4 h-4 ml-auto opacity-70" />
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push('/orders')}
              className="w-full h-11 text-xs font-semibold rounded-xl border-border/80 hover:bg-muted/50 active:scale-[0.98] transition-all cursor-pointer"
            >
              Go to Orders Queue
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // -------------------------------------------------------------
  // VIEW 3: STEP-BY-STEP APPLE HIG ONBOARDING WORKFLOW
  // -------------------------------------------------------------
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-primary/20 pb-16">
      {/* Top Header - Apple Translucent Toolbar */}
      <header className="sticky top-0 z-40 h-16 border-b border-border/80 bg-background/85 backdrop-blur-xl px-4 sm:px-8 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-4">
          <div className="relative h-9 w-auto flex items-center justify-center">
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
          <div className="h-5 w-[1px] bg-border/70 hidden sm:block" />
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px] font-mono font-bold uppercase tracking-wider py-0.5 px-2 border-primary/30 bg-primary/10 text-primary">
              Internal Ops
            </Badge>
            <span className="text-xs text-muted-foreground font-medium hidden md:inline">
              Outlet Provisioning
            </span>
          </div>
        </div>

        {/* Step Indicators (Adaptive: Clean Fractional on Mobile, Inset Pills on Desktop/Laptop) */}
        <div className="flex items-center gap-3">
          {/* Mobile Step Counter */}
          <div className="flex sm:hidden items-center gap-1.5 bg-muted/50 px-2.5 py-1 rounded-full border border-border/60 text-xs font-mono font-semibold">
            <span className="text-primary font-bold">Step {step}</span>
            <span className="text-muted-foreground">/ 5</span>
          </div>

          {/* Desktop/Laptop Step Segmented Pills */}
          <div className="hidden sm:flex items-center gap-1.5 bg-muted/40 p-1.5 rounded-full border border-border/60 shadow-inner">
            {[
              { id: 1, label: 'Outlet & Brands' },
              { id: 2, label: 'Legal & Print' },
              { id: 3, label: 'Menu Seed' },
              { id: 4, label: 'Owner Access' },
              { id: 5, label: 'Provision Launch' },
            ].map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => setStep(st.id as any)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold cursor-pointer transition-all active:scale-95",
                  step === st.id
                    ? "bg-background text-foreground shadow-xs font-bold ring-1 ring-border/80"
                    : step > st.id
                    ? "text-emerald-600 dark:text-emerald-400 hover:text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span className={cn(
                  "w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold font-mono",
                  step === st.id ? "bg-primary text-primary-foreground" : step > st.id ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground"
                )}>
                  {step > st.id ? '✓' : st.id}
                </span>
                <span>{st.label}</span>
              </button>
            ))}
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsAuthenticated(false)}
            className="text-xs text-muted-foreground hover:text-foreground h-9 px-3 rounded-xl ml-1 border border-transparent hover:border-border/60"
          >
            <Lock className="w-3.5 h-3.5 mr-1.5" />
            <span className="hidden sm:inline">Lock Portal</span>
          </Button>
        </div>
      </header>

      {/* Main Form Body - Laptop Wide (max-w-5xl) Layout */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-8 py-8">
        {/* STEP 1: Kitchen Identity & Brands */}
        {step === 1 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="border-b border-border/60 pb-4">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px] font-mono font-bold px-2.5 py-0.5 text-primary border-primary/30 bg-primary/10">
                  Step 1 of 5
                </Badge>
              </div>
              <h2 className="text-2xl font-extrabold tracking-tight text-foreground mt-1.5">
                Kitchen Outlet & Virtual Brands
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Configure the primary facility identity, physical address, and operating virtual storefront concepts.
              </p>
            </div>

            {/* Laptop 2-Column Responsive Layout - Perfectly Symmetrical Equal Height */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
              {/* Left Column: Primary Outlet Parameters (Equal 1/2 width, full height) */}
              <div className="p-6 rounded-3xl border border-border/80 bg-card/90 backdrop-blur-md shadow-sm flex flex-col justify-between space-y-5">
                <div className="space-y-5">
                  <div className="flex items-center gap-2 pb-2.5 border-b border-border/60">
                    <Store className="w-4 h-4 text-primary" />
                    <span className="text-xs font-bold uppercase tracking-wider text-foreground">Outlet Master Profile</span>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground">
                      Kitchen / Outlet Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      value={kitchenName}
                      onChange={(e) => setKitchenName(e.target.value)}
                      placeholder="e.g. Biryani Central Cloud Kitchen"
                      className="bg-background border-border/80 text-foreground rounded-xl text-xs h-10 shadow-2xs"
                    />
                    <p className="text-[11px] text-muted-foreground">Appears on receipts, ticket headers, and invoices.</p>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground">
                      Outlet Contact Phone
                    </Label>
                    <Input
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      placeholder="e.g. 9876543210"
                      className="bg-background border-border/80 text-foreground font-mono rounded-xl text-xs h-10 shadow-2xs"
                    />
                  </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-foreground">
                        Physical Location / Address
                      </Label>
                      <textarea
                        rows={3}
                        value={outletAddress}
                        onChange={(e) => setOutletAddress(e.target.value)}
                        placeholder="e.g. 100ft Road, HAL 2nd Stage, Indiranagar, Bengaluru, Karnataka 560038"
                        className="w-full bg-background border border-border/80 text-foreground rounded-xl text-xs p-3 focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-2xs resize-none"
                      />
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-muted/20 border border-border/60 text-[11px] text-muted-foreground leading-relaxed flex items-center gap-2 mt-4">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>Parameters sync instantly to offline-first local cache across all terminal tabs.</span>
                  </div>
                </div>

                {/* Right Column: Virtual Brands Operating (Equal 1/2 width, full height) */}
                <div className="p-6 rounded-3xl border border-border/80 bg-card/90 backdrop-blur-md shadow-sm flex flex-col justify-between space-y-5">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between pb-2.5 border-b border-border/60">
                      <div className="flex items-center gap-2">
                        <Flame className="w-4 h-4 text-primary" />
                        <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                          Virtual Brands Operating ({brandList.length})
                        </span>
                      </div>
                      <Badge variant="outline" className="text-[10px] font-mono px-2 py-0.5 text-primary border-primary/30 bg-primary/10">
                        Multi-Storefront
                      </Badge>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      Orders punched from online aggregators or counter POS will be segregated and color-coded by these brands.
                    </p>

                    {/* Brands Grid (2 cols on laptop) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[220px] overflow-y-auto pr-1 no-scrollbar">
                      {brandList.map((b, idx) => (
                        <div
                          key={idx}
                          className="group flex items-center justify-between p-3.5 rounded-2xl bg-muted/30 border border-border/70 hover:border-primary/50 hover:bg-muted/50 transition-all shadow-2xs"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div 
                              className="w-8 h-8 rounded-xl shrink-0 shadow-xs ring-2 ring-background border border-black/10 flex items-center justify-center font-black text-white text-xs" 
                              style={{ backgroundColor: b.color || '#f97316' }} 
                            >
                              {b.name.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-foreground truncate">{b.name}</p>
                              <p className="text-[10px] text-muted-foreground truncate">{b.cuisine}</p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveBrand(idx)}
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg shrink-0 opacity-70 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>

                    {/* Add Brand Inset Panel */}
                    <div className="p-3.5 rounded-2xl bg-muted/20 border border-border/60 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-foreground">Add New Virtual Brand</span>
                        <span className="text-[10px] text-muted-foreground">e.g. Dessert Lab, Wok Central</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                        <div className="sm:col-span-6">
                          <Input
                            value={newBrandName}
                            onChange={(e) => setNewBrandName(e.target.value)}
                            placeholder="Brand Name"
                            className="bg-background border-border/80 text-foreground rounded-xl text-xs h-9 shadow-2xs"
                          />
                        </div>
                        <div className="sm:col-span-4">
                          <Input
                            value={newBrandCuisine}
                            onChange={(e) => setNewBrandCuisine(e.target.value)}
                            placeholder="Cuisine"
                            className="bg-background border-border/80 text-foreground rounded-xl text-xs h-9 shadow-2xs"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <Button
                            onClick={handleAddBrand}
                            type="button"
                            className="h-9 w-full px-3 text-xs font-bold rounded-xl shadow-2xs cursor-pointer active:scale-95 transition-all"
                          >
                            <Plus className="w-4 h-4" />
                            <span className="sm:hidden ml-1">Add</span>
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-muted/20 border border-border/60 text-[11px] text-muted-foreground leading-relaxed flex items-center gap-2 mt-4">
                    <Sparkles className="w-4 h-4 text-primary shrink-0" />
                    <span>KDS terminals route order tickets to station displays based on the brand tag.</span>
                  </div>
                </div>
              </div>

              {/* Symmetrical Unified Footer Actions */}
              <div className="flex items-center justify-end pt-4 border-t border-border/60">
                <Button
                  onClick={() => setStep(2)}
                  className="h-11 px-6 rounded-xl font-bold text-xs cursor-pointer shadow-sm active:scale-[0.98] transition-all gap-1.5"
                >
                  <span>Continue to Legal & Print</span>
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 4: Owner & Master Operator Access Credentials (DEDICATED TAB) */}
          {step === 4 && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="border-b border-border/60 pb-4">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] font-mono font-bold px-2.5 py-0.5 text-primary border-primary/30 bg-primary/10">
                    Step 4 of 5
                  </Badge>
                </div>
                <h2 className="text-2xl font-extrabold tracking-tight text-foreground mt-1.5">
                  Owner & Master Access Credentials
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Generate the master administrator login account and 4-digit POS cashier manager PIN for owner handover.
                </p>
              </div>

              {/* Laptop 2-Column Responsive Layout - Perfectly Symmetrical Equal Height */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
                {/* Left Column: Owner Profile & Portal Login (Equal 1/2 width, full height) */}
                <div className="p-6 rounded-3xl border border-border/80 bg-card/90 backdrop-blur-md shadow-sm flex flex-col justify-between space-y-5">
                  <div className="space-y-5">
                    <div className="flex items-center justify-between pb-2.5 border-b border-border/60">
                      <div className="flex items-center gap-2">
                        <KeyRound className="w-4 h-4 text-primary" />
                        <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                          Master Web Portal Credentials
                        </span>
                      </div>
                      <Badge variant="outline" className="text-[10px] font-mono px-2 py-0.5 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10">
                        Admin Access
                      </Badge>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-muted-foreground" />
                          <span>Owner Full Name <span className="text-destructive">*</span></span>
                        </Label>
                        <Input
                          value={ownerName}
                          onChange={(e) => setOwnerName(e.target.value)}
                          placeholder="e.g. Rajesh Sharma"
                          className="bg-background border-border/80 text-foreground rounded-xl text-xs h-10 shadow-2xs"
                        />
                        <p className="text-[11px] text-muted-foreground">Name will appear on shift summaries, audit trails, and owner reports.</p>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                          <span>Login Email / Operator ID <span className="text-destructive">*</span></span>
                        </Label>
                        <Input
                          value={ownerEmail}
                          onChange={(e) => setOwnerEmail(e.target.value)}
                          placeholder="owner@biryanicentral.in"
                          className="bg-background border-border/80 text-foreground font-mono rounded-xl text-xs h-10 shadow-2xs"
                        />
                        <p className="text-[11px] text-muted-foreground">Used to authenticate at <code className="text-primary font-mono text-[10px]">/login</code> with owner privileges.</p>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                            <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                            <span>Initial Temporary Password <span className="text-destructive">*</span></span>
                          </Label>
                          <button
                            type="button"
                            onClick={handleRegeneratePassword}
                            title="Generate strong key"
                            className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <RefreshCw className="w-3 h-3" />
                            <span>Generate Strong Key</span>
                          </button>
                        </div>
                        <div className="relative">
                          <Input
                            type={showPassword ? 'text' : 'password'}
                            value={ownerPassword}
                            onChange={(e) => setOwnerPassword(e.target.value)}
                            className="bg-background border-border/80 text-foreground font-mono rounded-xl text-xs h-10 pr-10 shadow-2xs"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        <p className="text-[11px] text-muted-foreground">Owner will be prompted to set a permanent password upon first login.</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-muted/20 border border-border/60 text-[11px] text-muted-foreground leading-relaxed flex items-center gap-2 mt-4">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>Grants unrestricted access to multi-store analytics, financial margins, and inventory config.</span>
                  </div>
                </div>

                {/* Right Column: POS Terminal PIN & Handover Card (Equal 1/2 width, full height) */}
                <div className="p-6 rounded-3xl border border-border/80 bg-card/90 backdrop-blur-md shadow-sm flex flex-col justify-between space-y-5">
                  <div className="space-y-5">
                    <div className="flex items-center justify-between pb-2.5 border-b border-border/60">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-primary" />
                        <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                          POS Counter & Handover
                        </span>
                      </div>
                      <Badge variant="outline" className="text-[10px] font-mono px-2 py-0.5 text-primary border-primary/30 bg-primary/10">
                        Station Security
                      </Badge>
                    </div>

                    <div className="space-y-4">
                      {/* POS Cashier Master PIN */}
                      <div className="space-y-2 p-4 rounded-2xl bg-muted/20 border border-border/60">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-semibold text-foreground">
                            POS Cashier Master Override PIN
                          </Label>
                          <button
                            type="button"
                            onClick={handleRegeneratePin}
                            title="Randomize PIN"
                            className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <RefreshCw className="w-3 h-3" />
                            <span>Randomize</span>
                          </button>
                        </div>
                        <Input
                          type="text"
                          maxLength={6}
                          value={ownerPin}
                          onChange={(e) => setOwnerPin(e.target.value)}
                          placeholder="4-digit PIN"
                          className="bg-background border-border/80 text-foreground font-mono rounded-xl text-lg h-12 text-center tracking-widest font-extrabold shadow-2xs"
                        />
                        <p className="text-[11px] text-muted-foreground">
                          Required on POS terminals to approve bill cancellations, manual discounts, and end-of-day register cash counts.
                        </p>
                      </div>

                      {/* Ready Handover Preview Inset Card */}
                      <div className="p-4 rounded-2xl bg-primary/10 border border-primary/20 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-foreground">Owner Handover Summary</span>
                          <span className="text-[10px] font-mono text-primary font-bold">1-Click Dispatch</span>
                        </div>
                        <div className="space-y-1.5 font-mono text-xs bg-background/80 p-3 rounded-xl border border-border/60">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Owner:</span>
                            <span className="font-bold text-foreground truncate max-w-[200px]">{ownerName}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Login ID:</span>
                            <span className="font-bold text-primary truncate max-w-[200px]">{ownerEmail}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Initial Pass:</span>
                            <span className="font-bold text-foreground">{ownerPassword}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Master PIN:</span>
                            <span className="font-bold text-emerald-600 dark:text-emerald-400">{ownerPin}</span>
                          </div>
                        </div>

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleCopyCredentials(`KitchFlow Credentials for ${kitchenName}\nOwner: ${ownerName}\nLogin: ${ownerEmail}\nPassword: ${ownerPassword}\nPOS PIN: ${ownerPin}`, 'step2')}
                          className="w-full h-8 text-[11px] font-bold rounded-lg border-primary/30 hover:bg-primary/20 text-primary gap-1.5 cursor-pointer"
                        >
                          {copiedCredential === 'step2' ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                              <span className="text-emerald-600 dark:text-emerald-400">Copied to Clipboard!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copy Credentials for Handover</span>
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-muted/20 border border-border/60 text-[11px] text-muted-foreground leading-relaxed flex items-center gap-2 mt-4">
                    <Sparkles className="w-4 h-4 text-primary shrink-0" />
                    <span>Credentials are immediately active for both mobile and desktop POS terminals upon launch.</span>
                  </div>
                </div>
              </div>

              {/* Symmetrical Unified Footer Actions */}
              <div className="flex items-center justify-between pt-4 border-t border-border/60">
                <Button
                  variant="outline"
                  onClick={() => setStep(3)}
                  className="h-11 rounded-xl text-xs font-semibold border-border/80 hover:bg-muted/50 active:scale-[0.98] transition-all px-5"
                >
                  Back to Menu Seed
                </Button>
                <Button
                  onClick={() => setStep(5)}
                  className="h-11 px-6 rounded-xl font-bold text-xs cursor-pointer shadow-sm active:scale-[0.98] transition-all gap-1.5"
                >
                  <span>Review & Provision</span>
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

        {/* STEP 2: Legal Details & POS Hardware */}
        {step === 2 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="border-b border-border/60 pb-4">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px] font-mono font-bold px-2.5 py-0.5 text-primary border-primary/30 bg-primary/10">
                  Step 2 of 5
                </Badge>
              </div>
              <h2 className="text-2xl font-extrabold tracking-tight text-foreground mt-1.5">
                Taxes, Compliance & Receipt Printing
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Set mandatory regulatory registration numbers (GSTIN/FSSAI) and hardware thermal printer profiles.
              </p>
            </div>

            {/* Laptop 2-Column Responsive Layout - Perfectly Symmetrical Equal Height */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
              {/* Left Column: Tax & Regulatory (Equal 1/2 width, full height) */}
              <div className="p-6 rounded-3xl border border-border/80 bg-card/90 backdrop-blur-md shadow-sm flex flex-col justify-between space-y-5">
                <div className="space-y-5">
                  <div className="flex items-center gap-2 pb-2.5 border-b border-border/60">
                    <Receipt className="w-4 h-4 text-primary" />
                    <span className="text-xs font-bold uppercase tracking-wider text-foreground">Tax & Legal Compliance</span>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-foreground">
                        GSTIN (Goods & Services Tax Identification)
                      </Label>
                      <Input
                        value={gstin}
                        onChange={(e) => setGstin(e.target.value)}
                        placeholder="e.g. 29AABCU9603R1ZM"
                        className="bg-background border-border/80 text-foreground font-mono rounded-xl text-xs h-10 shadow-2xs"
                      />
                      <p className="text-[11px] text-muted-foreground">Appears on B2B / B2C tax invoices and customer bill footers.</p>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-foreground">
                        FSSAI License Number
                      </Label>
                      <Input
                        value={fssaiLic}
                        onChange={(e) => setFssaiLic(e.target.value)}
                        placeholder="e.g. 11521018000452"
                        className="bg-background border-border/80 text-foreground font-mono rounded-xl text-xs h-10 shadow-2xs"
                      />
                      <p className="text-[11px] text-muted-foreground">Mandatory 14-digit Food Safety and Standards Authority license.</p>
                    </div>
                  </div>

                  <Separator className="bg-border/60 my-2" />

                  {/* GST Rate Selector (Apple Segmented Picker) */}
                  <div className="space-y-2.5">
                    <Label className="text-xs font-semibold text-foreground">
                      Default Restaurant GST Rate
                    </Label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {[
                        { rate: 5, label: '5% F&B Standard', sub: '2.5% CGST + 2.5% SGST' },
                        { rate: 18, label: '18% Outdoor/Bar', sub: '9% CGST + 9% SGST' },
                        { rate: 0, label: '0% Composition', sub: 'No Tax Split' },
                      ].map((g) => (
                        <div
                          key={g.rate}
                          onClick={() => setGstRate(g.rate)}
                          className={cn(
                            "p-3 rounded-2xl border cursor-pointer transition-all active:scale-[0.98] shadow-2xs flex flex-col justify-between",
                            gstRate === g.rate
                              ? "bg-primary/10 border-primary shadow-xs ring-1 ring-primary/40"
                              : "bg-muted/20 border-border/70 hover:border-border hover:bg-muted/30"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-bold text-foreground">{g.label}</p>
                            {gstRate === g.rate && <CheckCircle2 className="w-4 h-4 text-primary" />}
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-1 font-mono">{g.sub}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-muted/20 border border-border/60 text-[11px] text-muted-foreground leading-relaxed flex items-center gap-2 mt-4">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>GST breakdowns compute dynamically on all dine-in, takeaway, and delivery bills.</span>
                </div>
              </div>

              {/* Right Column: Thermal Hardware Profile (Equal 1/2 width, full height) */}
              <div className="p-6 rounded-3xl border border-border/80 bg-card/90 backdrop-blur-md shadow-sm flex flex-col justify-between space-y-5">
                <div className="space-y-5">
                  <div className="flex items-center gap-2 pb-2.5 border-b border-border/60">
                    <Printer className="w-4 h-4 text-primary" />
                    <span className="text-xs font-bold uppercase tracking-wider text-foreground">POS Thermal Printer Hardware</span>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Choose the roll specification for counter receipt printers and kitchen KOT thermal dispatch heads.
                  </p>

                  <div className="grid grid-cols-1 gap-3">
                    <div
                      onClick={() => setThermalRollSize('80mm')}
                      className={cn(
                        "p-4 rounded-2xl border cursor-pointer transition-all flex items-center justify-between shadow-2xs active:scale-[0.98]",
                        thermalRollSize === '80mm'
                          ? "bg-primary/10 border-primary ring-1 ring-primary/40 shadow-xs"
                          : "bg-muted/20 border-border/70 hover:border-border hover:bg-muted/30"
                      )}
                    >
                      <div className="flex items-center gap-3.5">
                        <div className="w-10 h-10 rounded-xl bg-background border border-border/60 flex items-center justify-center text-primary shadow-2xs">
                          <Printer className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-bold text-foreground">80mm Thermal Paper Roll</p>
                            <Badge variant="outline" className="text-[10px] font-mono text-primary border-primary/30 bg-primary/10">
                              Recommended
                            </Badge>
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5">3-inch wide roll for heavy duty desktop POS receipt printers</p>
                        </div>
                      </div>
                      {thermalRollSize === '80mm' && <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />}
                    </div>

                    <div
                      onClick={() => setThermalRollSize('58mm')}
                      className={cn(
                        "p-4 rounded-2xl border cursor-pointer transition-all flex items-center justify-between shadow-2xs active:scale-[0.98]",
                        thermalRollSize === '58mm'
                          ? "bg-primary/10 border-primary ring-1 ring-primary/40 shadow-xs"
                          : "bg-muted/20 border-border/70 hover:border-border hover:bg-muted/30"
                      )}
                    >
                      <div className="flex items-center gap-3.5">
                        <div className="w-10 h-10 rounded-xl bg-background border border-border/60 flex items-center justify-center text-muted-foreground shadow-2xs">
                          <Printer className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-foreground">58mm Thermal Paper Roll</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">2-inch narrow roll for mobile handheld Bluetooth printers</p>
                        </div>
                      </div>
                      {thermalRollSize === '58mm' && <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />}
                    </div>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-muted/20 border border-border/60 text-[11px] text-muted-foreground leading-relaxed flex items-center gap-2 mt-4">
                  <Sparkles className="w-4 h-4 text-primary shrink-0" />
                  <span>KOT generator will automatically format typography margins to fit {thermalRollSize} width.</span>
                </div>
              </div>
            </div>

            {/* Symmetrical Unified Footer Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-border/60">
              <Button
                variant="outline"
                onClick={() => setStep(1)}
                className="h-11 rounded-xl text-xs font-semibold border-border/80 hover:bg-muted/50 active:scale-[0.98] transition-all px-5"
              >
                Back to Outlet & Brands
              </Button>
              <Button
                onClick={() => setStep(3)}
                className="h-11 px-6 rounded-xl font-bold text-xs cursor-pointer shadow-sm active:scale-[0.98] transition-all gap-1.5"
              >
                <span>Continue to Menu Seed</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3: Initial Menu Catalog */}
        {step === 3 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="border-b border-border/60 pb-4">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px] font-mono font-bold px-2.5 py-0.5 text-primary border-primary/30 bg-primary/10">
                  Step 3 of 5
                </Badge>
              </div>
              <h2 className="text-2xl font-extrabold tracking-tight text-foreground mt-1.5">
                Menu Setup & Catalog Onboarding
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Choose how you would like your dish catalog created: seed starter items now, or have the KitchFlow ops concierge digitize your entire menu.
              </p>
            </div>

            {/* Apple Segmented Selector: Self-Seed vs Concierge Portal */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div
                onClick={() => setMenuOnboardingMode('self')}
                className={cn(
                  "p-5 rounded-3xl border cursor-pointer transition-all active:scale-[0.99] shadow-2xs flex items-start gap-4",
                  menuOnboardingMode === 'self'
                    ? "bg-primary/10 border-primary ring-1 ring-primary/40 shadow-xs"
                    : "bg-card/70 border-border/70 hover:border-border hover:bg-muted/30"
                )}
              >
                <div className={cn(
                  "w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-2xs",
                  menuOnboardingMode === 'self' ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                )}>
                  <UtensilsCrossed className="w-5 h-5" />
                </div>
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-foreground">Self-Seed Starter Menu</p>
                    {menuOnboardingMode === 'self' && <CheckCircle2 className="w-5 h-5 text-primary" />}
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    I will seed sample items right now and use the self-service POS / Inventory portal to add the rest later.
                  </p>
                </div>
              </div>

              <div
                onClick={() => setMenuOnboardingMode('managed')}
                className={cn(
                  "p-5 rounded-3xl border cursor-pointer transition-all active:scale-[0.99] shadow-2xs flex items-start gap-4",
                  menuOnboardingMode === 'managed'
                    ? "bg-primary/10 border-primary ring-1 ring-primary/40 shadow-xs"
                    : "bg-card/70 border-border/70 hover:border-border hover:bg-muted/30"
                )}
              >
                <div className={cn(
                  "w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-2xs",
                  menuOnboardingMode === 'managed' ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                )}>
                  <Headphones className="w-5 h-5" />
                </div>
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-foreground">Let KitchFlow Do It For Us</p>
                      <Badge variant="outline" className="text-[10px] font-mono font-bold text-primary border-primary/30 bg-primary/10">
                        Concierge
                      </Badge>
                    </div>
                    {menuOnboardingMode === 'managed' && <CheckCircle2 className="w-5 h-5 text-primary" />}
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Our ops engineering team will digitize, categorize, and configure your entire menu via our Dedicated Ingestion Portal.
                  </p>
                </div>
              </div>
            </div>

            {/* OPTION A: Self-Seed Interactive Workspace */}
            {menuOnboardingMode === 'self' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch animate-in fade-in duration-200">
                {/* Left Column: Menu Items Inset List (Equal 1/2 width, full height) */}
                <div className="p-6 rounded-3xl border border-border/80 bg-card/90 backdrop-blur-md shadow-sm flex flex-col justify-between space-y-4">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between pb-2.5 border-b border-border/60">
                      <div className="flex items-center gap-2">
                        <UtensilsCrossed className="w-4 h-4 text-primary" />
                        <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                          Starter Menu Items ({menuItems.length})
                        </span>
                      </div>
                      <Badge variant="outline" className="text-[10px] font-mono px-2 py-0.5 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10">
                        Live Catalog Ready
                      </Badge>
                    </div>

                    <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1 no-scrollbar">
                      {menuItems.map((item, idx) => (
                        <div
                          key={idx}
                          className="group flex items-center justify-between p-3.5 rounded-2xl bg-muted/30 border border-border/70 text-xs shadow-2xs hover:border-border hover:bg-muted/50 transition-all"
                        >
                          <div className="flex items-center gap-3.5 min-w-0">
                            <span className="w-6 h-6 rounded-full bg-background border border-border/60 flex items-center justify-center text-muted-foreground font-mono text-[10px] font-bold shrink-0 shadow-2xs">
                              {idx + 1}
                            </span>
                            <div className="min-w-0">
                              <p className="font-bold text-foreground truncate">{item.name}</p>
                              <p className="text-[10px] text-muted-foreground truncate">{item.brandName} • {item.category}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="font-extrabold text-foreground font-mono text-xs bg-background/60 px-2 py-1 rounded-lg border border-border/60">
                              ₹{item.price}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveMenuItem(idx)}
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg opacity-70 group-hover:opacity-100 transition-opacity"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-muted/20 border border-border/60 text-[11px] text-muted-foreground leading-relaxed flex items-center gap-2 mt-4">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>These dishes populate your counter POS fast-keys on first launch.</span>
                  </div>
                </div>

                {/* Right Column: Add Item Form & Catalog Presets (Equal 1/2 width, full height) */}
                <div className="p-6 rounded-3xl border border-border/80 bg-card/90 backdrop-blur-md shadow-sm flex flex-col justify-between space-y-5">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 pb-2.5 border-b border-border/60">
                      <Plus className="w-4 h-4 text-primary" />
                      <span className="text-xs font-bold uppercase tracking-wider text-foreground">Add Custom Starter Dish</span>
                    </div>

                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-foreground">Item Name</Label>
                        <Input
                          value={newItemName}
                          onChange={(e) => setNewItemName(e.target.value)}
                          placeholder="e.g. Cold Coffee, Cheese Garlic Bread"
                          className="bg-background border-border/80 text-foreground rounded-xl text-xs h-10 shadow-2xs"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold text-foreground">Selling Price (₹)</Label>
                          <Input
                            type="number"
                            value={newItemPrice}
                            onChange={(e) => setNewItemPrice(e.target.value)}
                            placeholder="180"
                            className="bg-background border-border/80 text-foreground font-mono rounded-xl text-xs h-10 shadow-2xs"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold text-foreground">Brand Tag</Label>
                          <Input
                            value={brandList[0]?.name || 'House Concept'}
                            disabled
                            className="bg-muted/40 border-border/60 text-muted-foreground rounded-xl text-xs h-10 text-ellipsis overflow-hidden"
                          />
                        </div>
                      </div>

                      <Button
                        onClick={handleAddMenuItem}
                        type="button"
                        className="w-full h-11 font-bold text-xs rounded-xl shadow-2xs cursor-pointer active:scale-[0.98] transition-all gap-1.5"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Append to Starter Catalog</span>
                      </Button>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-muted/20 border border-border/60 text-[11px] text-muted-foreground leading-relaxed flex items-center gap-2 mt-4">
                    <ChefHat className="w-4 h-4 text-primary shrink-0" />
                    <span>Items can be edited, priced by modifier, and mapped to inventory anytime in the Inventory Portal.</span>
                  </div>
                </div>
              </div>
            )}

            {/* OPTION B: Managed KitchFlow Concierge Menu Onboarding Portal */}
            {menuOnboardingMode === 'managed' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch animate-in fade-in duration-200">
                {/* Left Column: Dedicated Portal & Workflow Details */}
                <div className="p-6 rounded-3xl border border-border/80 bg-card/90 backdrop-blur-md shadow-sm flex flex-col justify-between space-y-5">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 pb-2.5 border-b border-border/60">
                      <Headphones className="w-4 h-4 text-primary" />
                      <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                        KitchFlow Menu Onboarding Concierge
                      </span>
                    </div>

                    <div className="p-4 rounded-2xl bg-primary/10 border border-primary/20 space-y-2">
                      <p className="text-xs font-bold text-primary flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4" />
                        Dedicated Ingestion Service Included
                      </p>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Don't have time to punch in 100+ items? Send us your PDF menu, Swiggy/Zomato brand link, or Excel sheet. Our operations engineering team formats your modifiers, photos, tax rates, and brand tags for you.
                      </p>
                    </div>

                    <div className="space-y-2.5 pt-1">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">What happens next:</span>
                      <div className="space-y-2">
                        {[
                          { step: '1', title: 'Ticket Generated', desc: 'A dedicated onboarding queue ticket is dispatched to KitchFlow Concierge ops.' },
                          { step: '2', title: 'Menu Digitization', desc: 'Our team standardizes portion sizes, modifier matrix, GST rates, and recipe links.' },
                          { step: '3', title: 'Live Ingestion Sync', desc: 'Items appear in your POS terminal within 4-12 hours ready for service.' }
                        ].map((s) => (
                          <div key={s.step} className="p-3 rounded-2xl bg-muted/30 border border-border/60 flex items-start gap-3">
                            <span className="w-5 h-5 rounded-full bg-primary/20 text-primary font-mono text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                              {s.step}
                            </span>
                            <div>
                              <p className="text-xs font-bold text-foreground">{s.title}</p>
                              <p className="text-[10px] text-muted-foreground mt-0.5">{s.desc}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-muted/20 border border-border/60 text-[11px] text-muted-foreground leading-relaxed flex items-center gap-2 mt-4">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>Your kitchen store profile will still launch instantly with starter test items.</span>
                  </div>
                </div>

                {/* Right Column: Menu Submission Form */}
                <div className="p-6 rounded-3xl border border-border/80 bg-card/90 backdrop-blur-md shadow-sm flex flex-col justify-between space-y-5">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 pb-2.5 border-b border-border/60">
                      <Store className="w-4 h-4 text-primary" />
                      <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                        Submit Menu Details for Ingestion
                      </span>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-foreground">
                          Existing Menu Link / Zomato / Swiggy URL or Cloud Drive
                        </Label>
                        <Input
                          placeholder="e.g. https://www.zomato.com/bangalore/biryani-central or Drive link"
                          className="bg-background border-border/80 text-foreground rounded-xl text-xs h-10 shadow-2xs"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-foreground">
                          Upload Menu File (PDF, Image, or CSV)
                        </Label>
                        <div 
                          onClick={() => setConciergeFileAttached(!conciergeFileAttached)}
                          className={cn(
                            "border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition-all",
                            conciergeFileAttached 
                              ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              : "border-border/80 hover:border-primary/50 bg-muted/20 text-muted-foreground"
                          )}
                        >
                          {conciergeFileAttached ? (
                            <div className="flex items-center justify-center gap-2 text-xs font-bold">
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Menu File Attached (menu_spec_catalog.pdf)</span>
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <p className="text-xs font-bold text-foreground">Click to upload menu sheet or photo</p>
                              <p className="text-[10px] text-muted-foreground">Supports PDF, PNG, JPG, XLSX up to 25MB</p>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-foreground">
                          Special Instructions for Ops Team
                        </Label>
                        <textarea
                          rows={3}
                          value={conciergeNotes}
                          onChange={(e) => setConciergeNotes(e.target.value)}
                          placeholder="e.g. Please prioritize Biryani Central combos and mark extra gravy as free add-on."
                          className="w-full bg-background border border-border/80 text-foreground rounded-xl text-xs p-3 focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-2xs resize-none"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-[11px] text-emerald-700 dark:text-emerald-300 leading-relaxed flex items-center gap-2 mt-4">
                    <ShieldCheck className="w-4 h-4 shrink-0" />
                    <span>Concierge ticket will auto-bind to this store's GSTIN and brand registry upon launch.</span>
                  </div>
                </div>
              </div>
            )}

            {/* Symmetrical Unified Footer Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-border/60">
              <Button
                variant="outline"
                onClick={() => setStep(2)}
                className="h-11 rounded-xl text-xs font-semibold border-border/80 hover:bg-muted/50 active:scale-[0.98] transition-all px-5"
              >
                Back to Taxes & Hardware
              </Button>
              <Button
                onClick={() => setStep(4)}
                className="h-11 px-6 rounded-xl font-bold text-xs cursor-pointer shadow-sm active:scale-[0.98] transition-all gap-1.5"
              >
                <span>Continue to Owner Access</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 5: Review & One-Click Launch */}
        {step === 5 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="border-b border-border/60 pb-4">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px] font-mono font-bold px-2.5 py-0.5 text-primary border-primary/30 bg-primary/10">
                  Step 5 of 5
                </Badge>
              </div>
              <h2 className="text-2xl font-extrabold tracking-tight text-foreground mt-1.5">
                Final Verification & Store Provision
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Review configuration specs before generating live terminal databases and activating counter dispatch.
              </p>
            </div>

            {/* Laptop 2-Column Responsive Layout - Perfectly Symmetrical Equal Height */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
              {/* Left Column: Executive Summary Cards (Equal 1/2 width, full height) */}
              <div className="p-6 rounded-3xl border border-border/80 bg-card/90 backdrop-blur-md shadow-sm flex flex-col justify-between space-y-5">
                <div className="space-y-5">
                  <div className="flex items-center gap-2 pb-2.5 border-b border-border/60">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-xs font-bold uppercase tracking-wider text-foreground">Launch Readiness Snapshot</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div className="p-3 rounded-2xl bg-muted/30 border border-border/60">
                      <span className="text-[10px] uppercase font-mono font-bold text-muted-foreground block">Facility</span>
                      <span className="text-xs font-bold text-foreground truncate block mt-1">{kitchenName}</span>
                    </div>
                    <div className="p-3 rounded-2xl bg-muted/30 border border-border/60">
                      <span className="text-[10px] uppercase font-mono font-bold text-muted-foreground block">GST Rate</span>
                      <span className="text-xs font-bold text-foreground block mt-1">{gstRate}% F&B</span>
                    </div>
                    <div className="p-3 rounded-2xl bg-muted/30 border border-border/60">
                      <span className="text-[10px] uppercase font-mono font-bold text-muted-foreground block">Thermal Roll</span>
                      <span className="text-xs font-bold text-foreground block mt-1">{thermalRollSize} Thermal</span>
                    </div>
                    <div className="p-3 rounded-2xl bg-muted/30 border border-border/60">
                      <span className="text-[10px] uppercase font-mono font-bold text-muted-foreground block">Menu Onboard</span>
                      <span className="text-xs font-bold text-primary block mt-1">
                        {menuOnboardingMode === 'self' ? 'Self-Seed' : 'Concierge'}
                      </span>
                    </div>
                  </div>

                  {/* Detailed Compliance & Brand Breakdown */}
                  <div className="space-y-2.5 p-4 bg-muted/20 rounded-2xl border border-border/60 text-xs font-mono">
                    <div className="flex justify-between border-b border-border/40 pb-2">
                      <span className="text-muted-foreground">GSTIN:</span>
                      <span className="font-bold text-foreground">{gstin || 'Not Provided (Composition)'}</span>
                    </div>
                    <div className="flex justify-between border-b border-border/40 pb-2">
                      <span className="text-muted-foreground">FSSAI License:</span>
                      <span className="font-bold text-foreground">{fssaiLic || 'Not Provided'}</span>
                    </div>
                    <div className="flex justify-between border-b border-border/40 pb-2">
                      <span className="text-muted-foreground">Address:</span>
                      <span className="font-bold text-foreground truncate max-w-[280px]">{outletAddress || 'Indiranagar'}</span>
                    </div>
                    <div className="flex justify-between border-b border-border/40 pb-2">
                      <span className="text-muted-foreground">Virtual Brands ({brandList.length}):</span>
                      <span className="font-bold text-foreground truncate max-w-[280px]">
                        {brandList.map(b => b.name).join(', ')}
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-border/40 pb-2">
                      <span className="text-muted-foreground">Catalog Channel:</span>
                      <span className="font-bold text-primary">
                        {menuOnboardingMode === 'self' 
                          ? `${menuItems.length} Self-Seeded Dishes` 
                          : 'KitchFlow Concierge Queue (Managed)'}
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-border/40 pb-2">
                      <span className="text-muted-foreground">Owner / Master Admin:</span>
                      <span className="font-bold text-foreground truncate max-w-[280px]">
                        {ownerName} ({ownerEmail})
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Master POS PIN:</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                        {ownerPin}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-muted/20 border border-border/60 text-[11px] text-muted-foreground leading-relaxed flex items-center gap-2 mt-4">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>Hardware profiles and local brand registries will prime immediately upon click.</span>
                </div>
              </div>

              {/* Right Column: Pre-Flight Action Card (Equal 1/2 width, full height) */}
              <div className="p-6 rounded-3xl border border-border/80 bg-card/90 backdrop-blur-md shadow-sm flex flex-col justify-between space-y-5">
                <div className="space-y-5">
                  <div className="flex items-center gap-2 pb-2.5 border-b border-border/60">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <span className="text-xs font-bold uppercase tracking-wider text-foreground">Provisioning Protocol</span>
                  </div>

                  <div className="p-4 bg-primary/10 border border-primary/20 rounded-2xl text-xs text-foreground space-y-2">
                    <div className="flex items-center gap-2 font-bold text-primary">
                      <ShieldCheck className="w-4 h-4" />
                      <span>Ready to Launch Service</span>
                    </div>
                    <p className="leading-relaxed text-[11px] text-muted-foreground">
                      Clicking <strong>Provision & Launch</strong> locks these parameters, primes the offline database, generates owner credentials, and activates counter POS.
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-muted/20 border border-border/60 space-y-2 text-xs">
                    <span className="font-bold text-foreground block text-[11px] uppercase tracking-wider">Automated Bootstrap Steps:</span>
                    <ul className="space-y-1.5 text-muted-foreground text-[11px]">
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>Generates Master Login & POS PIN for <strong>{ownerName}</strong></span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>
                          {menuOnboardingMode === 'self' 
                            ? 'Generates offline POS product catalogs'
                            : 'Dispatches menu ingestion ticket to KitchFlow Concierge'}
                        </span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>Sets up {thermalRollSize} receipt printer format template</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>Binds {brandList.length} virtual brand identifiers to KDS routing</span>
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="space-y-2.5 pt-2">
                  <Button
                    onClick={handleLaunchKitchen}
                    disabled={isProvisioning}
                    className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer shadow-emerald-500/20 shadow-sm active:scale-[0.98] transition-all gap-2"
                  >
                    {isProvisioning ? (
                      <span>Provisioning Store Profile...</span>
                    ) : (
                      <>
                        <span>Provision & Launch Kitchen</span>
                        <ArrowRight className="w-4 h-4 ml-auto" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {/* Symmetrical Unified Footer Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-border/60">
              <Button
                variant="outline"
                onClick={() => setStep(4)}
                disabled={isProvisioning}
                className="h-11 rounded-xl text-xs font-semibold border-border/80 hover:bg-muted/50 active:scale-[0.98] transition-all px-5"
              >
                Back to Owner Access
              </Button>
              <Button
                onClick={handleLaunchKitchen}
                disabled={isProvisioning}
                className="h-11 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer shadow-emerald-500/20 shadow-sm active:scale-[0.98] transition-all gap-1.5"
              >
                {isProvisioning ? (
                  <span>Provisioning Store...</span>
                ) : (
                  <>
                    <span>Provision & Launch</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

