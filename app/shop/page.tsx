'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { supabase } from '../../lib/supabaseClient';

type Profile = {
  id: string;
  display_name: string;
};

type WishlistItem = {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  product_url: string | null;
  image_url: string | null;
  price_cents: number | null;
  priority: number | null;
};

type CartRow = {
  id: string;
  user_id: string;
  wishlist_item_id: string;
  quantity: number;
  purchased: boolean;
  wishlist_items: WishlistItem;
};

type SortOption = 'default' | 'price-asc' | 'price-desc' | 'priority-desc';

export default function ShopPage() {
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [wishlistItems, setWishlistItems] = useState<WishlistItem[]>([]);
  const [cartRows, setCartRows] = useState<CartRow[]>([]);

  const [loadingWishlist, setLoadingWishlist] = useState(true);
  const [loadingCart, setLoadingCart] = useState(true);

  const [shoppingForId, setShoppingForId] = useState<'all' | string>('all');
  const [sortBy, setSortBy] = useState<SortOption>('default');
  const [cartView, setCartView] = useState<'cart' | 'bought'>('cart');

  const [budget, setBudget] = useState<string>('500');
  const [funMode, setFunMode] = useState(true);

  /* ----------------- auth ----------------- */

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.replace('/auth');
      } else {
        setUserId(data.user.id);
      }
      setCheckingAuth(false);
    })();
  }, [router]);

  /* ----------------- fun mode from localStorage ----------------- */

  useEffect(() => {
    try {
      const fm = localStorage.getItem('funMode');
      if (fm !== null) setFunMode(fm === 'true');
    } catch {
      // ignore
    }
  }, []);

  /* ----------------- load profiles ----------------- */

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('display_name', { ascending: true });

      if (!error && data) setProfiles(data as Profile[]);
    })();
  }, [userId]);

  /* ----------------- load wishlist ----------------- */

  useEffect(() => {
    (async () => {
      setLoadingWishlist(true);
      const { data, error } = await supabase
        .from('wishlist_items')
        .select('*')
        .order('priority', { ascending: false })
        .order('created_at', { ascending: true });

      if (!error && data) setWishlistItems(data as WishlistItem[]);
      setLoadingWishlist(false);
    })();
  }, []);

  /* ----------------- load cart ----------------- */

  useEffect(() => {
    if (!userId) return;
    refreshCart();
  }, [userId]);

  async function refreshCart() {
    if (!userId) return;
    setLoadingCart(true);
    const { data, error } = await supabase
      .from('cart_items')
      .select('id,user_id,wishlist_item_id,quantity,purchased,wishlist_items(*)')
      .eq('user_id', userId);

    if (!error && data) {
      setCartRows(data as unknown as CartRow[]);
    }
    setLoadingCart(false);
  }

  /* ----------------- computed data ----------------- */

  const profilesMap = useMemo(() => {
    const map: Record<string, Profile> = {};
    for (const p of profiles) map[p.id] = p;
    return map;
  }, [profiles]);

  const filteredWishlist = useMemo(() => {
    const base = wishlistItems.filter((item) => {
      if (shoppingForId === 'all') return true;
      return item.owner_id === shoppingForId;
    });

    const sorted = [...base];
    sorted.sort((a, b) => {
      if (sortBy === 'price-asc') {
        const pa = a.price_cents ?? Number.MAX_SAFE_INTEGER;
        const pb = b.price_cents ?? Number.MAX_SAFE_INTEGER;
        return pa - pb;
      }
      if (sortBy === 'price-desc') {
        const pa = a.price_cents ?? 0;
        const pb = b.price_cents ?? 0;
        return pb - pa;
      }
      if (sortBy === 'priority-desc') {
        const pa = a.priority ?? 0;
        const pb = b.priority ?? 0;
        if (pb !== pa) return pb - pa;
        const pra = a.price_cents ?? Number.MAX_SAFE_INTEGER;
        const prb = b.price_cents ?? Number.MAX_SAFE_INTEGER;
        return pra - prb;
      }
      // default: just by priority desc (created_at already from DB)
      const pa = a.priority ?? 0;
      const pb = b.priority ?? 0;
      return pb - pa;
    });

    return sorted;
  }, [wishlistItems, shoppingForId, sortBy]);

  const inCart = cartRows.filter((c) => !c.purchased);
  const boughtItems = cartRows.filter((c) => c.purchased);

  const totalCentsPlanned = inCart.reduce((sum, c) => {
    const price = c.wishlist_items?.price_cents;
    if (price == null) return sum;
    return sum + price * c.quantity;
  }, 0);

  const totalCentsSpent = boughtItems.reduce((sum, c) => {
    const price = c.wishlist_items?.price_cents;
    if (price == null) return sum;
    return sum + price * c.quantity;
  }, 0);

  const totalCentsOverall = totalCentsPlanned + totalCentsSpent;
  const budgetCents = budget ? Math.round(parseFloat(budget) * 100) : 0;

  const percentPlanned =
    budgetCents > 0
      ? Math.min(100, Math.round((totalCentsPlanned / budgetCents) * 100))
      : 0;

  const percentSpent =
    budgetCents > 0
      ? Math.min(100, Math.round((totalCentsSpent / budgetCents) * 100))
      : 0;

  const percentOverall =
    budgetCents > 0
      ? Math.min(100, Math.round((totalCentsOverall / budgetCents) * 100))
      : 0;

  /* ----------------- actions ----------------- */

  async function handleAddToCart(itemId: string) {
    if (!userId) return;
    await supabase.from('cart_items').upsert(
      {
        user_id: userId,
        wishlist_item_id: itemId,
        quantity: 1,
        purchased: false,
      },
      { onConflict: 'user_id,wishlist_item_id' }
    );
    await refreshCart();
  }

  async function handleMoveToBought(cartId: string) {
    await supabase.from('cart_items').update({ purchased: true }).eq('id', cartId);
    await refreshCart();
  }

  async function handleMoveToCart(cartId: string) {
    await supabase.from('cart_items').update({ purchased: false }).eq('id', cartId);
    await refreshCart();
  }

  async function handleRemoveFromCart(cartId: string) {
    await supabase.from('cart_items').delete().eq('id', cartId);
    await refreshCart();
  }

  function renderStars(priority: number | null | undefined) {
    const rating = priority ?? 0;
    const stars = [];
    for (let i = 1; i <= 5; ++i) {
      const filled = i <= rating;
      stars.push(
        <span
          key={i}
          style={{
            fontSize: 14,
            marginRight: 2,
            background: filled
              ? 'linear-gradient(120deg,#facc15,#fb7185)'
              : 'linear-gradient(120deg,#9ca3af,#e5e7eb)',
            WebkitBackgroundClip: 'text',
            color: 'transparent',
            filter: filled ? 'drop-shadow(0 0 6px rgba(251,191,36,0.7))' : 'none',
          }}
        >
          ★
        </span>
      );
    }
    return <div style={{ display: 'flex' }}>{stars}</div>;
  }

  function handleBudgetInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    if (val === '' || /^-?\d*\.?\d*$/.test(val)) {
      setBudget(val);
    }
  }

  function stepBudget(direction: 'up' | 'down') {
    const current = parseFloat(budget || '0') || 0;
    const step = 25;
    const next =
      direction === 'up' ? current + step : Math.max(0, current - step);
    setBudget(String(Math.round(next)));
  }

  /* ----------------- loading / auth ----------------- */

  if (checkingAuth) {
    return (
      <main
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#020617',
          color: 'white',
        }}
      >
        <p>Loading...</p>
      </main>
    );
  }

  if (!userId) return null;

  /* ----------------- render ----------------- */

  return (
    <main
      style={{
        minHeight: '100vh',
        padding: '1.5rem',
        background: '#020617',
        color: 'white',
      }}
    >
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4 }}
        style={{
          width: '100%',
          maxWidth: 1200,
          margin: '0 auto',
        }}
      >
        {/* Header row */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 16,
            alignItems: 'flex-start',
            marginBottom: 18,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ flex: 1, minWidth: 260 }}>
            <h1 style={{ fontSize: '1.7rem', margin: 0 }}>
              Zeller Family Christmas Lists 🎄
            </h1>
            <p style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>
              One shared control center for everyone&apos;s wishlists. Yes, I made a
              whole website just so we stop texting links all December.
            </p>
            <p style={{ fontSize: 12, opacity: 0.75, marginTop: 3 }}>
              Pick whose list you&apos;re shopping, toss stuff in the cart, and track what
              you&apos;ve already bought so we don&apos;t double-buy the same socks.
            </p>
            {funMode && (
              <p
                style={{
                  fontSize: 11,
                  marginTop: 4,
                  color: '#fde68a',
                  opacity: 0.95,
                }}
              >
                Fun mode is <strong>ON</strong> – prices and totals are hidden across the
                app. Pure vibes, no math.
              </p>
            )}
          </div>

          {/* Right-side controls block */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              alignItems: 'flex-end',
              minWidth: 260,
            }}
          >
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => router.push('/admin')}
                style={{
                  borderRadius: 999,
                  padding: '0.4rem 0.9rem',
                  border: '1px solid rgba(148,163,184,0.7)',
                  background: 'rgba(15,23,42,0.9)',
                  color: '#e5e7eb',
                  fontSize: 13,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                Manage my list
              </button>
              <button
                type="button"
                onClick={() => router.push('/profile')}
                style={{
                  borderRadius: 999,
                  padding: '0.4rem 0.9rem',
                  border: '1px solid rgba(148,163,184,0.7)',
                  background: 'rgba(15,23,42,0.9)',
                  color: '#e5e7eb',
                  fontSize: 13,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                Profile & settings
              </button>
            </div>

            {/* Controls row: budget / shopping for / sort */}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 10,
                alignItems: 'flex-end',
                justifyContent: 'flex-end',
              }}
            >
              {/* Budget */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  fontSize: 12,
                  minWidth: 150,
                }}
              >
                <span>Budget</span>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '0.2rem 0.5rem',
                    borderRadius: 999,
                    border: '1px solid rgba(148,163,184,0.7)',
                    background: 'rgba(15,23,42,0.95)',
                    height: 32,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => stepBudget('down')}
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 999,
                      border: 'none',
                      cursor: 'pointer',
                      background: 'linear-gradient(120deg,#1d4ed8,#0f172a)',
                      color: 'white',
                      fontSize: 12,
                      flexShrink: 0,
                    }}
                  >
                    –
                  </button>
                  <input
                    type="text"
                    value={budget}
                    onChange={handleBudgetInputChange}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      border: 'none',
                      outline: 'none',
                      background: 'transparent',
                      color: 'white',
                      fontSize: 13,
                      textAlign: 'center',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => stepBudget('up')}
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 999,
                      border: 'none',
                      cursor: 'pointer',
                      background: 'linear-gradient(120deg,#22c55e,#0f172a)',
                      color: '#022c22',
                      fontSize: 12,
                      fontWeight: 600,
                      flexShrink: 0,
                    }}
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Shopping for */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  fontSize: 12,
                  minWidth: 150,
                }}
              >
                <span>Shopping for</span>
                <select
                  value={shoppingForId}
                  onChange={(e) =>
                    setShoppingForId(e.target.value === 'all' ? 'all' : e.target.value)
                  }
                  style={{
                    width: '100%',
                    padding: '0.35rem 0.7rem',
                    borderRadius: 999,
                    border: '1px solid rgba(148,163,184,0.7)',
                    background: 'rgba(15,23,42,0.95)',
                    color: 'white',
                    fontSize: 13,
                    height: 32,
                  }}
                >
                  <option value="all">All family</option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.display_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sort by */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  fontSize: 12,
                  minWidth: 140,
                }}
              >
                <span>Sort by</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  style={{
                    width: '100%',
                    padding: '0.35rem 0.7rem',
                    borderRadius: 999,
                    border: '1px solid rgba(148,163,184,0.7)',
                    background: 'rgba(15,23,42,0.95)',
                    color: 'white',
                    fontSize: 13,
                    height: 32,
                  }}
                >
                  <option value="default">Default</option>
                  <option value="priority-desc">Priority (stars)</option>
                  <option value="price-asc">Price ↑</option>
                  <option value="price-desc">Price ↓</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Main two-column layout */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1fr)',
            gap: 16,
          }}
        >
          {/* Wishlist column */}
          <section
            style={{
              borderRadius: 24,
              padding: '1rem 1rem 1.1rem',
              background: 'rgba(15,23,42,0.96)',
              border: '1px solid rgba(148,163,184,0.5)',
              boxShadow: '0 24px 60px rgba(15,23,42,0.9)',
            }}
          >
            <h2 style={{ margin: 0, marginBottom: 8, fontSize: 16 }}>Wishlist</h2>
            {loadingWishlist ? (
              <p style={{ fontSize: 13 }}>Loading items…</p>
            ) : filteredWishlist.length === 0 ? (
              <p style={{ fontSize: 13, opacity: 0.8 }}>
                No items on this list yet. Tell them to go add stuff.
              </p>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {filteredWishlist.map((item) => {
                  const owner = profilesMap[item.owner_id];
                  const ownerName = owner ? owner.display_name : 'Someone';
                  const price =
                    item.price_cents != null ? item.price_cents / 100 : null;

                  const inCartRow = cartRows.find(
                    (c) => c.wishlist_item_id === item.id && !c.purchased
                  );
                  const isInCart = !!inCartRow;
                  const purchasedRow = cartRows.find(
                    (c) => c.wishlist_item_id === item.id && c.purchased
                  );
                  const isBought = !!purchasedRow;

                  return (
                    <div
                      key={item.id}
                      className="click-card"
                      style={{
                        borderRadius: 18,
                        padding: '0.75rem 0.8rem',
                        border: '1px solid rgba(148,163,184,0.45)',
                        display: 'flex',
                        gap: 10,
                        alignItems: 'stretch',
                        background: 'rgba(15,23,42,0.98)',
                      }}
                    >
                      <div
                        style={{
                          width: 68,
                          height: 68,
                          borderRadius: 18,
                          overflow: 'hidden',
                          background: '#020617',
                          flexShrink: 0,
                        }}
                      >
                        {item.image_url ? (
                          <img
                            src={item.image_url}
                            alt={item.title}
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: '100%',
                              height: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 24,
                              opacity: 0.6,
                            }}
                          >
                            🎁
                          </div>
                        )}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            gap: 8,
                          }}
                        >
                          <div
                            style={{
                              minWidth: 0,
                            }}
                          >
                            <div
                              style={{
                                fontSize: 14,
                                fontWeight: 600,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {item.title}
                            </div>
                            <div
                              style={{
                                fontSize: 11,
                                opacity: 0.9,
                                marginTop: 2,
                                whiteSpace: 'nowrap',
                                textOverflow: 'ellipsis',
                                overflow: 'hidden',
                              }}
                            >
                              For {ownerName}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            {renderStars(item.priority)}
                            {!funMode && price != null && (
                              <div
                                style={{
                                  fontSize: 13,
                                  marginTop: 4,
                                  opacity: 0.95,
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                ${price.toFixed(2)}
                              </div>
                            )}
                          </div>
                        </div>
                        {item.description && (
                          <div
                            style={{
                              fontSize: 12,
                              opacity: 0.85,
                              marginTop: 4,
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                            }}
                          >
                            {item.description}
                          </div>
                        )}
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 6,
                          alignItems: 'flex-end',
                          flexShrink: 0,
                          width: 112,
                        }}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            window.open(item.product_url ?? '#', '_blank')
                          }
                          style={{
                            borderRadius: 999,
                            padding: '0.3rem 0.7rem',
                            border: '1px solid rgba(148,163,184,0.7)',
                            background: 'transparent',
                            color: '#e5e7eb',
                            fontSize: 12,
                            cursor: 'pointer',
                            width: '100%',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          View product
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAddToCart(item.id)}
                          disabled={isBought}
                          style={{
                            borderRadius: 999,
                            padding: '0.35rem 0.7rem',
                            border: 'none',
                            cursor: isBought ? 'default' : 'pointer',
                            background: isBought
                              ? 'rgba(31,41,55,0.9)'
                              : 'linear-gradient(120deg,#22c55e,#22d3ee)',
                            color: isBought ? '#9ca3af' : 'black',
                            fontWeight: 600,
                            fontSize: 12,
                            opacity: isBought ? 0.7 : 1,
                            width: '100%',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {isBought
                            ? 'Already bought'
                            : isInCart
                            ? 'In cart'
                            : 'Add to cart'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Cart / bought column */}
          <section
            style={{
              borderRadius: 24,
              padding: '1rem 1rem 1.1rem',
              background: 'rgba(15,23,42,0.96)',
              border: '1px solid rgba(148,163,184,0.5)',
              boxShadow: '0 24px 60px rgba(15,23,42,0.9)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 8,
              }}
            >
              <h2 style={{ margin: 0, fontSize: 16 }}>Your gifts</h2>
              <div
                style={{
                  display: 'inline-flex',
                  borderRadius: 999,
                  padding: 2,
                  border: '1px solid rgba(148,163,184,0.7)',
                  background: 'rgba(15,23,42,0.95)',
                  fontSize: 11,
                }}
              >
                <button
                  type="button"
                  onClick={() => setCartView('cart')}
                  style={{
                    borderRadius: 999,
                    border: 'none',
                    padding: '0.15rem 0.7rem',
                    cursor: 'pointer',
                    fontSize: 11,
                    background:
                      cartView === 'cart'
                        ? 'linear-gradient(120deg,#22c55e,#22d3ee)'
                        : 'transparent',
                    color: cartView === 'cart' ? '#022c22' : '#e5e7eb',
                    fontWeight: cartView === 'cart' ? 600 : 500,
                  }}
                >
                  In cart
                </button>
                <button
                  type="button"
                  onClick={() => setCartView('bought')}
                  style={{
                    borderRadius: 999,
                    border: 'none',
                    padding: '0.15rem 0.7rem',
                    cursor: 'pointer',
                    fontSize: 11,
                    background:
                      cartView === 'bought'
                        ? 'linear-gradient(120deg,#22c55e,#22d3ee)'
                        : 'transparent',
                    color: cartView === 'bought' ? '#022c22' : '#e5e7eb',
                    fontWeight: cartView === 'bought' ? 600 : 500,
                  }}
                >
                  Bought
                </button>
              </div>
            </div>

            {cartView === 'cart' ? (
              <>
                {loadingCart ? (
                  <p style={{ fontSize: 13 }}>Loading cart…</p>
                ) : inCart.length === 0 ? (
                  <p style={{ fontSize: 13, opacity: 0.8 }}>
                    No items in your cart yet.
                  </p>
                ) : (
                  <div style={{ display: 'grid', gap: 8, marginBottom: 10 }}>
                    {inCart.map((row) => {
                      const item = row.wishlist_items;
                      const owner = profilesMap[item.owner_id];
                      const ownerName = owner ? owner.display_name : 'Someone';
                      const price =
                        !funMode && item.price_cents != null
                          ? (item.price_cents / 100).toFixed(2)
                          : null;

                      return (
                        <div
                          key={row.id}
                          className="click-card"
                          style={{
                            borderRadius: 16,
                            padding: '0.6rem 0.75rem',
                            border: '1px solid rgba(148,163,184,0.45)',
                            background: 'rgba(15,23,42,0.98)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            gap: 8,
                            alignItems: 'center',
                          }}
                        >
                          <div style={{ minWidth: 0 }}>
                            <div
                              style={{
                                fontSize: 13,
                                fontWeight: 600,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {item.title}
                            </div>
                            <div
                              style={{
                                fontSize: 11,
                                opacity: 0.9,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              For {ownerName}
                            </div>
                            <div style={{ fontSize: 11, opacity: 0.9 }}>
                              Qty {row.quantity}
                              {!funMode && price && ` · $${price} each`}
                            </div>
                          </div>
                          <div
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 4,
                              alignItems: 'flex-end',
                              flexShrink: 0,
                              width: 130,
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => handleMoveToBought(row.id)}
                              style={{
                                borderRadius: 999,
                                padding: '0.25rem 0.7rem',
                                border: 'none',
                                cursor: 'pointer',
                                background:
                                  'linear-gradient(120deg,#22c55e,#22d3ee)',
                                color: 'black',
                                fontSize: 11,
                                fontWeight: 600,
                                width: '100%',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              Mark bought
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveFromCart(row.id)}
                              style={{
                                borderRadius: 999,
                                padding: '0.2rem 0.6rem',
                                border: '1px solid rgba(248,113,113,0.8)',
                                background: 'transparent',
                                color: '#fecaca',
                                fontSize: 11,
                                cursor: 'pointer',
                                width: '100%',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {!funMode && (
                  <>
                    <div
                      style={{
                        fontSize: 12,
                        opacity: 0.95,
                        marginBottom: 6,
                      }}
                    >
                      <strong>Cart:</strong> $
                      {(totalCentsPlanned / 100).toFixed(2)} ·{' '}
                      <strong>Bought:</strong> $
                      {(totalCentsSpent / 100).toFixed(2)} ·{' '}
                      <strong>Total:</strong> $
                      {(totalCentsOverall / 100).toFixed(2)}
                      {budgetCents > 0 &&
                        ` (${percentOverall}% of budget)`}
                    </div>
                    {budgetCents > 0 && (
                      <div
                        style={{
                          width: '100%',
                          height: 8,
                          borderRadius: 999,
                          overflow: 'hidden',
                          background: 'rgba(15,23,42,0.9)',
                          border: '1px solid rgba(148,163,184,0.5)',
                        }}
                      >
                        <div
                          style={{
                            width: `${percentOverall}%`,
                            height: '100%',
                            background:
                              percentOverall < 80
                                ? 'linear-gradient(90deg,#22c55e,#22d3ee)'
                                : 'linear-gradient(90deg,#f97316,#ef4444)',
                          }}
                        />
                      </div>
                    )}
                  </>
                )}
              </>
            ) : (
              <>
                {loadingCart ? (
                  <p style={{ fontSize: 13 }}>Loading…</p>
                ) : boughtItems.length === 0 ? (
                  <p style={{ fontSize: 13, opacity: 0.8 }}>
                    You haven&apos;t marked anything as bought yet.
                  </p>
                ) : (
                  <div style={{ display: 'grid', gap: 8, marginBottom: 10 }}>
                    {boughtItems.map((row) => {
                      const item = row.wishlist_items;
                      const owner = profilesMap[item.owner_id];
                      const ownerName = owner ? owner.display_name : 'Someone';
                      const price =
                        !funMode && item.price_cents != null
                          ? (item.price_cents / 100).toFixed(2)
                          : null;

                      return (
                        <div
                          key={row.id}
                          className="click-card"
                          style={{
                            borderRadius: 16,
                            padding: '0.6rem 0.75rem',
                            border: '1px solid rgba(148,163,184,0.45)',
                            background: 'rgba(15,23,42,0.98)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            gap: 8,
                            alignItems: 'center',
                          }}
                        >
                          <div style={{ minWidth: 0 }}>
                            <div
                              style={{
                                fontSize: 13,
                                fontWeight: 600,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {item.title}
                            </div>
                            <div
                              style={{
                                fontSize: 11,
                                opacity: 0.9,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              For {ownerName}
                            </div>
                            <div style={{ fontSize: 11, opacity: 0.9 }}>
                              Qty {row.quantity}
                              {!funMode && price && ` · $${price} each`}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleMoveToCart(row.id)}
                            style={{
                              borderRadius: 999,
                              padding: '0.25rem 0.7rem',
                              border: '1px solid rgba(148,163,184,0.8)',
                              background: 'transparent',
                              color: '#e5e7eb',
                              fontSize: 11,
                              cursor: 'pointer',
                              flexShrink: 0,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            Move back to cart
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {!funMode && (
                  <>
                    <div
                      style={{
                        fontSize: 12,
                        opacity: 0.95,
                        marginBottom: 6,
                      }}
                    >
                      <strong>Cart:</strong> $
                      {(totalCentsPlanned / 100).toFixed(2)} ·{' '}
                      <strong>Bought:</strong> $
                      {(totalCentsSpent / 100).toFixed(2)} ·{' '}
                      <strong>Total:</strong> $
                      {(totalCentsOverall / 100).toFixed(2)}
                      {budgetCents > 0 &&
                        ` (${percentOverall}% of budget)`}
                    </div>
                    {budgetCents > 0 && (
                      <div
                        style={{
                          width: '100%',
                          height: 8,
                          borderRadius: 999,
                          overflow: 'hidden',
                          background: 'rgba(15,23,42,0.9)',
                          border: '1px solid rgba(148,163,184,0.5)',
                        }}
                      >
                        <div
                          style={{
                            width: `${percentSpent}%`,
                            height: '100%',
                            background:
                              percentSpent < 80
                                ? 'linear-gradient(90deg,#22c55e,#22d3ee)'
                                : 'linear-gradient(90deg,#f97316,#ef4444)',
                          }}
                        />
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </section>
        </div>
      </motion.div>
    </main>
  );
}
