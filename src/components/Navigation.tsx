'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from './ui/button'
import { supabase } from '@/lib/supabase'
import { useState, useEffect } from 'react'
import { Menu, X } from 'lucide-react'

export default function Navigation() {
  const pathname = usePathname()
  const [userRole, setUserRole] = useState<string>('')
  const [userName, setUserName] = useState<string>('')
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

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
    <nav className="border-b bg-white">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo/Brand - visibile su mobile e desktop */}
          <div className="flex items-center">
            <Link href="/dashboard" className="text-lg font-bold text-primary">
              I Miei Orari
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-6">
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

          {/* Desktop User Info */}
          <div className="hidden md:flex items-center gap-4">
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
              className="text-sm"
            >
              Esci
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2"
            >
              {isMobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t bg-white">
            <div className="px-4 py-2 space-y-1">
              {links.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={cn(
                    'block px-3 py-2 text-sm font-medium rounded-md transition-colors',
                    pathname === href
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-gray-100'
                  )}
                >
                  {label}
                </Link>
              ))}
              
              {/* Mobile User Info */}
              {userName && (
                <div className="border-t pt-2 mt-2">
                  <Link 
                    href='/profile'
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={cn(
                      'block px-3 py-2 text-sm font-medium rounded-md transition-colors',
                      pathname === '/profile'
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-gray-100'
                    )}
                  >
                    {userName}
                  </Link>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      handleLogout()
                      setIsMobileMenuOpen(false)
                    }}
                    className="w-full justify-start px-3 py-2 text-sm text-muted-foreground hover:bg-gray-100"
                  >
                    Esci
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  )
} 