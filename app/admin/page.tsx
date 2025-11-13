'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
import { motion } from 'framer-motion';

type WishlistItem = {
  id: string;
  title: string;
  description: string | null;
  product_url: string | null;
  image_url: string | null;
  price_cents: number | null;
  priority: number | null;
  owner_id: string;
};

export default function AdminPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [price, setPrice] = useState<string>('');
  const [priority, setPriority] = useState<number>(3);

  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [saving, setSaving] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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

  useEffect(() => {
    if (!userId) return;
    loadItems();
  }, [userId]);

  async function loadItems() {
    if (!userId) return;
    setLoadingItems(true);
    const { data, error } = await supabase
      .from('wishlist_items')
      .select('*')
      .eq('owner_id', userId)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true });

    if (!error && data) {
      setItems(data as WishlistItem[]);
    }
    setLoadingItems(false);
  }

  async function handleScrape(e: React.FormEvent) {
    e.preventDefault();
    if (!url) return;
    setScraping(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/scrape-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      if (!res.ok) {
        setErrorMsg('Could not fetch product details automatically.');
      } else {
        const data = await res.json();
        if (data.title) setTitle(data.title);
        if (data.description) setDescription(data.description);
        if (data.imageUrl) setImageUrl(data.imageUrl);
        if (data.price != null) setPrice(String(data.price));
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Unexpected error while scraping product.');
    } finally {
      setScraping(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    if (!title.trim()) {
      setErrorMsg('Please add a title');
      return;
    }
    setSaving(true);
    setErrorMsg(null);

    const priceNumber = price ? parseFloat(price) : NaN;
    const priceCents = isNaN(priceNumber) ? null : Math.round(priceNumber * 100);

    const { error } = await supabase.from('wishlist_items').insert({
      owner_id: userId,
      title: title.trim(),
      description: description.trim() || null,
      product_url: url.trim() || null,
      image_url: imageUrl.trim() || null,
      price_cents: priceCents,
      priority,
    });

    if (error) {
      console.error(error);
      setErrorMsg(error.message);
    } else {
      setUrl('');
      setTitle('');
      setDescription('');
      setImageUrl('');
      setPrice('');
      setPriority(3);
      loadItems();
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!userId) return;
    const { error } = await supabase
      .from('wishlist_items')
      .delete()
      .eq('id', id)
      .eq('owner_id', userId);
    if (error) {
      console.error(error);
      return;
    }
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  function renderStars(rating: number | null | undefined) {
    const r = rating ?? 0;
    const stars = [];
    for (let i = 1; i <= 5; ++i) {
      const filled = i <= r;
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

  return (
    <main
      style={{
        minHeight: '100vh',
        padding: '1.5rem',
      }}
    >
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4 }}
        style={{
          maxWidth: 900,
          margin: '0 auto',
          borderRadius: 32,
          padding: '1.75rem 1.5rem',
          background: 'rgba(15,23,42,0.96)',
          border: '1px solid rgba(148,163,184,0.5)',
          boxShadow: '0 30px 80px rgba(15,23,42,0.95)',
          color: 'white',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 16,
            alignItems: 'center',
            marginBottom: 16,
          }}
        >
          <div>
            <h1 style={{ fontSize: '1.5rem', margin: 0 }}>Manage my list</h1>
            <p style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>
              Add items to your wishlist. Rating is a 1–5 star priority used when sorting
              on the shopping page.
            </p>
          </div>
          <button
            type="button"
            onClick={() => router.push('/shop')}
            style={{
              borderRadius: 999,
              padding: '0.4rem 0.9rem',
              border: '1px solid rgba(148,163,184,0.7)',
              background: 'transparent',
              color: '#e5e7eb',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Back to gifts
          </button>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSave}
          style={{
            display: 'grid',
            gap: 10,
            marginBottom: 24,
            borderRadius: 20,
            padding: '1rem',
            background: 'rgba(15,23,42,0.9)',
            border: '1px solid rgba(148,163,184,0.45)',
          }}
        >
          <div style={{ fontSize: 13, marginBottom: 4 }}>Add a new item</div>

          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="url"
              required
              placeholder="Product link (Amazon, Best Buy, etc.)"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              style={{
                flex: 1,
                padding: '0.5rem 0.7rem',
                borderRadius: 999,
                border: '1px solid rgba(148,163,184,0.7)',
                background: 'rgba(15,23,42,0.95)',
                color: 'white',
                fontSize: 13,
              }}
            />
            <button
              type="button"
              onClick={handleScrape}
              disabled={scraping || !url}
              style={{
                borderRadius: 999,
                padding: '0.45rem 0.9rem',
                border: 'none',
                cursor: 'pointer',
                background: 'linear-gradient(120deg,#22c55e,#22d3ee)',
                color: 'black',
                fontWeight: 600,
                fontSize: 13,
              }}
            >
              {scraping ? 'Fetching…' : 'Auto-fill'}
            </button>
          </div>

          <input
            type="text"
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{
              padding: '0.5rem 0.7rem',
              borderRadius: 999,
              border: '1px solid rgba(148,163,184,0.7)',
              background: 'rgba(15,23,42,0.95)',
              color: 'white',
              fontSize: 13,
            }}
          />

          <textarea
            rows={2}
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{
              padding: '0.5rem 0.7rem',
              borderRadius: 16,
              border: '1px solid rgba(148,163,184,0.7)',
              background: 'rgba(15,23,42,0.95)',
              color: 'white',
              fontSize: 13,
              resize: 'vertical',
            }}
          />

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="Image URL (optional)"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              style={{
                flex: 2,
                minWidth: 200,
                padding: '0.5rem 0.7rem',
                borderRadius: 999,
                border: '1px solid rgba(148,163,184,0.7)',
                background: 'rgba(15,23,42,0.95)',
                color: 'white',
                fontSize: 13,
              }}
            />
            <input
              type="number"
              min={0}
              step="0.01"
              placeholder="Price (e.g. 29.99)"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              style={{
                flex: 1,
                minWidth: 120,
                padding: '0.5rem 0.7rem',
                borderRadius: 999,
                border: '1px solid rgba(148,163,184,0.7)',
                background: 'rgba(15,23,42,0.95)',
                color: 'white',
                fontSize: 13,
              }}
            />
            <div
              style={{
                flexBasis: 140,
                minWidth: 140,
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                fontSize: 12,
              }}
            >
              <span>Priority (stars)</span>
              <select
                value={priority}
                onChange={(e) => setPriority(parseInt(e.target.value, 10))}
                style={{
                  padding: '0.4rem 0.6rem',
                  borderRadius: 999,
                  border: '1px solid rgba(148,163,184,0.7)',
                  background: 'rgba(15,23,42,0.95)',
                  color: 'white',
                  fontSize: 13,
                }}
              >
                <option value={0}>0 – Just an idea</option>
                <option value={1}>1 – Low</option>
                <option value={2}>2 – Nice to have</option>
                <option value={3}>3 – Solid pick</option>
                <option value={4}>4 – High priority</option>
                <option value={5}>5 – Top wish</option>
              </select>
            </div>
          </div>

          {errorMsg && (
            <div style={{ fontSize: 12, color: '#fecaca', marginTop: 4 }}>{errorMsg}</div>
          )}

          <button
            type="submit"
            disabled={saving}
            style={{
              marginTop: 4,
              borderRadius: 999,
              padding: '0.5rem 1.1rem',
              border: 'none',
              cursor: 'pointer',
              background: 'linear-gradient(120deg,#22c55e,#22d3ee)',
              color: 'black',
              fontWeight: 600,
              fontSize: 14,
              alignSelf: 'flex-start',
            }}
          >
            {saving ? 'Saving…' : 'Add to my wishlist'}
          </button>
        </form>

        {/* Existing items */}
        <div
          style={{
            borderRadius: 20,
            padding: '1rem',
            background: 'rgba(15,23,42,0.9)',
            border: '1px solid rgba(148,163,184,0.45)',
          }}
        >
          <div style={{ fontSize: 13, marginBottom: 8 }}>My items</div>
          {loadingItems ? (
            <p>Loading…</p>
          ) : items.length === 0 ? (
            <p style={{ fontSize: 13, opacity: 0.8 }}>No items yet.</p>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {items.map((item) => (
                <div
                  key={item.id}
                  className="click-card"
                  style={{
                    borderRadius: 16,
                    padding: '0.7rem 0.8rem',
                    border: '1px solid rgba(148,163,184,0.45)',
                    display: 'flex',
                    gap: 10,
                    alignItems: 'center',
                    background: 'rgba(15,23,42,0.95)',
                  }}
                >
                  {item.image_url && (
                    <div
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: 14,
                        overflow: 'hidden',
                        flexShrink: 0,
                        background: '#020617',
                      }}
                    >
                      <img
                        src={item.image_url}
                        alt={item.title}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                        }}
                      />
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: 8,
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>
                          {item.title}
                        </div>
                        {item.price_cents != null && (
                          <div style={{ fontSize: 13, opacity: 0.9, marginTop: 2 }}>
                            ${(item.price_cents / 100).toFixed(2)}
                          </div>
                        )}
                      </div>
                      {renderStars(item.priority)}
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
                  <button
                    type="button"
                    onClick={() => handleDelete(item.id)}
                    style={{
                      borderRadius: 999,
                      padding: '0.25rem 0.6rem',
                      border: '1px solid rgba(248,113,113,0.8)',
                      background: 'transparent',
                      color: '#fecaca',
                      fontSize: 12,
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </main>
  );
}
