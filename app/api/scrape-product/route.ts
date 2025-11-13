import { NextRequest, NextResponse } from 'next/server';
import { JSDOM } from 'jsdom';

function cleanText(input: string | null | undefined): string {
  if (!input) return '';
  return input.replace(/\s+/g, ' ').trim();
}

function parsePrice(text: string | null | undefined): number | null {
  if (!text) return null;
  const cleaned = text.replace(/[^0-9.,]/g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  if (!isFinite(num)) return null;
  // ignore weird tiny numbers
  if (num <= 0) return null;
  return Number(num.toFixed(2));
}

function toAbsoluteUrl(raw: string, baseUrl: string): string {
  if (!raw) return '';
  try {
    if (raw.startsWith('//')) {
      const base = new URL(baseUrl);
      return `${base.protocol}${raw}`;
    }
    if (raw.startsWith('/')) {
      const base = new URL(baseUrl);
      return `${base.origin}${raw}`;
    }
    // already absolute
    if (raw.startsWith('http://') || raw.startsWith('https://')) {
      return raw;
    }
    const base = new URL(baseUrl);
    return new URL(raw, base).toString();
  } catch {
    return raw;
  }
}

function pickAmazonImage(doc: Document, finalUrl: string): string | null {
  // Amazon tends to put the main image in these attributes / elements
  const candidates: string[] = [];

  const landing = doc.querySelector('#landingImage') as HTMLImageElement | null;
  if (landing) {
    const hires =
      landing.getAttribute('data-old-hires') ||
      landing.getAttribute('data-a-dynamic-image');
    const src = landing.getAttribute('src');
    if (hires && !hires.startsWith('{')) candidates.push(hires);
    if (src) candidates.push(src);
  }

  const wrapperImg = doc.querySelector('#imgTagWrapperId img') as
    | HTMLImageElement
    | null;
  if (wrapperImg) {
    const hires =
      wrapperImg.getAttribute('data-old-hires') ||
      wrapperImg.getAttribute('data-a-dynamic-image');
    const src = wrapperImg.getAttribute('src');
    if (hires && !hires.startsWith('{')) candidates.push(hires);
    if (src) candidates.push(src);
  }

  // fall back to og:image / twitter:image
  const og =
    doc.querySelector('meta[property="og:image"]')?.getAttribute('content') ||
    doc.querySelector('meta[name="twitter:image"]')?.getAttribute('content');
  if (og) candidates.push(og);

  const absolute = candidates
    .map((u) => toAbsoluteUrl(u, finalUrl))
    .filter((u) => !!u)
    .filter(
      (u) =>
        !u.includes('fls-na.amazon.com') &&
        !u.includes('/1/batch/') &&
        !u.toLowerCase().includes('pixel')
    );

  if (absolute.length === 0) return null;

  const preferred = absolute.find((u) => u.includes('m.media-amazon.com'));
  return preferred || absolute[0];
}

function pickGenericImage(doc: Document, finalUrl: string): string | null {
  const candidates: string[] = [];

  const ogImage =
    doc.querySelector('meta[property="og:image"]')?.getAttribute('content') ||
    doc.querySelector('meta[name="twitter:image"]')?.getAttribute('content');
  if (ogImage) candidates.push(ogImage);

  const linkImage = doc
    .querySelector('link[rel="image_src"]')
    ?.getAttribute('href');
  if (linkImage) candidates.push(linkImage);

  doc.querySelectorAll('img').forEach((img) => {
    const src =
      img.getAttribute('src') ||
      img.getAttribute('data-src') ||
      img.getAttribute('data-srcset');
    if (!src) return;
    candidates.push(src);
  });

  const absolute = candidates
    .map((u) => toAbsoluteUrl(u, finalUrl))
    .filter((u) => !!u)
    .filter(
      (u) =>
        !u.toLowerCase().includes('pixel') &&
        !u.includes('/1/batch/') &&
        !u.includes('fls-na.amazon.com')
    );

  if (absolute.length === 0) return null;

  return absolute[0];
}

function findPrice(doc: Document): number | null {
  const texts: (string | null)[] = [];

  // Meta price tags
  texts.push(
    doc.querySelector('meta[itemprop="price"]')?.getAttribute('content') || null
  );
  texts.push(
    doc
      .querySelector('meta[property="product:price:amount"]')
      ?.getAttribute('content') || null
  );

  // Amazon-specific blocks
  texts.push(doc.querySelector('#priceblock_ourprice')?.textContent || null);
  texts.push(doc.querySelector('#priceblock_dealprice')?.textContent || null);
  texts.push(
    doc.querySelector('#corePriceDisplay_desktop_feature_div span.a-offscreen')
      ?.textContent || null
  );
  texts.push(
    doc.querySelector('#corePrice_feature span.a-offscreen')?.textContent || null
  );

  // Generic price spans (Amazon often uses span.a-offscreen)
  const offscreenSpans = Array.from(
    doc.querySelectorAll('span.a-offscreen')
  ) as HTMLSpanElement[];
  for (const span of offscreenSpans) {
    const t = span.textContent;
    if (t && t.includes('$')) texts.push(t);
  }

  // BestBuy / Target / generic
  texts.push(
    doc.querySelector('.priceView-customer-price span')?.textContent || null
  );
  texts.push(
    doc.querySelector('.price, .Price, .pricing, [data-testid="price"]')
      ?.textContent || null
  );

  for (const t of texts) {
    const p = parsePrice(t || undefined);
    if (p != null) return p;
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid URL' },
        { status: 400 }
      );
    }

    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      },
      cache: 'no-store',
      redirect: 'follow',
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch page' },
        { status: 500 }
      );
    }

    const html = await res.text();
    const dom = new JSDOM(html);
    const doc = dom.window.document;

    // Use the final URL after redirects (important for a.co -> amazon.com)
    const finalUrl = (res as any).url || url;
    const host = (() => {
      try {
        return new URL(finalUrl).hostname;
      } catch {
        return '';
      }
    })();

    // Title
    let title =
      doc.querySelector('meta[property="og:title"]')?.getAttribute('content') ||
      doc.querySelector('meta[name="twitter:title"]')?.getAttribute('content') ||
      doc.querySelector('title')?.textContent ||
      '';
    title = cleanText(title);

    // Description
    let description =
      doc
        .querySelector('meta[property="og:description"]')
        ?.getAttribute('content') ||
      doc
        .querySelector('meta[name="description"]')
        ?.getAttribute('content') ||
      doc
        .querySelector('meta[name="twitter:description"]')
        ?.getAttribute('content') ||
      '';
    description = cleanText(description);

    // Price
    const price = findPrice(doc);

    // Image
    let imageUrl: string | null;
    if (host.includes('amazon.') || host === 'a.co') {
      imageUrl = pickAmazonImage(doc, finalUrl);
      if (!imageUrl) {
        imageUrl = pickGenericImage(doc, finalUrl);
      }
    } else {
      imageUrl = pickGenericImage(doc, finalUrl);
    }

    return NextResponse.json({
      title: title || null,
      description: description || null,
      imageUrl: imageUrl || null,
      price: price ?? null,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: 'Unexpected error while scraping product' },
      { status: 500 }
    );
  }
}
