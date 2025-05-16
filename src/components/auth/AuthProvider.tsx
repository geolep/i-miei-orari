'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AuthProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const publicRoutes = ['/(auth)/login']

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user && !publicRoutes.includes(pathname)) {
        router.push('/(auth)/login')
        return
      }

      if (user && publicRoutes.includes(pathname)) {
        const { data: employeeData } = await supabase
          .from('employees')
          .select('role')
          .eq('auth_id', user.id)
          .single()

        if (employeeData?.role === 'admin' || employeeData?.role === 'manager') {
          router.push('/dashboard')
        } else {
          router.push('/employee-dashboard')
        }
      }
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      checkAuth()
    })

    checkAuth()

    return () => {
      subscription.unsubscribe()
    }
  }, [pathname])

  return children
} 