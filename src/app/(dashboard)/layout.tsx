'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Navigation from '@/components/Navigation';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error || !session) {
          router.push('/login');
        }
      } catch (err) {
        console.error('Errore nel controllo dell\'autenticazione:', err);
        router.push('/login');
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        router.push('/login');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="pt-2 sm:pt-4">
        {children}
      </main>
      <footer className="w-full mt-4 sm:mt-8 py-2 sm:py-4 border-t text-center text-xs sm:text-sm text-muted-foreground bg-background px-4">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2">
          <span>© {new Date().getFullYear()} I Miei Orari. Tutti i diritti riservati.</span>
          <div className="flex gap-2">
            <a href="/privacy" className="underline hover:text-primary">Privacy Policy</a>
            <span>|</span>
            <a href="/termini" className="underline hover:text-primary">Termini di servizio</a>
          </div>
        </div>
      </footer>
    </div>
  );
} 