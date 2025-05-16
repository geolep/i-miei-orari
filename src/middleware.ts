import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export default async function middleware(req: NextRequest) {
  const res = NextResponse.next()

  // Ignora i warning per i cookie in base64
  const supabase = createMiddlewareClient({ 
    req, 
    res 
  }, {
    options: {
      db: {
        schema: 'public'
      }
    }
  })

  await supabase.auth.getSession()

  return res
}

// Configura il matcher per escludere le risorse statiche
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
} 