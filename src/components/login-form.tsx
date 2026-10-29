"use client"

import React, { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Image from "next/image"
import { cn } from "@/lib/utils"
import { loginWithSupabase, loginWithPinAction } from "@/actions/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { 
  Lock, 
  Mail, 
  KeyRound, 
  ShieldCheck, 
  ArrowRight, 
  Eye, 
  EyeOff, 
  Store, 
  Sparkles, 
  CheckCircle2, 
  HelpCircle,
  Smartphone,
  ChefHat
} from "lucide-react"

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const router = useRouter()

  // Mode: 'credentials' (Email & Password) vs 'pin' (Quick POS / Cashier PIN)
  const [authMode, setAuthMode] = useState<"credentials" | "pin">("credentials")
  
  // Form State
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [pin, setPin] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Provisioned store state from /admin/onboard
  const [provisionedConfig, setProvisionedConfig] = useState<{
    name?: string
    ownerCredentials?: {
      name?: string
      email?: string
      password?: string
      pin?: string
    }
  } | null>(null)

  useEffect(() => {
    try {
      const stored = localStorage.getItem("kitchflow_outlet_config")
      if (stored) {
        const parsed = JSON.parse(stored)
        setProvisionedConfig(parsed)
        if (parsed?.ownerCredentials?.email) {
          setEmail(parsed.ownerCredentials.email)
        }
        if (parsed?.ownerCredentials?.password) {
          setPassword(parsed.ownerCredentials.password)
        }
        if (parsed?.ownerCredentials?.pin) {
          setPin(parsed.ownerCredentials.pin)
        }
      }
    } catch (e) {
      console.error("Error reading provisioned store config", e)
    }
  }, [])

  const searchParams = useSearchParams()
  const redirectTo = searchParams?.get("redirectTo") || "/orders"

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)
    setIsLoading(true)

    try {
      if (authMode === "pin") {
        const pinRes = await loginWithPinAction(pin);
        if (pinRes.success) {
          // If credentials exist in config and user is verified owner, authenticate Supabase session
          if (pinRes.role === 'owner' && provisionedConfig?.ownerCredentials?.email && provisionedConfig?.ownerCredentials?.password) {
            const formData = new FormData()
            formData.set("email", provisionedConfig.ownerCredentials.email)
            formData.set("password", provisionedConfig.ownerCredentials.password)
            formData.set("redirectTo", pinRes.redirectTo || "/pos")
            const res = await loginWithSupabase(formData)
            if (res?.error) {
              console.warn("Supabase PIN session fallback:", res.error)
            }
          }
          try {
            if (pinRes.staffName) {
              localStorage.setItem('kitchflow_active_staff_name', pinRes.staffName)
            }
            if (pinRes.role) {
              localStorage.setItem('kitchflow_active_staff_role', pinRes.role)
            }
            if (pinRes.permissions) {
              localStorage.setItem('kitchflow_active_staff_permissions', JSON.stringify(pinRes.permissions))
            }
          } catch (e) {}

          // Perform hard navigation to ensure session cookies are sent cleanly to middleware
          window.location.href = pinRes.redirectTo || "/pos"
          return
        } else {
          setErrorMsg(pinRes.error || "Invalid POS Terminal PIN. Please enter the master PIN provisioned for this store.")
          setIsLoading(false)
          return
        }
      }

      const formData = new FormData()
      formData.set("email", email)
      formData.set("password", password)
      formData.set("redirectTo", redirectTo)

      const res = await loginWithSupabase(formData)
      if (res?.error) {
        setErrorMsg(res.error)
        setIsLoading(false)
        return
      }

      router.push(res?.redirectTo || redirectTo)
      router.refresh()
    } catch (err: any) {
      if (err?.message !== "NEXT_REDIRECT") {
        setErrorMsg(err?.message || "Authentication failed")
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <div className="overflow-hidden rounded-3xl border border-border/80 bg-card/95 backdrop-blur-2xl shadow-2xl grid md:grid-cols-2">
        {/* Left Column: Interactive Login Form */}
        <div className="p-5 sm:p-8 md:p-10 flex flex-col justify-between space-y-5 sm:space-y-6">
          <div className="space-y-5 sm:space-y-6">
            {/* Logo & Header */}
            <div className="text-center md:text-left space-y-2">
              <div className="relative h-9 sm:h-10 w-auto flex items-center justify-center md:justify-start mb-2">
                <Image 
                  src="/logo.png?v=2" 
                  alt="KitchFlow" 
                  width={170} 
                  height={42} 
                  className="h-8 sm:h-9 w-auto object-contain"
                  priority
                  unoptimized
                />
              </div>

              {provisionedConfig?.name ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400 text-[10px] font-mono font-bold tracking-tight max-w-full">
                  <Store className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{provisionedConfig.name}</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/10 border border-primary/25 text-primary text-[10px] font-mono font-bold uppercase tracking-wider">
                  <span>Cloud Kitchen Operating System</span>
                </div>
              )}

              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground">
                Welcome back
              </h1>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Sign in to manage kitchen display stations, aggregators, and live POS counters.
              </p>
            </div>

            {/* Apple Segmented Tab Switcher (Credentials vs Cashier PIN) */}
            <div className="grid grid-cols-2 p-1 rounded-2xl bg-muted/40 border border-border/60 shadow-inner">
              <button
                type="button"
                onClick={() => {
                  setAuthMode("credentials")
                  setErrorMsg(null)
                }}
                className={cn(
                  "flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-semibold cursor-pointer transition-all active:scale-[0.98]",
                  authMode === "credentials"
                    ? "bg-background text-foreground shadow-xs font-bold ring-1 ring-border/80"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <KeyRound className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Owner & Admin</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setAuthMode("pin")
                  setErrorMsg(null)
                }}
                className={cn(
                  "flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-semibold cursor-pointer transition-all active:scale-[0.98]",
                  authMode === "pin"
                    ? "bg-background text-foreground shadow-xs font-bold ring-1 ring-border/80"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Smartphone className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Quick POS PIN</span>
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleLogin} className="space-y-4">
              {authMode === "credentials" ? (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                      <span>Email or Operator ID</span>
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="owner@biryanicentral.in"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="h-11 rounded-xl bg-background border-border/80 text-foreground placeholder:text-muted-foreground/60 text-xs shadow-2xs focus-visible:ring-primary/20"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                        <span>Password</span>
                      </Label>
                      <a
                        href="#"
                        onClick={(e) => {
                          e.preventDefault()
                          alert("Please contact your organization administrator or master account owner to reset your credentials.")
                        }}
                        className="text-[11px] text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                      >
                        Forgot password?
                      </a>
                    </div>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="h-11 rounded-xl bg-background border-border/80 text-foreground text-xs pr-10 shadow-2xs focus-visible:ring-primary/20 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="space-y-3 p-4 rounded-2xl bg-muted/20 border border-border/60">
                  <div className="flex items-center justify-between gap-2 pb-0.5">
                    <Label htmlFor="pin" className="text-xs font-semibold text-foreground flex items-center gap-1.5 leading-snug">
                      <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
                      <span>Cashier Terminal PIN</span>
                    </Label>
                    <Badge variant="outline" className="text-[9px] font-mono font-bold text-muted-foreground px-1.5 py-0.5 border-border/70 shrink-0">
                      POS Shift
                    </Badge>
                  </div>
                  <Input
                    id="pin"
                    type="password"
                    maxLength={6}
                    placeholder="••••"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    required
                    autoFocus
                    className="h-12 rounded-xl bg-background border-border/80 text-foreground font-mono text-2xl tracking-[0.45em] text-center font-black shadow-2xs focus-visible:ring-primary/20"
                  />
                  <p className="text-[11px] text-muted-foreground text-center leading-normal">
                    Quickly unlock counter dispatch & POS order punching.
                  </p>
                </div>
              )}

              {errorMsg && (
                <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/25 text-destructive text-xs animate-in fade-in">
                  {errorMsg}
                </div>
              )}

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-11 rounded-xl text-xs font-bold cursor-pointer shadow-sm active:scale-[0.98] transition-all gap-2"
              >
                {isLoading ? (
                  <span>Authenticating Station...</span>
                ) : (
                  <>
                    <span>{authMode === "pin" ? "Unlock POS Station" : "Sign In to Dashboard"}</span>
                    <ArrowRight className="w-4 h-4 ml-auto opacity-70" />
                  </>
                )}
              </Button>
            </form>
          </div>

     
        </div>

        {/* Right Column: Hero Visual Asset (public/login.png) with Apple Translucent Overlay */}
        <div className="relative hidden md:block overflow-hidden bg-muted min-h-[540px]">
          <Image
            src="/login.png"
            alt="KitchFlow Kitchen Operations"
            fill
            className="object-cover object-center transition-transform duration-700 hover:scale-105"
            priority
            unoptimized
          />
          {/* Subtle gradient overlay to enhance text contrast and branding */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/10" />

          {/* Top Brand Watermark Pill */}
          <div className="absolute top-6 right-6">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/40 backdrop-blur-md border border-white/15 text-white/90 text-[11px] font-mono font-medium shadow-lg">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Multi-Storefront Live</span>
            </div>
          </div>

          {/* Bottom Card Overlay */}
          <div className="absolute bottom-6 left-6 right-6 p-5 rounded-2xl bg-black/50 backdrop-blur-xl border border-white/15 text-white shadow-2xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ChefHat className="w-4 h-4 text-primary" />
                <span className="text-xs font-bold uppercase tracking-wider text-white/90">
                  Real-time Multi-Brand Hub
                </span>
              </div>
              <Badge className="bg-primary/25 border-primary/40 text-primary text-[10px] font-mono font-bold">
                v2.4
              </Badge>
            </div>

            <p className="text-xs text-white/80 leading-relaxed font-normal">
              Unified kitchen dispatch powering offline-first point-of-sale, thermal KOT printers, and dynamic menu ingestion.
            </p>

            <div className="grid grid-cols-3 gap-2 pt-1 border-t border-white/10 text-center font-mono">
              <div className="p-2 rounded-xl bg-white/5 border border-white/10">
                <span className="text-[10px] text-white/60 block">Offline POS</span>
                <span className="text-xs font-bold text-emerald-400">Synced</span>
              </div>
              <div className="p-2 rounded-xl bg-white/5 border border-white/10">
                <span className="text-[10px] text-white/60 block">Thermal KOT</span>
                <span className="text-xs font-bold text-white">80mm Ready</span>
              </div>
              <div className="p-2 rounded-xl bg-white/5 border border-white/10">
                <span className="text-[10px] text-white/60 block">Latency</span>
                <span className="text-xs font-bold text-primary">&lt;12ms</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Legal & Terms Footer */}
      <p className="px-6 text-center text-[11px] text-muted-foreground leading-relaxed">
        By clicking sign in, you agree to KitchFlow's{" "}
        <a href="#" className="underline underline-offset-2 hover:text-foreground">
          Terms of Service
        </a>{" "}
        and{" "}
        <a href="#" className="underline underline-offset-2 hover:text-foreground">
          Privacy Policy
        </a>
        .
      </p>
    </div>
  )
}
