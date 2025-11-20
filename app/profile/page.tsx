'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
import { motion } from 'framer-motion';

type Profile = {
  id: string;
  display_name: string;
};

export default function ProfilePage() {
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [originalDisplayName, setOriginalDisplayName] = useState('');
  const [savingName, setSavingName] = useState(false);

  const [funMode, setFunMode] = useState(true);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  const [familyProfiles, setFamilyProfiles] = useState<Profile[]>([]);
  const [loadingFamily, setLoadingFamily] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Auth
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.replace('/auth');
        return;
      }
      setUserId(data.user.id);
      setEmail(data.user.email ?? null);
      setCheckingAuth(false);
    })();
  }, [router]);

  // Load fun mode + theme from localStorage and apply to <html>/<body>
  useEffect(() => {
    try {
      const fm = localStorage.getItem('funMode');
      if (fm !== null) setFunMode(fm === 'true');

      let storedTheme = localStorage.getItem('wishlistTheme');
      if (storedTheme !== 'light' && storedTheme !== 'dark') {
        storedTheme = 'dark';
      }
      setTheme(storedTheme as 'light' | 'dark');

      if (typeof document !== 'undefined') {
        document.documentElement.dataset.theme = storedTheme as string;
        document.body.dataset.theme = storedTheme as string;
      }
    } catch {
      // ignore
    }
  }, []);

  // Load current profile + family list
  useEffect(() => {
    if (!userId) return;
    (async () => {
      const { data: me, error: meError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (!meError && me) {
        setDisplayName(me.display_name);
        setOriginalDisplayName(me.display_name);
      }

      const { data: fam, error: famError } = await supabase
        .from('profiles')
        .select('*')
        .order('display_name', { ascending: true });

      if (!famError && fam) {
        setFamilyProfiles(fam as Profile[]);
      }
      setLoadingFamily(false);
    })();
  }, [userId]);

  const isLight = theme === 'light';

  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    const trimmed = displayName.trim();
    if (!trimmed || trimmed === originalDisplayName) return;

    setSavingName(true);
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: trimmed })
      .eq('id', userId);

    if (!error) {
      setOriginalDisplayName(trimmed);
      setDisplayName(trimmed);
    } else {
      console.error('Error updating display name', error);
    }
    setSavingName(false);
  }

  function toggleFunMode() {
    setFunMode((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('funMode', String(next));
      } catch {
        //
      }
      return next;
    });
  }

  function toggleTheme() {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem('wishlistTheme', next);
      } catch {
        //
      }
      if (typeof document !== 'undefined') {
        document.documentElement.dataset.theme = next;
        document.body.dataset.theme = next;
      }
      return next;
    });
  }

  async function handleSignOut() {
    setSigningOut(true);
    await supabase.auth.signOut();
    setSigningOut(false);
    router.replace('/auth');
  }

  if (checkingAuth) {
    return (
      <main
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <p>Loading...</p>
      </main>
    );
  }

  if (!userId) return null;

  const sectionCard = {
    borderRadius: 24,
    padding: '1.25rem 1.1rem',
    border: '1px solid rgba(148,163,184,0.5)',
    background: isLight ? 'rgba(255,255,255,0.97)' : 'rgba(15,23,42,0.96)',
    backdropFilter: 'blur(20px)',
    minWidth: 0,
  } as const;

  const inputStyle = {
    padding: '0.5rem 0.75rem',
    borderRadius: 999,
    border: '1px solid rgba(148,163,184,0.7)',
    background: isLight ? 'rgba(248,250,252,0.98)' : 'rgba(15,23,42,0.95)',
    color: isLight ? '#020617' : 'white',
    fontSize: 13,
  } as const;

  const pillButton = {
    borderRadius: 999,
    padding: '0.45rem 0.9rem',
    border: 'none',
    cursor: 'pointer',
    background: 'linear-gradient(120deg,#22c55e,#22d3ee)',
    color: 'black',
    fontWeight: 600,
    fontSize: 13,
  } as const;

  return (
    <main
      style={{
        minHeight: '100vh',
        padding: '1.25rem 1rem 1.75rem',
      }}
    >
      <motion.div
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        style={{
          maxWidth: 960,
          margin: '0 auto',
          borderRadius: 32,
          padding: '1.75rem 1.5rem 1.9rem',
          background: isLight
            ? 'radial-gradient(circle at top left, rgba(254,243,199,0.85), rgba(249,250,251,0.96))'
            : 'radial-gradient(circle at top left, rgba(56,189,248,0.1), rgba(15,23,42,0.98))',
          border: '1px solid rgba(148,163,184,0.6)',
          boxShadow: isLight
            ? '0 30px 80px rgba(148,163,184,0.4)'
            : '0 30px 80px rgba(15,23,42,0.95)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 16,
            alignItems: 'center',
            marginBottom: 18,
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: '1.6rem',
                color: isLight ? '#111827' : '#e5e7eb',
              }}
            >
              Profile &amp; Settings
            </h1>
            <p
              style={{
                margin: '4px 0 0',
                fontSize: 13,
                opacity: 0.9,
                color: isLight ? '#111827' : '#e5e7eb',
              }}
            >
              Change your display name, theme, and fun mode for the Family Gift Control
              Center.
            </p>
          </div>
          <button
            type="button"
            onClick={() => router.push('/shop')}
            style={{
              ...pillButton,
              background: 'transparent',
              color: isLight ? '#111827' : '#e5e7eb',
              border: '1px solid rgba(148,163,184,0.8)',
            }}
          >
            Back to gifts
          </button>
        </div>

        <div
          style={{
            display: 'grid',
            gap: 16,
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          }}
        >
          {/* Left column */}
          <div style={{ display: 'grid', gap: 16 }}>
            <section style={sectionCard}>
              <h2
                style={{
                  margin: 0,
                  fontSize: '1.1rem',
                  marginBottom: 8,
                  color: isLight ? '#111827' : '#e5e7eb',
                }}
              >
                Your profile
              </h2>
              <p style={{ fontSize: 12, opacity: 0.9, marginBottom: 10 }}>
                This is the name everyone will see in the dropdown when shopping for you.
              </p>

              <form
                onSubmit={handleSaveName}
                style={{ display: 'grid', gap: 8, marginBottom: 8 }}
              >
                <label style={{ fontSize: 12, opacity: 0.85 }}>Display name</label>
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  style={{ ...inputStyle, width: '100%' }}
                />
                <div style={{ fontSize: 12, opacity: 0.8 }}>
                  Email: {email ?? 'unknown'}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                  <button
                    type="submit"
                    disabled={savingName || displayName.trim() === originalDisplayName}
                    style={{
                      ...pillButton,
                      opacity:
                        savingName || displayName.trim() === originalDisplayName ? 0.6 : 1,
                    }}
                  >
                    {savingName ? 'Saving…' : 'Save name'}
                  </button>
                </div>
              </form>
            </section>

            <section style={sectionCard}>
              <h2
                style={{
                  margin: 0,
                  fontSize: '1.1rem',
                  marginBottom: 8,
                  color: isLight ? '#111827' : '#e5e7eb',
                }}
              >
                Display &amp; fun mode
              </h2>
              <p style={{ fontSize: 12, opacity: 0.9, marginBottom: 12 }}>
                Fun mode hides prices and totals. Theme flips between sunset glow and deep
                night mode.
              </p>

              {/* Fun mode */}
              <div
                style={{
                  marginBottom: 16,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>Fun mode</div>
                  <div style={{ fontSize: 12, opacity: 0.85 }}>
                    {funMode
                      ? 'Prices hidden – pure vibes and surprises.'
                      : 'Prices visible – full budgeting power.'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={toggleFunMode}
                  style={{
                    position: 'relative',
                    width: 64,
                    height: 34,
                    borderRadius: 999,
                    border: '1px solid rgba(209,213,219,0.9)',
                    background: 'linear-gradient(135deg,#f9fafb,#e5e7eb)',
                    boxShadow:
                      '0 4px 10px rgba(15,23,42,0.25), inset 0 1px 0 rgba(255,255,255,0.9)',
                    padding: 3,
                    cursor: 'pointer',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      inset: 2,
                      borderRadius: 999,
                      background: funMode
                        ? 'radial-gradient(circle at 20% 20%, rgba(251,191,36,0.7), transparent 60%)'
                        : 'radial-gradient(circle at 80% 80%, rgba(148,163,184,0.6), transparent 60%)',
                      opacity: 0.9,
                      pointerEvents: 'none',
                    }}
                  />
                  <motion.div
                    initial={false}
                    animate={{ x: funMode ? 28 : 0 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 22 }}
                    style={{
                      position: 'relative',
                      width: 28,
                      height: 28,
                      borderRadius: '999px',
                      background: 'linear-gradient(135deg,#f9fafb,#e5e7eb)',
                      boxShadow:
                        '0 1px 3px rgba(15,23,42,0.35), inset 0 0 0 1px rgba(209,213,219,0.9)',
                    }}
                  />
                </button>
              </div>

              {/* Theme toggle */}
              
            </section>
          </div>

          {/* Right column */}
          <div style={{ display: 'grid', gap: 16 }}>
            <section style={sectionCard}>
              <h2
                style={{
                  margin: 0,
                  fontSize: '1.1rem',
                  marginBottom: 8,
                  color: isLight ? '#111827' : '#e5e7eb',
                }}
              >
                Family members
              </h2>
              <p style={{ fontSize: 12, opacity: 0.9, marginBottom: 10 }}>
                Anyone with a profile can have a wishlist that appears in the selector on
                the shopping page.
              </p>
              {loadingFamily ? (
                <p style={{ fontSize: 13 }}>Loading family profiles…</p>
              ) : familyProfiles.length === 0 ? (
                <p style={{ fontSize: 13, opacity: 0.8 }}>
                  No profiles found yet. Sign in with each person&apos;s account to add
                  them.
                </p>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: 13 }}>
                  {familyProfiles.map((p) => (
                    <li
                      key={p.id}
                      style={{
                        padding: '0.35rem 0',
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 8,
                        alignItems: 'center',
                      }}
                    >
                      <span>{p.display_name}</span>
                      {p.id === userId && (
                        <span
                          style={{
                            fontSize: 11,
                            padding: '0.15rem 0.45rem',
                            borderRadius: 999,
                            background: 'rgba(34,197,94,0.12)',
                            border: '1px solid rgba(74,222,128,0.7)',
                            color: '#16a34a',
                          }}
                        >
                          You
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section style={sectionCard}>
              <h2
                style={{
                  margin: 0,
                  fontSize: '1.1rem',
                  marginBottom: 8,
                  color: isLight ? '#111827' : '#e5e7eb',
                }}
              >
                Session
              </h2>
              <p style={{ fontSize: 12, opacity: 0.9, marginBottom: 10 }}>
                Log out to let someone else sign in and shop or manage their own list.
              </p>
              <button
                type="button"
                onClick={handleSignOut}
                disabled={signingOut}
                style={{
                  ...pillButton,
                  background: 'linear-gradient(120deg,#f97316,#ef4444)',
                  color: 'white',
                  border: 'none',
                }}
              >
                {signingOut ? 'Signing out…' : 'Sign out'}
              </button>
            </section>
          </div>
        </div>
      </motion.div>
    </main>
  );
}
