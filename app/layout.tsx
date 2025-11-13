import './globals.css';
import React from 'react';

export const metadata = {
  title: 'Family Wishlist',
  description: 'Shared wishlist + shopping cart for the whole family',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
          margin: 0,
          background: 'radial-gradient(circle at top, #020617, #020617 40%, #000 100%)',
          color: 'white',
          minHeight: '100vh',
        }}
      >
        {/* Full-width container instead of a narrow column */}
        <div
          style={{
            width: '100%',
            padding: '1.75rem 2rem 3rem',
            boxSizing: 'border-box',
          }}
        >
          {children}
        </div>
      </body>
    </html>
  );
}
