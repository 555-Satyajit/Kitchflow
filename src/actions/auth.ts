'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function loginWithSupabase(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const redirectTo = (formData.get('redirectTo') as string) || '/orders'

  if (!email || !password) {
    return { error: 'Please enter both email and password' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return { error: error.message }
  }

  return { success: true, redirectTo }
}

export async function signOutFromSupabase() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
