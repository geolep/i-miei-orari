'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from './ui/button'
import { supabase } from '@/lib/supabase'
import { useState, useEffect } from 'react'

export default function Navigation() {
  const pathname = usePathname()
  const [userRole, setUserRole] = useState<string>('')
  const [userName, setUserName] = useState<string>('')

  useEffect(() => {
    const fetchUserData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data, error } = await supabase
          .from('employees')
          .select('role, name, surname')
          .eq('email', user.email)
          .single()
        if (!error && data) {
          setUserRole(data.role)
          setUserName(`${data.name} ${data.surname}`)
        }
      }
    }
    fetchUserData()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  const links = [
    { href: '/dashboard', label: 'Orari Team' },
    { href: '/incassi', label: 'Incassi' },
    ...(userRole !== 'employee' ? [
      { href: '/employees', label: 'Dipendenti' },
      { href: '/requests', label: 'Richieste' }
    ] : []),
  ]

  return (
    <nav className="border-b">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center space-x-4">
            {links.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  'text-sm font-medium transition-colors hover:text-primary',
                  pathname === href
                    ? 'text-primary'
                    : 'text-muted-foreground'
                )}
              >
                {label}
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-4">
            {userName && (
              <Link 
              href='/profile'
              className={cn(
                'text-sm font-medium transition-colors hover:text-primary',
                pathname === '/profile'
                  ? 'text-primary'
                  : 'text-muted-foreground'
              )}
            >
              {userName}
            </Link>
            )}
            <Button
              variant="ghost"
              onClick={handleLogout}
            >
              Esci
            </Button>
          </div>
        </div>
      </div>
    </nav>
  )
} 