'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';  // 👈 changed to relative path
import { motion } from 'framer-motion';

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        router.replace('/shop');
      }
    })();
  }, [router]);

  async function ensureProfile(user: any) {
    // Only create profile if it doesn't exist yet
    const { data: existing, error: selectError } = await supabase
      .from('profiles')
      .select('id, display_name')
      .eq('id', user.id)
      .maybeSingle();

    if (selectError) {
      console.error('Error checking profile:', selectError);
    }

    if (!existing) {
      const defaultName =
        (user.user_metadata && user.user_metadata.full_name) ||
        (user.email && user.email.split('@')[0]) ||
        'Someone';

      const { error: insertError } = await supabase.from('profiles').insert({
        id: user.id,
        display_name: defaultName,
      });

      if (insertError) {
        console.error('Error creating profile:', insertError);
      }
    }
  }

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error || !data.user) {
          setErrorMsg(error?.message || 'Sign up failed');
          return;
        }
        await ensureProfile(data.user);
        router.replace('/shop');
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error || !data.user) {
          setErrorMsg(error?.message || 'Sign in failed');
          return;
        }
        await ensureProfile(data.user);
        router.replace('/shop');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        background:
          'radial-gradient(circle at top left, #0f172a 0%, #020617 45%, #020617 100%)',
      }}
    >
      <motion.div
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        style={{
          width: '100%',
          maxWidth: 420,
          borderRadius: 32,
          border: '1px solid rgba(148,163,184,0.5)',
          padding: '1.75rem 1.5rem',
          background:
            'radial-gradient(circle at top left, rgba(56,189,248,0.25), rgba(15,23,42,0.98))',
          boxShadow:
            '0 30px 80px rgba(15,23,42,0.95), 0 0 0 1px rgba(15,23,42,0.9)',
          color: 'white',
          backdropFilter: 'blur(24px)',
        }}
      >
        <h1 style={{ fontSize: '1.6rem', marginBottom: 8 }}>
          Family Gift Control Center 🎁
        </h1>
        <p style={{ fontSize: 13, opacity: 0.9, marginBottom: 18 }}>
          Sign in or create an account to start browsing wishlists and tracking gifts.
        </p>

        <div
          style={{
            display: 'inline-flex',
            borderRadius: 999,
            border: '1px solid rgba(148,163,184,0.6)',
            overflow: 'hidden',
            marginBottom: 16,
          }}
        >
          <button
            type="button"
            onClick={() => setMode('signin')}
            style={{
              padding: '0.3rem 0.9rem',
              border: 'none',
              cursor: 'pointer',
              background:
                mode === 'signin'
                  ? 'linear-gradient(120deg,#22c55e,#22d3ee)'
                  : 'transparent',
              color: mode === 'signin' ? 'black' : 'white',
              fontSize: 13,
              fontWeight: mode === 'signin' ? 600 : 400,
            }}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => setMode('signup')}
            style={{
              padding: '0.3rem 0.9rem',
              border: 'none',
              cursor: 'pointer',
              background:
                mode === 'signup'
                  ? 'linear-gradient(120deg,#22c55e,#22d3ee)'
                  : 'transparent',
              color: mode === 'signup' ? 'black' : 'white',
              fontSize: 13,
              fontWeight: mode === 'signup' ? 600 : 400,
            }}
          >
            Sign up
          </button>
        </div>

        <form onSubmit={handleAuth} style={{ display: 'grid', gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, opacity: 0.85 }}>Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                marginTop: 4,
                width: '100%',
                padding: '0.5rem 0.7rem',
                borderRadius: 999,
                border: '1px solid rgba(148,163,184,0.8)',
                background: 'rgba(15,23,42,0.9)',
                color: 'white',
                fontSize: 13,
              }}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, opacity: 0.85 }}>Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                marginTop: 4,
                width: '100%',
                padding: '0.5rem 0.7rem',
                borderRadius: 999,
                border: '1px solid rgba(148,163,184,0.8)',
                background: 'rgba(15,23,42,0.9)',
                color: 'white',
                fontSize: 13,
              }}
            />
          </div>

          {errorMsg && (
            <div style={{ fontSize: 12, color: '#fecaca' }}>{errorMsg}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 6,
              borderRadius: 999,
              padding: '0.55rem 1.1rem',
              border: 'none',
              cursor: 'pointer',
              background: 'linear-gradient(120deg,#22c55e,#22d3ee)',
              color: 'black',
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            {loading
              ? mode === 'signup'
                ? 'Creating account...'
                : 'Signing in...'
              : mode === 'signup'
              ? 'Create account'
              : 'Sign in'}
          </button>
        </form>
      </motion.div>
    </main>
  );
}
