import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const SCRAPER_API_KEY = process.env.SCRAPER_API_KEY;

// normalize a price string to a number like 29.99
function cleanPrice(input: string | null | undefined): number | null {
  if (!input) return null;
  const cleaned = input.replace(/[^0-9.]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'Missing url' }, { status: 400 });
    }

    if (!SCRAPER_API_KEY) {
      console.error('SCRAPER_API_KEY is not set');
      return NextResponse.json(
        { error: 'Server not configured for scraping' },
        { status: 500 }
      );
    }

    // ScraperAPI request – render=true gets us the fully rendered HTML
    const scraperUrl = `https://api.scraperapi.com/?api_key=${encodeURIComponent(
      SCRAPER_API_KEY
    )}&render=true&url=${encodeURIComponent(url)}`;

    const resp = await fetch(scraperUrl);
    if (!resp.ok) {
      console.error('ScraperAPI error status:', resp.status);
      return NextResponse.json(
        { error: 'Could not fetch product details automatically.' },
        { status: 502 }
      );
    }

    const html = await resp.text();

    // ---------- TITLE ----------
    let title: string | null =
      /\<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["'][^>]*\>/i.exec(html)?.[1] ||
      /\<meta[^>]+name=["']title["'][^>]+content=["']([^"']+)["'][^>]*\>/i.exec(html)?.[1] ||
      /\<title\>([^<]+)\<\/title\>/i.exec(html)?.[1] ||
      null;

    if (title) {
      title = title.replace(/\s+/g, ' ').trim();
    }

    // ---------- DESCRIPTION ----------
    let description: string | null =
      /\<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*\>/i.exec(html)?.[1] ||
      /\<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["'][^>]*\>/i.exec(html)?.[1] ||
      null;

    if (description) {
      description = description.replace(/\s+/g, ' ').trim();
    }

    // ---------- IMAGE ----------
    let imageUrl: string | null =
      /\<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*\>/i.exec(html)?.[1] ||
      /\<meta[^>]+property=["']og:image:url["'][^>]+content=["']([^"']+)["'][^>]*\>/i.exec(html)?.[1] ||
      null;

    if (!imageUrl) {
      // fallback: first reasonably large-looking img src
      const imgMatch = html.match(
        /<img[^>]+src=["']([^"']+)["'][^>]*(?:width=["']?(\d+)["']?)?[^>]*>/i
      );
      if (imgMatch) {
        imageUrl = imgMatch[1];
      }
    }

    if (imageUrl && imageUrl.startsWith('//')) {
      imageUrl = 'https:' + imageUrl;
    }

    // ---------- PRICE ----------
    let price: number | null = null;

    // Try JSON-LD first (common for Amazon, Target, BB, etc.)
    const jsonLdBlocks = html.match(
      /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
    );

    if (jsonLdBlocks) {
      for (const block of jsonLdBlocks) {
        try {
          const jsonText = block
            .replace(/<script[^>]*>/i, '')
            .replace(/<\/script>/i, '');
          const parsed = JSON.parse(jsonText);

          const tryExtractPrice = (obj: any): number | null => {
            if (!obj) return null;
            if (obj.offers?.price) return cleanPrice(obj.offers.price);
            if (obj.offers?.highPrice) return cleanPrice(obj.offers.highPrice);
            if (obj.price) return cleanPrice(obj.price);
            return null;
          };

          if (Array.isArray(parsed)) {
            for (const entry of parsed) {
              const p = tryExtractPrice(entry);
              if (p != null) {
                price = p;
                break;
              }
            }
          } else {
            const p = tryExtractPrice(parsed);
            if (p != null) {
              price = p;
            }
          }

          if (price != null) break;
        } catch {
          // ignore JSON parse errors
        }
      }
    }

    // Fallback regex for $XX.XX patterns
    if (price == null) {
      const priceMatch = html.match(/\$[0-9]{1,4}(?:,[0-9]{3})*(?:\.[0-9]{2})?/);
      if (priceMatch) {
        price = cleanPrice(priceMatch[0]);
      }
    }

    return NextResponse.json({
      title: title || null,
      description: description || null,
      imageUrl: imageUrl || null,
      price: price,
    });
  } catch (err) {
    console.error('Unexpected scrape error:', err);
    return NextResponse.json(
      { error: 'Could not fetch product details automatically.' },
      { status: 500 }
    );
  }
}
