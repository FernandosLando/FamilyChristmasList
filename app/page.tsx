import Link from 'next/link';

export default function HomePage() {
  const cardStyle = {
    borderRadius: 24,
    padding: '1.75rem 1.5rem',
    background: 'rgba(15, 23, 42, 0.9)',
    border: '1px solid rgba(148, 163, 184, 0.3)',
    backdropFilter: 'blur(18px)',
  } as const;

  const buttonStyle = {
    display: 'inline-block',
    marginTop: '0.75rem',
    padding: '0.6rem 1.25rem',
    borderRadius: 999,
    border: 'none',
    cursor: 'pointer',
    background: 'linear-gradient(120deg, #22c55e, #22d3ee)',
    color: 'black',
    fontWeight: 600,
    fontSize: 14,
    textDecoration: 'none',
  } as const;

  return (
    <main style={{ display: 'grid', gap: '1.5rem' }}>
      <div style={cardStyle}>
        <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.5rem' }}>
          🎄 Family Wishlist HQ
        </h1>
        <p style={{ fontSize: 14, opacity: 0.9, maxWidth: 580 }}>
          Everyone in the family gets their own wishlist. Sign in, paste product links from
          any store, and let the others shop your list with shared carts, budgets, and fun
          mode for surprise gifts.
        </p>
        <Link href="/auth" style={buttonStyle}>
          Get started
        </Link>
      </div>

      <div
        style={{
          display: 'grid',
          gap: '1.5rem',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        }}
      >
        <div style={cardStyle}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Create your list</h2>
          <p style={{ fontSize: 14, opacity: 0.9 }}>
            Once signed in, you can add items from any website with a single link. Titles,
            images, prices, and descriptions are fetched for you.
          </p>
        </div>
        <div style={cardStyle}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Shop for each other</h2>
          <p style={{ fontSize: 14, opacity: 0.9 }}>
            Pick which family member&apos;s list to view, build your cart, and track what
            you&apos;ve already bought—all per account.
          </p>
        </div>
      </div>
    </main>
  );
}
