import './globals.css';
import React from 'react';

export const metadata = {
  title: 'Zeller Family Christmas Lists',
  description: 'A tiny bit extra… because it’s Christmas.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="holiday-body">
        {/* Soft Apple-style gradient background + subtle radial lights */}
        <div className="holiday-background">
          <div className="holiday-gradient-layer" />
          <div className="holiday-glow holiday-glow-1" />
          <div className="holiday-glow holiday-glow-2" />
          <div className="holiday-glow holiday-glow-3" />
        </div>

        {/* Subtle parallax overlay */}
        <div className="holiday-parallax">
          <div className="parallax-orb orb-1" />
          <div className="parallax-orb orb-2" />
          <div className="parallax-orb orb-3" />
        </div>

        {/* Main content container */}
        <div className="page-shell">
          {children}
        </div>
      </body>
    </html>
  );
}
