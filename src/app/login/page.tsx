import { Suspense } from "react"
import { LoginForm } from "@/components/login-form"

export const metadata = {
  title: "Sign In | KitchenOS Cloud Kitchen Operations",
  description: "Log in to your KitchenOS outlet or staff station.",
}

export default function LoginPage() {
  return (
    <div className="bg-muted flex min-h-svh flex-col items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm md:max-w-3xl">
        <Suspense fallback={<div className="h-[500px] w-full rounded-3xl bg-card animate-pulse" />}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  )
}
